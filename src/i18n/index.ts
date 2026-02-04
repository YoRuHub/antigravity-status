import * as vscode from 'vscode';
import { translations, TranslationKeys, Language } from './translations';

class I18nManager {
    private currentLanguage: Language = 'en';

    constructor() {
        this.updateLanguage();
    }

    /**
     * Update current language based on setting or VS Code environment
     */
    public updateLanguage(): void {
        const config = vscode.workspace.getConfiguration('antigravityStatus');
        const setLanguage = config.get<string>('language', 'Auto');

        if (setLanguage === 'English') {
            this.currentLanguage = 'en';
        } else if (setLanguage === 'Japanese') {
            this.currentLanguage = 'ja';
        } else {
            // Auto: Follow VS Code setting
            const lang = vscode.env.language;
            if (lang.startsWith('ja')) {
                this.currentLanguage = 'ja';
            } else {
                this.currentLanguage = 'en';
            }
        }
    }

    /**
     * Get translated string
     */
    public t(key: TranslationKeys, ...args: any[]): string {
        let text: string = (translations[this.currentLanguage] as any)[key] || (translations.en as any)[key] || key;

        // Replace placeholders {0}, {1}, etc.
        if (args.length > 0) {
            args.forEach((arg, index) => {
                text = text.replace(`{${index}}`, String(arg));
            });
        }

        return text;
    }

    /**
     * Get current language
     */
    public getLanguage(): Language {
        return this.currentLanguage;
    }
}

export const i18n = new I18nManager();
