import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ensureAccessToken } from "../auth/refresh";
import { getAccessToken, redirectToLogin } from "../auth/session";
import { AppShell } from "./AppShell";

/** Authed app: ensure session (refresh once), else redirect to /login?next=. */
export function RequireAuth() {
  const { t } = useTranslation("auth");
  const [ready, setReady] = useState(() => Boolean(getAccessToken()));

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (getAccessToken()) {
        if (!cancelled) setReady(true);
        return;
      }
      const ok = await ensureAccessToken();
      if (cancelled) return;
      if (!ok) {
        redirectToLogin();
        return;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-canvas)] text-[var(--app-muted)]">
        {t("auth.session.checking")}
      </div>
    );
  }

  return <AppShell />;
}
