// i18nConfig.d.ts
export interface I18nConfig {
    defaultLocale: string;
    locales: string[];
}

declare const i18nConfig: I18nConfig;

export default i18nConfig;