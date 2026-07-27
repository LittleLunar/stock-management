import { getLocale, type Locale } from "./index";

const INTL_LOCALES: Record<Locale, string> = {
  en: "en-US",
  th: "th-TH",
};

export function intlLocale(locale: Locale = getLocale()): string {
  return INTL_LOCALES[locale];
}

export function formatDateTime(
  value: string | number | Date,
  locale: Locale = getLocale(),
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(
  value: string | number | Date,
  locale: Locale = getLocale(),
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "short",
  }).format(new Date(value));
}

export function formatNumber(
  value: number,
  locale: Locale = getLocale(),
): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}
