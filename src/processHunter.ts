/**
 * Process Hunter - Antigravity プロセスの検出
 *
 * ローカルで実行中の Antigravity Language Server プロセスを検出し、
 * 接続に必要な情報（ポート、CSRFトークン）を取得する
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as process from 'process';

const execAsync = promisify(exec);

/** プロセス情報 */
export interface ProcessInfo {
    /** プロセス ID */
    pid: number;
    /** 拡張機能ポート */
    extensionPort: number;
    /** CSRF トークン */
    csrfToken: string;
}

/** 環境スキャン結果 */
export interface EnvironmentScanResult {
    /** 拡張機能ポート */
    extensionPort: number;
    /** 接続ポート */
    connectPort: number;
    /** CSRF トークン */
    csrfToken: string;
}

/** ターゲットプロセス名 */
const PROCESS_NAMES = {
    windows: 'language_server_windows_x64.exe',
    darwin_arm: 'language_server_macos_arm',
    darwin_x64: 'language_server_macos',
    linux: 'language_server_linux',
} as const;

/** タイムアウト設定 */
const TIMING = {
    PROCESS_CMD_TIMEOUT_MS: 15000,
    PROCESS_SCAN_RETRY_MS: 100,
    HTTP_TIMEOUT_MS: 10000,
} as const;

/**
 * Antigravity プロセスを検出するクラス
 */
export class ProcessHunter {
    private targetProcess: string;
    private platform: NodeJS.Platform;

    constructor() {
        this.platform = process.platform;

        if (this.platform === 'win32') {
            this.targetProcess = PROCESS_NAMES.windows;
        } else if (this.platform === 'darwin') {
            this.targetProcess = process.arch === 'arm64'
                ? PROCESS_NAMES.darwin_arm
                : PROCESS_NAMES.darwin_x64;
        } else {
            this.targetProcess = PROCESS_NAMES.linux;
        }
    }

    /**
     * 環境をスキャンして Antigravity プロセスを検出
     */
    async scanEnvironment(maxAttempts: number = 3): Promise<EnvironmentScanResult | null> {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const cmd = this.getProcessListCommand();
                const { stdout } = await execAsync(cmd, {
                    timeout: TIMING.PROCESS_CMD_TIMEOUT_MS,
                });

                if (!stdout || !stdout.trim()) {
                    continue;
                }

                const candidates = this.parseProcessInfo(stdout);

                if (candidates && candidates.length > 0) {
                    for (const info of candidates) {
                        const result = await this.verifyAndConnect(info);
                        if (result) {
                            return result;
                        }
                    }
                }
            } catch (error) {
                // 次の試行へ
            }

            if (i < maxAttempts - 1) {
                await new Promise(r => setTimeout(r, TIMING.PROCESS_SCAN_RETRY_MS));
            }
        }

        return null;
    }

    /**
     * プロセスリスト取得コマンドを生成
     */
    private getProcessListCommand(): string {
        if (this.platform === 'win32') {
            // PowerShell コマンド
            return `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq '${this.targetProcess}' } | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress"`;
        } else {
            // Unix/macOS
            return `ps -eo pid,args | grep -E "${this.targetProcess}" | grep -v grep`;
        }
    }

    /**
     * コマンド出力からプロセス情報を解析
     */
    private parseProcessInfo(stdout: string): ProcessInfo[] {
        const results: ProcessInfo[] = [];

        if (this.platform === 'win32') {
            try {
                const parsed = JSON.parse(stdout);
                const processes = Array.isArray(parsed) ? parsed : [parsed];

                for (const proc of processes) {
                    if (proc.CommandLine) {
                        const info = this.extractFromCommandLine(proc.ProcessId, proc.CommandLine);
                        if (info) {
                            results.push(info);
                        }
                    }
                }
            } catch {
                // JSON解析失敗
            }
        } else {
            // Unix形式
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
                const match = line.match(/^\s*(\d+)\s+(.+)$/);
                if (match) {
                    const pid = parseInt(match[1], 10);
                    const cmdline = match[2];
                    const info = this.extractFromCommandLine(pid, cmdline);
                    if (info) {
                        results.push(info);
                    }
                }
            }
        }

        return results;
    }

    /**
     * コマンドラインから接続情報を抽出
     */
    private extractFromCommandLine(pid: number, cmdline: string): ProcessInfo | null {
        // --csrf_token=xxx を抽出
        const tokenMatch = cmdline.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);
        // --extension_server_port=xxx を抽出
        const portMatch = cmdline.match(/--extension_server_port[=\s]+(\d+)/i);

        if (tokenMatch && portMatch) {
            return {
                pid,
                extensionPort: parseInt(portMatch[1], 10),
                csrfToken: tokenMatch[1],
            };
        }

        return null;
    }

    /**
     * 接続を検証
     */
    private async verifyAndConnect(info: ProcessInfo): Promise<EnvironmentScanResult | null> {
        const ports = await this.identifyPorts(info.pid);

        if (ports.length > 0) {
            const validPort = await this.verifyConnection(ports, info.csrfToken);
            if (validPort) {
                return {
                    extensionPort: info.extensionPort,
                    connectPort: validPort,
                    csrfToken: info.csrfToken,
                };
            }
        }

        return null;
    }

    /**
     * プロセスがリッスンしているポートを特定
     */
    private async identifyPorts(pid: number): Promise<number[]> {
        try {
            const cmd = this.getPortListCommand(pid);
            const { stdout } = await execAsync(cmd, { timeout: 5000 });
            return this.parsePortList(stdout);
        } catch {
            return [];
        }
    }

    /**
     * ポートリスト取得コマンドを生成
     */
    private getPortListCommand(pid: number): string {
        if (this.platform === 'win32') {
            return `netstat -ano | findstr ":${pid}" | findstr "LISTENING"`;
        } else if (this.platform === 'darwin') {
            return `lsof -nP -iTCP -sTCP:LISTEN -a -p ${pid} 2>/dev/null | awk 'NR>1 {print $9}' | grep -oE '[0-9]+$'`;
        } else {
            return `ss -tlnp 2>/dev/null | grep "pid=${pid}" | awk '{print $4}' | grep -oE '[0-9]+$'`;
        }
    }

    /**
     * ポートリスト出力を解析
     */
    private parsePortList(stdout: string): number[] {
        const ports: Set<number> = new Set();
        const lines = stdout.trim().split('\n');

        for (const line of lines) {
            const portMatches = line.match(/:(\d+)\s/g) || line.match(/\b(\d{4,5})\b/g);
            if (portMatches) {
                for (const match of portMatches) {
                    const port = parseInt(match.replace(/[:\s]/g, ''), 10);
                    if (port >= 1024 && port <= 65535) {
                        ports.add(port);
                    }
                }
            }
        }

        return Array.from(ports);
    }

    /**
     * 接続を検証（APIエンドポイントにリクエストを送信）
     */
    private async verifyConnection(ports: number[], csrfToken: string): Promise<number | null> {
        for (const port of ports) {
            try {
                const isValid = await this.testPort(port, csrfToken);
                if (isValid) {
                    return port;
                }
            } catch {
                // 次のポートへ
            }
        }
        return null;
    }

    /**
     * 指定ポートへのテストリクエスト
     */
    private testPort(port: number, csrfToken: string): Promise<boolean> {
        return new Promise((resolve) => {
            const opts: https.RequestOptions = {
                hostname: '127.0.0.1',
                port,
                path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Connect-Protocol-Version': '1',
                    'X-Codeium-Csrf-Token': csrfToken,
                },
                rejectUnauthorized: false,
                timeout: 3000,
            };

            const req = https.request(opts, (res) => {
                let body = '';
                res.on('data', (c) => body += c);
                res.on('end', () => {
                    try {
                        JSON.parse(body);
                        resolve(true);
                    } catch {
                        resolve(false);
                    }
                });
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });

            req.write(JSON.stringify({}));
            req.end();
        });
    }
}
