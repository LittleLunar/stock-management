import { useTranslation } from "react-i18next";
import { setLocale, type Locale } from "../i18n";
import { Button, Dropdown, Icon } from "../ui";

const OPTIONS: { locale: Locale; labelKey: string }[] = [
  { locale: "en", labelKey: "language.en" },
  { locale: "th", labelKey: "language.th" },
];

export function LanguageMenu() {
  const { t, i18n } = useTranslation("common");
  const current: Locale = i18n.language?.startsWith("th") ? "th" : "en";
  const currentLabel = t(
    OPTIONS.find((o) => o.locale === current)?.labelKey ?? "language.en",
  );

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("language.label")}
          className="gap-1.5"
        >
          <Icon name="language" size={18} />
          <span className="hidden text-sm sm:inline">{currentLabel}</span>
          <Icon name="chevronDown" size={14} />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-32">
        <Dropdown.Menu
          selectionMode="single"
          selectedKeys={new Set([current])}
          onAction={(key) => {
            void setLocale(String(key) as Locale);
          }}
        >
          {OPTIONS.map(({ locale, labelKey }) => (
            <Dropdown.Item
              key={locale}
              id={locale}
              textValue={t(labelKey)}
              label={t(labelKey)}
            />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
