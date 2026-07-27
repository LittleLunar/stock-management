import type { ExpireReservations } from "@stock-management/application";
import type { OutboxPollerLog } from "./outbox-poller.js";

/** In-process interval poller; start/stop from API lifecycle. */
export class ReservationExpirePoller {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(
    private readonly expire: ExpireReservations,
    private readonly opts: { intervalMs: number; log: OutboxPollerLog },
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.safeTick();
    }, this.opts.intervalMs);
    if (typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<number> {
    const n = await this.expire.execute(new Date());
    if (n > 0) {
      this.opts.log.info({ released: n }, "expired reservations released");
    }
    return n;
  }

  private async safeTick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      await this.tick();
    } catch (err) {
      this.opts.log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "reservation expire tick failed",
      );
    } finally {
      this.ticking = false;
    }
  }
}
