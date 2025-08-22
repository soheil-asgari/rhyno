import i18nConfig from "@/i18nConfig.js"
import { createInstance } from "i18next"
import { initReactI18next } from "react-i18next/initReactI18next"

export default async function initTranslations(
  locale: string,
  namespaces: string[],
  i18nInstance?: any,
  resources?: any
) {
  i18nInstance = i18nInstance || createInstance()

  i18nInstance.use(initReactI18next)

  // چون فقط یه زبان داریم، نیازی به بارگذاری فایل‌های ترجمه نیست
  await i18nInstance.init({
    lng: locale || i18nConfig.defaultLocale,
    resources: resources || {},
    fallbackLng: i18nConfig.defaultLocale,
    supportedLngs: i18nConfig.locales,
    defaultNS: namespaces[0] || "common",
    fallbackNS: namespaces[0] || "common",
    ns: namespaces || ["common"]
  })

  return {
    i18n: i18nInstance,
    resources: i18nInstance.services.resourceStore.data,
    t: i18nInstance.t
  }
}
