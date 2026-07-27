import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVerifyEmail } from "../hooks/auth";
import { formatApiError } from "../lib/errors";

export function VerifyEmailPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? "";
  const verify = useVerifyEmail();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verify.mutate(token, {
      onSuccess: () => {
        void navigate({
          to: "/login",
          search: { verified: "1" },
        });
      },
      onError: (err) => setError(formatApiError(err)),
    });
  }, [token, verify, navigate]);

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("auth.verify.invalidTitle")}</h1>
        <p className="text-sm text-[var(--app-muted)]">
          {t("auth.verify.invalidBody")}
        </p>
        <Link
          to="/login"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("auth.verify.backToLogin")}
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">{t("auth.verify.failedTitle")}</h1>
        <p className="text-sm text-red-700">{error}</p>
        <Link
          to="/login"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("auth.verify.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("auth.verify.workingTitle")}</h1>
      <p className="text-sm text-[var(--app-muted)]">
        {t("auth.verify.workingBody")}
      </p>
    </div>
  );
}
