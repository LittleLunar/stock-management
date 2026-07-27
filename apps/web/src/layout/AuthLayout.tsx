import { Link, Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageMenu } from "../layout/LanguageMenu";

/** Public auth shell — brand + language only (no sidebar). */
export function AuthLayout() {
  const { t } = useTranslation("common");

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-canvas)] text-[var(--app-ink)]">
      <header className="flex h-14 items-center gap-3 border-b border-[var(--app-border)] bg-[var(--app-surface)] px-4">
        <Link
          to="/login"
          className="text-sm font-semibold tracking-[0.14em] text-[var(--app-brand)] uppercase"
        >
          {t("brand.name")}
        </Link>
        <div className="ml-auto">
          <LanguageMenu />
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
