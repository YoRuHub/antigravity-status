/**
 * Antigravity API Service
 * Handles communication with Antigravity Language Server and Google Cloud Code APIs
 */

import * as https from 'https';
import * as vscode from 'vscode';
import axios from 'axios';
import { CredentialManager } from './credentialManager';
import { i18n } from './i18n';

const TIMING = { HTTP_TIMEOUT_MS: 10000 } as const;

// ============ Direct API (Google Cloud) Types ============

interface DirectApiQuotaInfo {
    remainingFraction?: number;
    resetTime?: string;
}

interface DirectApiModelInfo {
    displayName?: string;
    model?: string;
    quotaInfo?: DirectApiQuotaInfo;
    supportsImages?: boolean;
    recommended?: boolean;
}

interface DirectApiResponse {
    models?: Record<string, DirectApiModelInfo>;
}

// ============ Local API Types ============

interface LocalApiQuotaInfo {
    remainingFraction?: number;
    resetTime: string;
}

interface LocalApiModelConfig {
    label: string;
    modelOrAlias?: { model: string };
    quotaInfo?: LocalApiQuotaInfo;
    supportsImages?: boolean;
    isRecommended?: boolean;
}

interface LocalApiUserStatus {
    name: string;
    email: string;
    planStatus?: {
        planInfo: {
            planName: string;
            monthlyPromptCredits: number;
        };
        availablePromptCredits: number;
    };
    cascadeModelConfigData?: {
        clientModelConfigs: LocalApiModelConfig[];
    };
    userTier?: { name: string };
}

interface LocalApiResponse {
    userStatus?: LocalApiUserStatus;
}

// ============ Processed Output Types ============

export interface ProcessedModelQuota {
    label: string;
    modelId: string;
    remainingPercentage: number;
    resetTime: Date;
    timeUntilReset: number;
    status: 'normal' | 'warning' | 'critical';
    supportsImages: boolean;
    isRecommended: boolean;
    imageUrl?: string;
}

export interface UserInfo {
    name: string;
    email: string;
    planName: string;
    tier: string;
    monthlyPromptCredits: number;
    availablePromptCredits: number;
}

export interface QuotaSnapshot {
    timestamp: Date;
    userInfo?: UserInfo;
    models: ProcessedModelQuota[];
    isConnected: boolean;
    errorMessage?: string;
    source?: 'direct' | 'local';
}

// ============ API Client ============

export class AntigravityApiClient {
    private credentialManager?: CredentialManager;
    private port: number;
    private csrfToken: string;

    constructor(context?: vscode.ExtensionContext, port: number = 5000, csrfToken: string = '') {
        if (context) {
            this.credentialManager = new CredentialManager(context);
        }
        // Validate port range (1024-65535)
        this.port = (port >= 1024 && port <= 65535) ? port : 5000;
        this.csrfToken = csrfToken;
    }

    async fetchQuotaSnapshot(
        warningThreshold: number = 30,
        criticalThreshold: number = 10
    ): Promise<QuotaSnapshot> {
        try {
            if (this.credentialManager) {
                const directSnapshot = await this.fetchFromDirectApi(warningThreshold, criticalThreshold);
                if (directSnapshot) {
                    return directSnapshot;
                }
            }

            const localSnapshot = await this.fetchFromLocalApi(warningThreshold, criticalThreshold);
            if (localSnapshot) {
                return localSnapshot;
            }

            throw new Error(i18n.t('error.apiStatusFailed'));
        } catch (error) {
            return {
                timestamp: new Date(),
                models: [],
                isConnected: false,
                errorMessage: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async fetchFromDirectApi(
        warningThreshold: number,
        criticalThreshold: number
    ): Promise<QuotaSnapshot | null> {
        try {
            const creds = await this.credentialManager?.getCredentials();
            if (!creds?.accessToken) {
                return null;
            }

            const projectId = await this.resolveProjectId(creds.accessToken);
            if (!projectId) {
                return null;
            }

            const response = await axios.post<DirectApiResponse>(
                'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
                { project: projectId },
                {
                    headers: {
                        'Authorization': `Bearer ${creds.accessToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'antigravity'
                    },
                    timeout: TIMING.HTTP_TIMEOUT_MS
                }
            );

            const models = this.parseDirectApiResponse(response.data, warningThreshold, criticalThreshold);

            return {
                timestamp: new Date(),
                models,
                isConnected: true,
                source: 'direct',
            };
        } catch (err) {
            return null;
        }
    }

    private async resolveProjectId(accessToken: string): Promise<string | null> {
        const envProject = process.env.GOOGLE_CLOUD_PROJECT;
        if (envProject) {
            return envProject;
        }

        try {
            const response = await axios.post(
                'https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist',
                { metadata: { ideType: 'ANTIGRAVITY', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' } },
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                        'User-Agent': 'antigravity'
                    },
                    timeout: TIMING.HTTP_TIMEOUT_MS
                }
            );

            const data = response.data;
            if (typeof data?.cloudaicompanionProject === 'string') {
                return data.cloudaicompanionProject;
            }
            const proj = data?.cloudaicompanionProject;
            if (proj && typeof proj === 'object' && 'projectId' in proj) {
                return String(proj.projectId);
            }
            return null;
        } catch {
            return null;
        }
    }

    private parseDirectApiResponse(
        data: DirectApiResponse,
        warningThreshold: number,
        criticalThreshold: number
    ): ProcessedModelQuota[] {
        const models: ProcessedModelQuota[] = [];
        const now = Date.now();

        if (!data.models) {
            return models;
        }

        for (const [modelKey, info] of Object.entries(data.models)) {
            const displayName = info.displayName || modelKey;

            // Filter: only show Antigravity-available models + Gemini 3 Pro Image
            const allowedModels = [
                'Gemini 3 Pro (High)',
                'Gemini 3 Pro (Low)',
                'Gemini 3 Flash',
                'Claude Sonnet 4.5',
                'Claude Sonnet 4.5 (Thinking)',
                'Claude Opus 4.5 (Thinking)',
                'GPT-OSS 120B (Medium)',
                'Gemini 3 Pro Image',
            ];
            if (!allowedModels.includes(displayName)) {
                continue;
            }

            const quotaInfo = info.quotaInfo;

            // If quotaInfo exists but remainingFraction is missing, quota is exhausted (0%)
            // If quotaInfo doesn't exist at all, model is unlimited (100%)
            const remainingFraction = quotaInfo
                ? this.clamp(quotaInfo.remainingFraction ?? 0, 0, 1)  // Missing = exhausted
                : 1; // No quotaInfo = unlimited
            const remainingPercentage = Math.round(remainingFraction * 100);

            const resetTime = quotaInfo?.resetTime
                ? this.parseResetTime(quotaInfo.resetTime, now)
                : new Date(now + 24 * 60 * 60 * 1000); // Default 24h if no reset time

            const timeUntilReset = Math.max(0, resetTime.getTime() - now);
            const status = this.determineStatus(remainingPercentage, warningThreshold, criticalThreshold);

            models.push({
                label: displayName,
                modelId: info.model || modelKey,
                remainingPercentage,
                resetTime,
                timeUntilReset,
                status,
                supportsImages: info.supportsImages ?? false,
                isRecommended: info.recommended ?? false,
            });
        }

        return models.sort((a, b) => a.label.localeCompare(b.label));
    }


    private async fetchFromLocalApi(
        warningThreshold: number,
        criticalThreshold: number
    ): Promise<QuotaSnapshot | null> {
        try {
            const response = await axios.post<LocalApiResponse>(
                `https://127.0.0.1:${this.port}/exa.language_server_pb.LanguageServerService/GetUserStatus`,
                {},
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Connect-Protocol-Version': '1',
                        'X-Codeium-Csrf-Token': this.csrfToken,
                    },
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                    timeout: TIMING.HTTP_TIMEOUT_MS
                }
            );

            const { userInfo, models } = this.parseLocalApiResponse(
                response.data,
                warningThreshold,
                criticalThreshold
            );

            return {
                timestamp: new Date(),
                userInfo,
                models,
                isConnected: true,
                source: 'local',
            };
        } catch {
            return null;
        }
    }

    private parseLocalApiResponse(
        data: LocalApiResponse,
        warningThreshold: number,
        criticalThreshold: number
    ): { userInfo?: UserInfo; models: ProcessedModelQuota[] } {
        const userStatus = data.userStatus;
        const now = Date.now();
        const models: ProcessedModelQuota[] = [];

        const userInfo: UserInfo | undefined = userStatus ? {
            name: userStatus.name || '',
            email: userStatus.email || '',
            planName: userStatus.planStatus?.planInfo?.planName || i18n.t('common.unknown'),
            tier: userStatus.userTier?.name || i18n.t('common.unknown'),
            monthlyPromptCredits: userStatus.planStatus?.planInfo?.monthlyPromptCredits || 0,
            availablePromptCredits: userStatus.planStatus?.availablePromptCredits || 0,
        } : undefined;

        const configs = userStatus?.cascadeModelConfigData?.clientModelConfigs || [];

        for (const config of configs) {
            const quotaInfo = config.quotaInfo;
            if (!quotaInfo) continue;

            const remainingFraction = this.clamp(quotaInfo.remainingFraction ?? 0, 0, 1);
            const remainingPercentage = Math.round(remainingFraction * 100);
            const resetTime = this.parseResetTime(quotaInfo.resetTime, now);
            const timeUntilReset = Math.max(0, resetTime.getTime() - now);
            const status = this.determineStatus(remainingPercentage, warningThreshold, criticalThreshold);

            models.push({
                label: config.label || i18n.t('common.unknown'),
                modelId: config.modelOrAlias?.model || config.label || '',
                remainingPercentage,
                resetTime,
                timeUntilReset,
                status,
                supportsImages: config.supportsImages ?? false,
                isRecommended: config.isRecommended ?? false,
            });
        }

        return { userInfo, models: models.sort((a, b) => a.label.localeCompare(b.label)) };
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }

    private parseResetTime(resetTimeStr: string | undefined, now: number): Date {
        if (!resetTimeStr) {
            return new Date(now + 24 * 60 * 60 * 1000);
        }
        const parsed = new Date(resetTimeStr);
        if (Number.isNaN(parsed.getTime())) {
            return new Date(now + 24 * 60 * 60 * 1000);
        }
        return parsed;
    }

    private determineStatus(
        remainingPercentage: number,
        warningThreshold: number,
        criticalThreshold: number
    ): 'normal' | 'warning' | 'critical' {
        if (remainingPercentage <= criticalThreshold) return 'critical';
        if (remainingPercentage <= warningThreshold) return 'warning';
        return 'normal';
    }
}
