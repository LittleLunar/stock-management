import type { WebSocket } from "ws";
import type {
  NotificationPublisher,
  NotificationRealtimeMessage,
} from "@stock-management/application";

function roomKey(userId: string, orgId: string): string {
  return `${userId}:${orgId}`;
}

type SocketEntry = {
  socket: WebSocket;
  userId: string;
  orgId: string;
};

/**
 * In-process WebSocket fan-out for notification realtime events.
 * Rooms are keyed by userId+orgId.
 */
export class WsNotificationHub implements NotificationPublisher {
  private readonly rooms = new Map<string, Set<SocketEntry>>();

  subscribe(userId: string, orgId: string, socket: WebSocket): void {
    const key = roomKey(userId, orgId);
    let set = this.rooms.get(key);
    if (!set) {
      set = new Set();
      this.rooms.set(key, set);
    }
    const entry: SocketEntry = { socket, userId, orgId };
    set.add(entry);

    const cleanup = () => {
      set!.delete(entry);
      if (set!.size === 0) this.rooms.delete(key);
    };
    socket.on("close", cleanup);
    socket.on("error", cleanup);
  }

  publish(
    userId: string,
    orgId: string,
    message: NotificationRealtimeMessage,
  ): void {
    const set = this.rooms.get(roomKey(userId, orgId));
    if (!set || set.size === 0) return;
    const payload = JSON.stringify(serializeMessage(message));
    for (const entry of set) {
      if (entry.socket.readyState === entry.socket.OPEN) {
        entry.socket.send(payload);
      }
    }
  }
}

function serializeMessage(message: NotificationRealtimeMessage): unknown {
  if (message.type === "notification.created") {
    const n = message.notification;
    const actions = n.actions.map((action) => {
      const token = message.actionTokens?.[action.id];
      return token ? { ...action, token } : action;
    });
    return {
      type: message.type,
      notification: {
        id: n.id,
        orgId: n.orgId,
        userId: n.userId,
        eventType: n.eventType,
        title: n.title,
        body: n.body,
        data: n.data,
        actions,
        readAt: n.readAt?.toISOString() ?? null,
        dismissedAt: n.dismissedAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      },
    };
  }
  return message;
}
