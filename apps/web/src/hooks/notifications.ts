import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type NotificationDto } from "../api/client";
import { getAccessToken, subscribeAccessToken } from "../auth/session";
import { env } from "../lib/env";
import { useApiContext } from "./masters";

const POLL_MS = 30_000;

export function useNotifications(enabled = true) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["notifications", ctx.orgId],
    queryFn: () => api.listNotifications(ctx, { limit: 30 }),
    enabled: enabled && Boolean(ctx.orgId) && Boolean(getAccessToken()),
  });
}

export function useUnreadNotificationCount(
  enabled = true,
  options?: { pollWhenDisconnected?: boolean; wsConnected?: boolean },
) {
  const ctx = useApiContext();
  const poll =
    options?.pollWhenDisconnected === true
      ? options.wsConnected
        ? false
        : POLL_MS
      : POLL_MS;
  return useQuery({
    queryKey: ["notifications", "unread-count", ctx.orgId],
    queryFn: async () => {
      const res = await api.unreadNotificationCount(ctx);
      return res.count;
    },
    enabled: enabled && Boolean(ctx.orgId) && Boolean(getAccessToken()),
    refetchInterval: poll,
  });
}

export function useMarkNotificationRead() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(ctx, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(ctx),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDismissNotification() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.dismissNotification(ctx, id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useExecuteNotificationAction() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { token: string; name?: string; password?: string }) =>
      api.executeNotificationAction(input, ctx.orgId ? ctx : undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Connects to notification WebSocket when authed; falls back to poll via
 * useUnreadNotificationCount's refetchInterval when disconnected.
 */
export function useNotificationSocket(onEvent?: (msg: unknown) => void) {
  const ctx = useApiContext();
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [tokenEpoch, setTokenEpoch] = useState(0);
  const backoffRef = useRef(1000);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => subscribeAccessToken(() => setTokenEpoch((n) => n + 1)), []);

  useEffect(() => {
    if (!ctx.orgId) {
      setConnected(false);
      return;
    }

    let closed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      const token = getAccessToken();
      if (!token) {
        setConnected(false);
        return;
      }
      const base = env.VITE_API_URL.replace(/^http/, "ws");
      const url = `${base}/api/v1/notifications/ws?access_token=${encodeURIComponent(token)}&orgId=${encodeURIComponent(ctx.orgId)}`;
      socket = new WebSocket(url);

      socket.onopen = () => {
        setConnected(true);
        backoffRef.current = 1000;
      };

      socket.onmessage = (event) => {
        let msg: unknown;
        try {
          msg = JSON.parse(String(event.data));
        } catch {
          return;
        }
        onEventRef.current?.(msg);
        const type =
          msg && typeof msg === "object" && "type" in msg
            ? String((msg as { type: string }).type)
            : "";
        if (
          type === "notification.created" ||
          type === "notification.read" ||
          type === "notifications.read_all" ||
          type === "unread-count"
        ) {
          void qc.invalidateQueries({ queryKey: ["notifications"] });
        }
        if (type === "unread-count" && msg && typeof msg === "object") {
          const count = (msg as { count?: number }).count;
          if (typeof count === "number") {
            qc.setQueryData(
              ["notifications", "unread-count", ctx.orgId],
              count,
            );
          }
        }
        if (type === "notification.created" && msg && typeof msg === "object") {
          const notification = (msg as { notification?: NotificationDto })
            .notification;
          if (notification) {
            // Only merge when server actions already carry tokens (or none).
            const serverActions = notification.actions.filter(
              (a) => a.kind === "server",
            );
            const tokensReady =
              serverActions.length === 0 ||
              serverActions.every((a) => Boolean(a.token));
            if (!tokensReady) return;
            qc.setQueryData(
              ["notifications", ctx.orgId],
              (prev: NotificationDto[] | undefined) => {
                if (!prev) return [notification];
                if (prev.some((n) => n.id === notification.id)) return prev;
                return [notification, ...prev];
              },
            );
          }
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (closed) return;
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, 30_000);
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [ctx.orgId, qc, tokenEpoch]);

  return { connected };
}

export function useNotificationPreferences(enabled = true) {
  const ctx = useApiContext();
  return useQuery({
    queryKey: ["notification-preferences", ctx.orgId],
    queryFn: () => api.getNotificationPreferences(ctx),
    enabled: enabled && Boolean(ctx.orgId) && Boolean(getAccessToken()),
  });
}

export function usePutNotificationPreferences() {
  const ctx = useApiContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      preferences: Array<{
        eventType: string;
        channel: "in_app" | "email";
        enabled: boolean;
      }>,
    ) => api.putNotificationPreferences(ctx, preferences),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: ["notification-preferences", ctx.orgId],
      });
    },
  });
}
