/**
 * Antigravity Status VSCode Extension
 *
 * Monitors Antigravity API quota usage and displays status in VS Code status bar.
 * Connects to local Antigravity Language Server process to fetch real quota data.
 */

import * as vscode from 'vscode';
import * as net from 'net';
import { ProcessHunter, EnvironmentScanResult } from './processHunter';
import {
    AntigravityApiClient,
    QuotaSnapshot,
    ProcessedModelQuota,
} from './antigravityApi';

// Threshold constants
const WARNING_THRESHOLD = 50;
const CRITICAL_THRESHOLD = 20;

// Extension configuration
interface ExtensionConfig {
    refreshInterval: number;
    showNotifications: boolean;
    notificationThreshold: number;
    statusBarPosition: 'left' | 'right';
    hiddenModels: string[];
}

// Global state
let statusBarItems: vscode.StatusBarItem[] = [];
let loadingStatusBarItem: vscode.StatusBarItem | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let outputChannel: vscode.OutputChannel;
let connectionInfo: EnvironmentScanResult | null = null;
let apiClient: AntigravityApiClient | null = null;
let hunter: ProcessHunter | null = null;
let lastNotifiedModel: string | null = null;
let notifiedModels = new Set<string>();
let extensionContext: vscode.ExtensionContext;

/**
 * Get extension configuration
 */
function getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('antigravityStatus');
    return {
        refreshInterval: config.get<number>('refreshInterval', 120),
        showNotifications: config.get<boolean>('showNotifications', true),
        notificationThreshold: config.get<number>('notificationThreshold', 30),
        statusBarPosition: config.get<'left' | 'right'>('statusBarPosition', 'right'),
        hiddenModels: config.get<string[]>('hiddenModels', []),
    };
}

/**
 * Log message to output channel
 */
function log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
    outputChannel.appendLine(`[${timestamp}] ${prefix} ${message}`);
}

/**
 * Try to connect to Antigravity process
 */
async function connectToAntigravity(): Promise<boolean> {
    if (!hunter) {
        hunter = new ProcessHunter();
    }

    showLoading();

    try {
        connectionInfo = await hunter.scanEnvironment(3);

        if (connectionInfo) {
            apiClient = new AntigravityApiClient(
                extensionContext,
                connectionInfo.connectPort,
                connectionInfo.csrfToken
            );
            return true;
        } else {
            return false;
        }
    } catch (error) {
        log(`Connection error: ${error}`, 'error');
        return false;
    }
}

/**
 * Format time until reset
 */
function formatTimeUntilReset(ms: number): string {
    if (ms <= 0) {
        return 'Now';
    }

    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}

/**
 * Format absolute reset time
 */
function formatAbsoluteTime(msUntilReset: number): string {
    const resetDate = new Date(Date.now() + msUntilReset);
    return resetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Get icon path for a given percentage
 */
function getIconPath(percentage: number): vscode.Uri {
    // Round to nearest 10%
    const rounded = Math.round(percentage / 10) * 10;
    const clamped = Math.max(0, Math.min(100, rounded));
    // Use the "tooltip" version which has full color and gray background
    return vscode.Uri.file(extensionContext.asAbsolutePath(`resources/icons/tooltip-${clamped}.svg`));
}

/**
 * Clear all existing status bar items
 */
function clearStatusBarItems(): void {
    for (const item of statusBarItems) {
        item.dispose();
    }
    statusBarItems = [];
}

/**
 * Show loading indicator
 */
function showLoading(): void {
    if (!loadingStatusBarItem) {
        const config = getConfig();
        const alignment = config.statusBarPosition === 'left'
            ? vscode.StatusBarAlignment.Left
            : vscode.StatusBarAlignment.Right;
        loadingStatusBarItem = vscode.window.createStatusBarItem(alignment, 100);
        loadingStatusBarItem.name = 'Antigravity Quota';
        loadingStatusBarItem.command = 'antigravityStatus.showDetails';
        extensionContext.subscriptions.push(loadingStatusBarItem);
    }
    loadingStatusBarItem.text = '$(sync~spin)';
    loadingStatusBarItem.show();
}

/**
 * Hide loading indicator
 */
function hideLoading(): void {
    if (loadingStatusBarItem) {
        loadingStatusBarItem.hide();
    }
}

/**
 * Update status bar items - one per model
 */
function updateStatusBar(snapshot: QuotaSnapshot, config: ExtensionConfig): void {
    // Clear existing items
    clearStatusBarItems();
    hideLoading();

    if (!snapshot.isConnected) {
        // Show error state
        if (!loadingStatusBarItem) {
            showLoading();
        }
        loadingStatusBarItem!.text = '$(warning) No Connection';
        loadingStatusBarItem!.tooltip = snapshot.errorMessage || 'Not connected to Antigravity';
        loadingStatusBarItem!.color = new vscode.ThemeColor('charts.yellow');
        loadingStatusBarItem!.show();
        return;
    }

    if (snapshot.models.length === 0) {
        if (!loadingStatusBarItem) {
            showLoading();
        }
        loadingStatusBarItem!.text = '$(info) No Data';
        loadingStatusBarItem!.tooltip = 'No model quota information available';
        loadingStatusBarItem!.show();
        return;
    }

    const alignment = config.statusBarPosition === 'left'
        ? vscode.StatusBarAlignment.Left
        : vscode.StatusBarAlignment.Right;

    // Filter out hidden models
    const visibleModels = snapshot.models.filter(m => !config.hiddenModels.includes(m.modelId));

    if (visibleModels.length === 0) {
        if (!loadingStatusBarItem) {
            showLoading();
        }
        loadingStatusBarItem!.text = '$(info) No Visible Models';
        loadingStatusBarItem!.tooltip = 'All models are hidden in settings. Click to configure.';
        loadingStatusBarItem!.show();
        return;
    }

    // Create status bar items for each model (in reverse order for correct display)
    // Right alignment: first item = rightmost, so reverse to show first model on left
    const models = config.statusBarPosition === 'right'
        ? [...visibleModels].reverse()
        : visibleModels;

    for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const priority = config.statusBarPosition === 'right' ? 100 - i : 100 + i;

        const item = vscode.window.createStatusBarItem(alignment, priority);
        item.name = `Antigravity: ${model.label}`;
        item.command = 'antigravityStatus.configureModels';

        // Use integer for cleaner "strict" look in status bar
        item.text = `$(circle-filled) ${Math.round(model.remainingPercentage)}%`;

        // Set color based on status
        if (model.status === 'critical') {
            item.color = new vscode.ThemeColor('charts.red');
        } else if (model.status === 'warning') {
            item.color = new vscode.ThemeColor('charts.yellow');
        } else {
            item.color = new vscode.ThemeColor('charts.green');
        }

        // Compact tooltip: SVG left, info right in a table
        // Use rounded percentage for icon selection, strict for display
        const iconUri = getIconPath(Math.round(model.remainingPercentage));
        const resetRemaining = formatTimeUntilReset(model.timeUntilReset);
        const resetClock = formatAbsoluteTime(model.timeUntilReset);

        const logoHtml = model.imageUrl
            ? `<img src="${model.imageUrl}" height="16" width="16"> `
            : '';

        const tooltipMd = new vscode.MarkdownString(
            `| | |\n| --- | --- |\n| <img src="${iconUri.toString()}" height="52"> | ${logoHtml}**${model.label}**<br>Reset Time: ${resetClock}<br>(${resetRemaining} remaining) |`
        );
        tooltipMd.isTrusted = true;
        tooltipMd.supportHtml = true; // Enable <br> support
        item.tooltip = tooltipMd;

        item.show();
        statusBarItems.push(item);
        extensionContext.subscriptions.push(item);
    }

    // Show notification if below notification threshold and notifications enabled
    if (config.showNotifications) {
        for (const model of snapshot.models) {
            if (model.remainingPercentage <= config.notificationThreshold) {
                if (!notifiedModels.has(model.modelId)) {
                    notifiedModels.add(model.modelId);
                    vscode.window.showWarningMessage(
                        `Antigravity: ${model.label} quota is low (${Math.round(model.remainingPercentage)}%)`
                    );
                }
            } else {
                // Remove from notified set if it's now above threshold (e.g. reset)
                notifiedModels.delete(model.modelId);
            }
        }
    } else {
        notifiedModels.clear();
    }
}

/**
 * Refresh quota data and update status bar
 */
async function refreshQuota(): Promise<void> {
    const config = getConfig();

    // Try to connect if not connected
    if (!apiClient) {
        const connected = await connectToAntigravity();
        if (!connected) {
            if (loadingStatusBarItem) {
                loadingStatusBarItem.text = '$(warning) Not found';
                loadingStatusBarItem.tooltip = 'Antigravity process not found. Make sure Windsurf/Cursor is running.';
                loadingStatusBarItem.color = new vscode.ThemeColor('charts.yellow');
                loadingStatusBarItem.show();
            }
            return;
        }
    }

    try {
        const snapshot = await apiClient!.fetchQuotaSnapshot(
            WARNING_THRESHOLD,
            CRITICAL_THRESHOLD
        );

        if (!snapshot.isConnected) {
            apiClient = null;
            const connected = await connectToAntigravity();
            if (connected) {
                // Retry fetch
                const retrySnapshot = await apiClient!.fetchQuotaSnapshot(
                    WARNING_THRESHOLD,
                    CRITICAL_THRESHOLD
                );
                updateStatusBar(retrySnapshot, config);
            } else {
                updateStatusBar(snapshot, config);
            }
            return;
        }


        updateStatusBar(snapshot, config);
    } catch (error) {
        log(`Refresh failed: ${error}`, 'error');
        if (loadingStatusBarItem) {
            loadingStatusBarItem.text = '$(error) Error';
            loadingStatusBarItem.tooltip = `Failed to fetch quota: ${error}`;
            loadingStatusBarItem.color = new vscode.ThemeColor('charts.red');
            loadingStatusBarItem.show();
        }
        // Reset client to trigger reconnect
        apiClient = null;
    }
}

/**
 * Start refresh timer
 */
function startRefreshTimer(): void {
    const config = getConfig();

    if (refreshTimer) {
        clearInterval(refreshTimer);
    }

    // Initial refresh
    refreshQuota();

    // Set up periodic refresh
    refreshTimer = setInterval(() => {
        refreshQuota();
    }, config.refreshInterval * 1000);
}

/**
 * Show quota details in QuickPick
 */
async function showQuotaDetails(): Promise<void> {
    const config = getConfig();

    if (!apiClient) {
        const connected = await connectToAntigravity();
        if (!connected) {
            vscode.window.showWarningMessage('Antigravity process not found. Make sure Windsurf/Cursor is running.');
            return;
        }
    }

    try {
        const snapshot = await apiClient!.fetchQuotaSnapshot(
            WARNING_THRESHOLD,
            CRITICAL_THRESHOLD
        );

        if (!snapshot.isConnected) {
            vscode.window.showWarningMessage(`Connection error: ${snapshot.errorMessage}`);
            return;
        }

        const items: vscode.QuickPickItem[] = snapshot.models.map((model) => {
            const icon = '$(circle-filled)';

            return {
                label: `${icon} ${model.label}`,
                description: `${model.remainingPercentage}% remaining`,
                detail: `Reset in ${formatTimeUntilReset(model.timeUntilReset)}`,
            };
        });

        // Add user info as header
        if (snapshot.userInfo) {
            items.unshift({
                label: `$(account) ${snapshot.userInfo.email}`,
                description: snapshot.userInfo.planName,
                detail: `Prompt Credits: ${snapshot.userInfo.availablePromptCredits.toLocaleString()} / ${snapshot.userInfo.monthlyPromptCredits.toLocaleString()}`,
                kind: vscode.QuickPickItemKind.Separator,
            } as vscode.QuickPickItem);
        }

        await vscode.window.showQuickPick(items, {
            placeHolder: 'Antigravity Quota Status',
            title: 'Quota Details',
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to fetch quota details: ${error}`);
    }
}

/**
 * Show quick pick to configure visible models
 */
async function configureVisibleModels(): Promise<void> {
    if (!apiClient) {
        vscode.window.showWarningMessage('Antigravity: Not connected to process. Cannot fetch model list.');
        return;
    }

    try {
        const config = getConfig();
        const currentHidden = config.hiddenModels;

        // Fetch current quota to get full model list
        const snapshot = await apiClient.fetchQuotaSnapshot(
            WARNING_THRESHOLD,
            CRITICAL_THRESHOLD
        );

        if (snapshot.models.length === 0) {
            vscode.window.showInformationMessage('Antigravity: No models found to configure.');
            return;
        }

        const iconMap = {
            critical: '$(circle-filled)',
            warning: '$(circle-filled)',
            green: '$(circle-filled)',
        };

        const items: (vscode.QuickPickItem & { modelId: string })[] = snapshot.models.map(m => {
            const isVisible = !currentHidden.includes(m.modelId);
            const colorIcon = iconMap[m.status as keyof typeof iconMap] || '$(circle-filled)';

            return {
                label: m.label,
                description: `${colorIcon} ${m.remainingPercentage}%`,
                detail: `Reset in ${formatTimeUntilReset(m.timeUntilReset)} (ID: ${m.modelId})`,
                picked: isVisible,
                modelId: m.modelId
            };
        });

        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: 'Select models to show in the status bar (Check to show)',
            title: 'Manage Model Visibility'
        });

        if (selected) {
            const visibleIds = selected.map(item => item.modelId);
            const allIds = snapshot.models.map(m => m.modelId);
            const hiddenIds = allIds.filter(id => !visibleIds.includes(id));

            await vscode.workspace.getConfiguration('antigravityStatus').update(
                'hiddenModels',
                hiddenIds,
                vscode.ConfigurationTarget.Global
            );

            vscode.window.showInformationMessage(`Antigravity: Updated visible models.`);
            refreshQuota();
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to configure models: ${error}`);
    }
}

/**
 * Open extension settings
 */
function openExtensionSettings(): void {
    vscode.commands.executeCommand('workbench.action.openSettings', '@ext:antigravity.antigravity-status');
}

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    extensionContext = context;
    // Set network timeout for IPv4/IPv6 auto-selection
    if (net.setDefaultAutoSelectFamilyAttemptTimeout) {
        net.setDefaultAutoSelectFamilyAttemptTimeout(1000);
    }

    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Antigravity Status');
    context.subscriptions.push(outputChannel);

    // Show loading indicator initially
    showLoading();

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('antigravityStatus.refresh', () => {
        refreshQuota();
    });
    context.subscriptions.push(refreshCommand);

    const showDetailsCommand = vscode.commands.registerCommand('antigravityStatus.showDetails', () => {
        showQuotaDetails();
    });
    context.subscriptions.push(showDetailsCommand);

    const configureModelsCommand = vscode.commands.registerCommand('antigravityStatus.configureModels', () => {
        configureVisibleModels();
    });
    context.subscriptions.push(configureModelsCommand);

    const openSettingsCommand = vscode.commands.registerCommand('antigravityStatus.openSettings', () => {
        openExtensionSettings();
    });
    context.subscriptions.push(openSettingsCommand);

    // Watch for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('antigravityStatus')) {
            startRefreshTimer();
        }
    });
    context.subscriptions.push(configWatcher);

    // Start refresh timer
    startRefreshTimer();
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
    if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
    }
}
