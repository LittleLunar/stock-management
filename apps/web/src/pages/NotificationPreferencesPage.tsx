import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { NotificationPreferenceDto } from "../api/client";
import {
  useNotificationPreferences,
  usePutNotificationPreferences,
} from "../hooks/notifications";
import { formatApiError } from "../lib/errors";
import { Button } from "../ui";

const EVENT_ORDER = [
  "user.welcome",
  "user.email_verified",
  "auth.password_changed",
  "membership.invite_received",
  "membership.invite_accepted",
  "membership.invite_declined",
  "document.posted",
  "document.voided",
  "stock.low",
  "approval.assigned",
] as const;

const CHANNELS = ["in_app", "email"] as const;

type Channel = (typeof CHANNELS)[number];

function preferenceKey(eventType: string, channel: Channel): string {
  return `${eventType}:${channel}`;
}

function buildMap(
  rows: NotificationPreferenceDto[] | undefined,
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const row of rows ?? []) {
    map.set(preferenceKey(row.eventType, row.channel), row.enabled);
  }
  return map;
}

export function NotificationPreferencesPage() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { data, isLoading, error } = useNotificationPreferences();
  const put = usePutNotificationPreferences();
  const serverMap = useMemo(() => buildMap(data), [data]);
  const [draft, setDraft] = useState<Map<string, boolean> | null>(null);
  const effective = draft ?? serverMap;

  useEffect(() => {
    setDraft(null);
  }, [data]);

  const dirty = useMemo(() => {
    if (!draft) return false;
    for (const eventType of EVENT_ORDER) {
      for (const channel of CHANNELS) {
        const key = preferenceKey(eventType, channel);
        if ((draft.get(key) ?? false) !== (serverMap.get(key) ?? false)) {
          return true;
        }
      }
    }
    return false;
  }, [draft, serverMap]);

  const setEnabled = (
    eventType: string,
    channel: Channel,
    enabled: boolean,
  ) => {
    setDraft((prev) => {
      const next = new Map(prev ?? serverMap);
      next.set(preferenceKey(eventType, channel), enabled);
      return next;
    });
  };

  const onSave = () => {
    const preferences = EVENT_ORDER.flatMap((eventType) =>
      CHANNELS.map((channel) => ({
        eventType,
        channel,
        enabled: effective.get(preferenceKey(eventType, channel)) ?? false,
      })),
    );
    put.mutate(preferences, {
      onSuccess: () => {
        toast.success(t("settings.notificationPreferences.saveSuccess"));
      },
      onError: (err) => toast.error(formatApiError(err)),
    });
  };

  if (isLoading) {
    return <p>{t("settings.notificationPreferences.loading")}</p>;
  }
  if (error) {
    return <p className="text-red-700">{formatApiError(error)}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("settings.notificationPreferences.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">
            {t("settings.notificationPreferences.description")}
          </p>
        </div>
        <Button
          onPress={onSave}
          isDisabled={!dirty || put.isPending}
          isPending={put.isPending}
        >
          {put.isPending ? tc("actions.saving") : tc("actions.save")}
        </Button>
      </div>

      <div className="overflow-x-auto rounded border border-[var(--app-border)] bg-[var(--app-surface)]">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-[var(--app-border)] text-[var(--app-muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">
                {t("settings.notificationPreferences.col.event")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("settings.notificationPreferences.channel.inApp")}
              </th>
              <th className="px-4 py-3 font-medium">
                {t("settings.notificationPreferences.channel.email")}
              </th>
            </tr>
          </thead>
          <tbody>
            {EVENT_ORDER.map((eventType) => (
              <tr
                key={eventType}
                className="border-b border-[var(--app-border)] last:border-b-0"
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-[var(--app-fg)]">
                    {t(`settings.notificationPreferences.event.${eventType}`)}
                  </div>
                  <div className="text-xs text-[var(--app-muted)]">
                    {eventType}
                  </div>
                </td>
                {CHANNELS.map((channel) => {
                  const key = preferenceKey(eventType, channel);
                  const checked = effective.get(key) ?? false;
                  return (
                    <td key={channel} className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-[var(--app-border)]"
                          checked={checked}
                          disabled={put.isPending}
                          onChange={(e) =>
                            setEnabled(eventType, channel, e.target.checked)
                          }
                          aria-label={`${t(
                            `settings.notificationPreferences.event.${eventType}`,
                          )} — ${t(
                            `settings.notificationPreferences.channel.${
                              channel === "in_app" ? "inApp" : "email"
                            }`,
                          )}`}
                        />
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
