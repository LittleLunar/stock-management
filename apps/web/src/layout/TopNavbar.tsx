import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "../ui";
import { AccountMenu } from "./AccountMenu";
import { LanguageMenu } from "./LanguageMenu";
import { NotificationBell } from "./NotificationBell";

type TopNavbarProps = {
  onOpenNav?: () => void;
  showMenuButton?: boolean;
};

export function TopNavbar({ onOpenNav, showMenuButton }: TopNavbarProps) {
  const { t } = useTranslation("common");

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 sm:px-4">
      {showMenuButton ? (
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={t("nav.openMenu")}
          onPress={onOpenNav}
          className="md:hidden"
        >
          <Icon name="menu" size={22} />
        </Button>
      ) : null}

      <Link
        to="/"
        className="text-sm font-semibold tracking-[0.14em] text-[var(--app-brand)] uppercase"
      >
        {t("brand.name")}
      </Link>

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
        <LanguageMenu />
        <AccountMenu />
      </div>
    </header>
  );
}
