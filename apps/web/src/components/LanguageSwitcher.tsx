import { useTranslation } from "react-i18next";
import { setLocale, type Locale } from "../i18n";

const OPTIONS: { locale: Locale; labelKey: string }[] = [
  { locale: "en", labelKey: "language.en" },
  { locale: "th", labelKey: "language.th" },
];

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation("common");
  const current: Locale = i18n.language?.startsWith("th") ? "th" : "en";

  return (
    <label className="mt-4 block text-xs text-slate-500">
      {t("language.label")}
      <select
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
        value={current}
        aria-label={t("language.label")}
        onChange={(e) => {
          void setLocale(e.target.value as Locale);
        }}
      >
        {OPTIONS.map(({ locale, labelKey }) => (
          <option key={locale} value={locale}>
            {t(labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
