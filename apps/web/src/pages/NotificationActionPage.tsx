import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../api/client";
import { formatApiError, ApiError } from "../lib/errors";
import { Button } from "../ui";

function peekActionId(token: string): string | undefined {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const json = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as { actionId?: unknown };
    return typeof payload.actionId === "string" ? payload.actionId : undefined;
  } catch {
    return undefined;
  }
}

export function NotificationActionPage() {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const token = search.token ?? "";
  const actionId = token ? peekActionId(token) : undefined;
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAcceptForm, setNeedsAcceptForm] = useState(
    actionId === "accept",
  );
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const runExecute = async (body: {
    token: string;
    name?: string;
    password?: string;
  }) => {
    setPending(true);
    setError(null);
    try {
      await api.executeNotificationAction(body);
      toast.success(t("notifications.actionSuccess"));
      void navigate({ to: "/" });
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === "INVALID_STATE" &&
        /name and password/i.test(err.message)
      ) {
        setNeedsAcceptForm(true);
        setError(null);
        return;
      }
      setError(formatApiError(err));
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    if (!token || started.current) return;
    if (actionId === "accept") {
      setNeedsAcceptForm(true);
      return;
    }
    started.current = true;
    void runExecute({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
  }, [token, actionId]);

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">
          {t("notifications.actionInvalidTitle")}
        </h1>
        <p className="text-sm text-[var(--app-muted)]">
          {t("notifications.actionInvalidBody")}
        </p>
        <Link
          to="/login"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("notifications.actionBack")}
        </Link>
      </div>
    );
  }

  if (needsAcceptForm) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("notifications.actionAcceptTitle")}
          </h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            {t("notifications.actionAcceptSubtitle")}
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void runExecute({ token, name, password });
          }}
        >
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              {t("notifications.actionName")}
            </label>
            <input
              id="name"
              className="w-full rounded border border-[var(--app-border)] bg-transparent px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium"
              htmlFor="password"
            >
              {t("notifications.actionPassword")}
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded border border-[var(--app-border)] bg-transparent px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
          <Button type="submit" isPending={pending} fullWidth>
            {t("notifications.actionSubmit")}
          </Button>
        </form>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">
          {t("notifications.actionFailedTitle")}
        </h1>
        <p className="text-sm text-red-700">{error}</p>
        <Link
          to="/"
          className="inline-block text-sm text-[var(--app-brand)] hover:underline"
        >
          {t("notifications.actionBack")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {t("notifications.actionRunning")}
      </h1>
      <p className="text-sm text-[var(--app-muted)]">
        {t("notifications.actionRunningBody")}
      </p>
    </div>
  );
}
