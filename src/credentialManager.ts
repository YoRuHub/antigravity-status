import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

export interface OAuthCredentials {
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
}

export class CredentialManager {
    private static readonly SECRET_KEY = 'antigravity.credentials';

    constructor(private context: vscode.ExtensionContext) { }

    async getCredentials(): Promise<OAuthCredentials | null> {
        // Always get fresh token from Protobuf (most reliable for cloudcode-pa API)
        const protobufCreds = await this.extractFromProtobuf();
        if (protobufCreds) {
            return protobufCreds;
        }

        // Fallback: try antigravityAuthStatus
        const dbCreds = await this.extractFromAuthStatus();
        if (dbCreds) {
            return dbCreds;
        }

        return null;
    }

    private async extractFromProtobuf(): Promise<OAuthCredentials | null> {
        const dbPath = this.getDBPath();
        if (!dbPath || !fs.existsSync(dbPath)) {
            return null;
        }

        const randomId = crypto.randomBytes(4).toString('hex');
        const tempDB = path.join(os.tmpdir(), `antigravity_state_${Date.now()}_${randomId}.vscdb`);

        try {
            fs.copyFileSync(dbPath, tempDB);

            const query = "SELECT value FROM ItemTable WHERE key = 'jetskiStateSync.agentManagerInitState'";
            const output = execSync(`sqlite3 "${tempDB}" "${query}"`, { encoding: 'utf8' }).trim();

            if (!output) {
                return null;
            }

            // Decode base64 protobuf
            const buffer = Buffer.from(output, 'base64');
            const accessToken = this.extractAccessTokenFromProtobuf(buffer);

            if (accessToken) {
                return {
                    accessToken,
                    refreshToken: '',
                    expiryDate: Date.now() + 60 * 60 * 1000 // 1 hour
                };
            }

            return null;
        } catch {
            return null;
        } finally {
            if (fs.existsSync(tempDB)) {
                fs.unlinkSync(tempDB);
            }
        }
    }

    private extractAccessTokenFromProtobuf(buffer: Buffer): string | null {
        try {
            // Find field 6 (OAuth data) in the protobuf
            const oauthData = this.findProtobufField(buffer, 6);
            if (!oauthData) {
                return null;
            }

            // Find field 1 (accessToken) in the OAuth message
            const accessToken = this.findProtobufField(oauthData, 1);
            if (accessToken) {
                return accessToken.toString('utf8');
            }

            return null;
        } catch {
            return null;
        }
    }

    private findProtobufField(buffer: Buffer, targetField: number): Buffer | null {
        let offset = 0;

        while (offset < buffer.length) {
            const { value: tag, newOffset: tagEnd } = this.readVarint(buffer, offset);
            if (tagEnd === offset) break;

            const wireType = tag & 0x07;
            const fieldNum = tag >> 3;
            offset = tagEnd;

            if (wireType === 2) { // Length-delimited
                const { value: length, newOffset: contentStart } = this.readVarint(buffer, offset);
                offset = contentStart;

                if (fieldNum === targetField) {
                    return buffer.slice(offset, offset + length);
                }

                offset += length;
            } else if (wireType === 0) { // Varint
                const { newOffset } = this.readVarint(buffer, offset);
                offset = newOffset;
            } else if (wireType === 1) { // 64-bit
                offset += 8;
            } else if (wireType === 5) { // 32-bit
                offset += 4;
            } else {
                break;
            }
        }

        return null;
    }

    private readVarint(buffer: Buffer, offset: number): { value: number; newOffset: number } {
        let result = 0;
        let shift = 0;
        let pos = offset;

        while (pos < buffer.length) {
            const byte = buffer[pos];
            result |= (byte & 0x7f) << shift;
            pos++;
            if ((byte & 0x80) === 0) {
                return { value: result, newOffset: pos };
            }
            shift += 7;
        }

        return { value: 0, newOffset: offset };
    }

    private async extractFromAuthStatus(): Promise<OAuthCredentials | null> {
        const dbPath = this.getDBPath();
        if (!dbPath || !fs.existsSync(dbPath)) {
            return null;
        }

        const randomId = crypto.randomBytes(4).toString('hex');
        const tempDB = path.join(os.tmpdir(), `antigravity_state_${Date.now()}_${randomId}.vscdb`);

        try {
            fs.copyFileSync(dbPath, tempDB);

            const query = "SELECT value FROM ItemTable WHERE key = 'antigravityAuthStatus'";
            const output = execSync(`sqlite3 "${tempDB}" "${query}"`, { encoding: 'utf8' }).trim();

            if (output) {
                const authStatus = JSON.parse(output);
                if (authStatus.apiKey) {
                    return {
                        accessToken: authStatus.apiKey,
                        refreshToken: '',
                        expiryDate: Date.now() + 60 * 60 * 1000
                    };
                }
            }

            return null;
        } catch {
            return null;
        } finally {
            if (fs.existsSync(tempDB)) {
                fs.unlinkSync(tempDB);
            }
        }
    }

    private getDBPath(): string | null {
        const home = os.homedir();
        switch (process.platform) {
            case 'darwin':
                return path.join(home, 'Library/Application Support/Antigravity/User/globalStorage/state.vscdb');
            case 'win32':
                return path.join(process.env.APPDATA || '', 'Antigravity/User/globalStorage/state.vscdb');
            default:
                return path.join(home, '.config/Antigravity/User/globalStorage/state.vscdb');
        }
    }
}
