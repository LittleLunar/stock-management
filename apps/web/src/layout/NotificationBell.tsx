import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button, Icon, Popover } from "../ui";
import type { NotificationDto } from "../api/client";
import {
  useDismissNotification,
  useExecuteNotificationAction,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationSocket,
  useNotifications,
  useUnreadNotificationCount,
} from "../hooks/notifications";

function relativeTime(iso: string, locale: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 48) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
}

function deepLinkOf(n: NotificationDto): string | undefined {
  const link = n.data?.deepLink;
  return typeof link === "string" ? link : undefined;
}

export function NotificationBell() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const list = useNotifications();
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const dismiss = useDismissNotification();
  const execute = useExecuteNotificationAction();
  useNotificationSocket();

  const count = unread.data ?? 0;
  const items = useMemo(
    () => (list.data ?? []).filter((n) => !n.dismissedAt),
    [list.data],
  );

  const onOpen = async (n: NotificationDto) => {
    if (!n.readAt) {
      await markRead.mutateAsync(n.id);
    }
    const link = deepLinkOf(n);
    if (link?.startsWith("/")) {
      void navigate({ to: link });
    }
  };

  const onServerAction = async (n: NotificationDto, actionId: string) => {
    const action = n.actions.find((a) => a.id === actionId);
    if (!action?.token) return;
    if (actionId === "accept") {
      const link = deepLinkOf(n) ?? "/accept-invite";
      if (link.startsWith("/")) void navigate({ to: link });
      return;
    }
    await execute.mutateAsync({ token: action.token });
  };

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          isIconOnly
          variant="ghost"
          size="sm"
          aria-label={t("notifications.label")}
          className="relative"
        >
          <Icon name="notification" size={20} />
          {count > 0 ? (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--app-danger,#b91c1c)] px-1 text-[10px] font-semibold text-white"
              aria-label={t("notifications.unreadCount", { count })}
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Content placement="bottom end" className="min-w-72 max-w-sm">
        <Popover.Dialog className="p-0">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] px-3 py-2">
            <Popover.Heading className="text-sm font-semibold">
              {t("notifications.label")}
            </Popover.Heading>
            <Button
              size="sm"
              variant="ghost"
              isDisabled={count === 0 || markAll.isPending}
              onPress={() => markAll.mutate()}
            >
              {t("notifications.markAllRead")}
            </Button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-4 text-sm text-[var(--app-muted)]">
                {t("notifications.empty")}
              </li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`border-b border-[var(--app-border)] px-3 py-2 last:border-b-0 ${
                    n.readAt ? "opacity-70" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => void onOpen(n)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--app-fg)]">
                        {n.title}
                      </p>
                      <span
                        role="button"
                        tabIndex={0}
                        className="shrink-0 cursor-pointer text-xs text-[var(--app-muted)] hover:text-[var(--app-fg)]"
                        aria-label={t("notifications.dismiss")}
                        onClick={(e) => {
                          e.stopPropagation();
                          dismiss.mutate(n.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.stopPropagation();
                            dismiss.mutate(n.id);
                          }
                        }}
                      >
                        ×
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--app-muted)]">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--app-muted)]">
                      {relativeTime(n.createdAt, i18n.language)}
                    </p>
                  </button>
                  {n.actions.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {n.actions.map((action) => (
                        <Button
                          key={action.id}
                          size="sm"
                          variant={
                            action.id === "reject" || action.id === "decline"
                              ? "outline"
                              : "secondary"
                          }
                          isPending={execute.isPending}
                          onPress={() => {
                            if (action.kind === "open") {
                              void onOpen(n);
                              return;
                            }
                            void onServerAction(n, action.id);
                          }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
