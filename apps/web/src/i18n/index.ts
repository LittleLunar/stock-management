import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enNav from "./locales/en/nav.json";
import enErrors from "./locales/en/errors.json";
import enAuth from "./locales/en/auth.json";
import enMasters from "./locales/en/masters.json";
import enInventory from "./locales/en/inventory.json";
import enPurchasing from "./locales/en/purchasing.json";
import enCosting from "./locales/en/costing.json";
import enAccounting from "./locales/en/accounting.json";
import enSettings from "./locales/en/settings.json";

import thCommon from "./locales/th/common.json";
import thNav from "./locales/th/nav.json";
import thErrors from "./locales/th/errors.json";
import thAuth from "./locales/th/auth.json";
import thMasters from "./locales/th/masters.json";
import thInventory from "./locales/th/inventory.json";
import thPurchasing from "./locales/th/purchasing.json";
import thCosting from "./locales/th/costing.json";
import thAccounting from "./locales/th/accounting.json";
import thSettings from "./locales/th/settings.json";

export const SUPPORTED_LOCALES = ["en", "th"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = "locale";

const resources = {
  en: {
    common: enCommon,
    nav: enNav,
    errors: enErrors,
    auth: enAuth,
    masters: enMasters,
    inventory: enInventory,
    purchasing: enPurchasing,
    costing: enCosting,
    accounting: enAccounting,
    settings: enSettings,
  },
  th: {
    common: thCommon,
    nav: thNav,
    errors: thErrors,
    auth: thAuth,
    masters: thMasters,
    inventory: thInventory,
    purchasing: thPurchasing,
    costing: thCosting,
    accounting: thAccounting,
    settings: thSettings,
  },
} as const;

export const NAMESPACES = [
  "common",
  "nav",
  "errors",
  "auth",
  "masters",
  "inventory",
  "purchasing",
  "costing",
  "accounting",
  "settings",
] as const;

function isLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getStoredLocale(): Locale {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && isLocale(stored)) return stored;
  return "en";
}

export function syncDocumentLang(locale: Locale): void {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
}

export async function setLocale(locale: Locale): Promise<void> {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
  syncDocumentLang(locale);
  await i18n.changeLanguage(locale);
}

export function getLocale(): Locale {
  const lang = i18n.language?.split("-")[0] ?? "en";
  return isLocale(lang) ? lang : "en";
}

const initialLocale = getStoredLocale();
syncDocumentLang(initialLocale);

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: "en",
  supportedLngs: [...SUPPORTED_LOCALES],
  ns: [...NAMESPACES],
  defaultNS: "common",
  // Flat dotted keys like "nav.products" — do not nest on "."
  keySeparator: false,
  nsSeparator: ":",
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
  parseMissingKeyHandler: (key) => {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing key: ${key}`);
    }
    return key;
  },
});

export default i18n;
