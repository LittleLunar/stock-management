import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { restoreSession } from "../auth/restore";
import { redirectToLogin } from "../auth/session";
import { AppShell } from "./AppShell";

/** Authed app: restore session + org from /me, else redirect to /login?next=. */
export function RequireAuth() {
  const { t } = useTranslation("auth");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await restoreSession();
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
