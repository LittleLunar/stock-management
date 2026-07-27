import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import {
  EnsureDefaultChartOfAccounts,
  ProcessOutboxForJournals,
  ProcessOutboxForWebhooks,
  ProcessOutboxForNotifications,
  BaseNotificationChannel,
  InAppChannelDecorator,
  EmailChannelDecorator,
  type HttpPoster,
} from "@stock-management/application";
import { HealthResponseSchema } from "@stock-management/shared";
import { loadEnv } from "./infrastructure/config/env.js";
import { createDb } from "./infrastructure/db/client.js";
import { DrizzleOutboxRepository } from "./infrastructure/persistence/outbox.repository.js";
import { DrizzleAccountingRepository } from "./infrastructure/persistence/accounting.repository.js";
import { DrizzleWebhookRepository } from "./infrastructure/persistence/webhook.repository.js";
import { DrizzleNotificationRepository } from "./infrastructure/persistence/notification.repository.js";
import { DrizzleNotificationPreferenceRepository } from "./infrastructure/persistence/notification-preference.repository.js";
import { DrizzleNotificationRecipientDirectory } from "./infrastructure/persistence/notification-recipient.directory.js";
import {
  createMailer,
  Sha256OpaqueTokenService,
} from "./infrastructure/auth/index.js";
import { RotatingInviteAcceptLinkResolver } from "./infrastructure/notifications/invite-accept-link.js";
import { DrizzleMembershipInviteStore } from "./infrastructure/persistence/membership-invite.repository.js";
import { OutboxPoller } from "./infrastructure/workers/outbox-poller.js";
import { ReservationExpirePoller } from "./infrastructure/workers/reservation-expire-poller.js";
import { createAppServices } from "./main/composition-root.js";
import { registerErrorHandler } from "./interfaces/plugins/error-handler.js";
import { createContextPlugin } from "./interfaces/plugins/context.js";
import { requestIdPlugin } from "./interfaces/plugins/request-id.js";
import { authRoutes } from "./interfaces/http/auth.routes.js";
import { orgRoutes } from "./interfaces/http/org.routes.js";
import { branchesRoutes } from "./interfaces/http/branches.routes.js";
import { locationsRoutes } from "./interfaces/http/locations.routes.js";
import { categoriesRoutes } from "./interfaces/http/categories.routes.js";
import { productsRoutes } from "./interfaces/http/products.routes.js";
import { suppliersRoutes } from "./interfaces/http/suppliers.routes.js";
import { customersRoutes } from "./interfaces/http/customers.routes.js";
import { usersRoutes } from "./interfaces/http/users.routes.js";
import { membershipInviteRoutes } from "./interfaces/http/membership-invites.routes.js";
import {
  notificationActionRoutes,
  notificationsRoutes,
  notificationWsRoutes,
} from "./interfaces/http/notifications.routes.js";
import { approvalPoliciesRoutes } from "./interfaces/http/approval-policies.routes.js";
import { webhooksRoutes } from "./interfaces/http/webhooks.routes.js";
import { purchaseOrdersRoutes } from "./interfaces/http/purchase-orders.routes.js";
import { goodsReceiptsRoutes } from "./interfaces/http/goods-receipts.routes.js";
import { stockRoutes } from "./interfaces/http/stock.routes.js";
import { stockIssuesRoutes } from "./interfaces/http/stock-issues.routes.js";
import { stockTransfersRoutes } from "./interfaces/http/stock-transfers.routes.js";
import { stockAdjustmentsRoutes } from "./interfaces/http/stock-adjustments.routes.js";
import { stockCountsRoutes } from "./interfaces/http/stock-counts.routes.js";
import { reservationsRoutes } from "./interfaces/http/reservations.routes.js";
import { availabilityRoutes } from "./interfaces/http/availability.routes.js";
import { supplierReturnsRoutes } from "./interfaces/http/supplier-returns.routes.js";
import { customerReturnsRoutes } from "./interfaces/http/customer-returns.routes.js";
import { landedCostsRoutes } from "./interfaces/http/landed-costs.routes.js";
import { costRevaluationsRoutes } from "./interfaces/http/cost-revaluations.routes.js";
import { costReportsRoutes } from "./interfaces/http/cost-reports.routes.js";
import { accountingRoutes } from "./interfaces/http/accounting.routes.js";
import { financialReportsRoutes } from "./interfaces/http/financial-reports.routes.js";
import {
  apReportsRoutes,
  supplierInvoicesRoutes,
} from "./interfaces/http/supplier-invoices.routes.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const services = createAppServices(db, env);

const httpPoster: HttpPoster = async (url, init) => {
  const res = await fetch(url, init);
  const bodyText = await res.text();
  return { status: res.status, bodyText };
};

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, translateTime: "HH:MM:ss" },
          },
        }
      : {}),
  },
  genReqId: (req) => {
    const incoming = req.headers["x-request-id"];
    if (typeof incoming === "string" && incoming.trim()) return incoming.trim();
    return randomUUID();
  },
});

registerErrorHandler(app);
await app.register(requestIdPlugin);
await app.register(cookie);
await app.register(websocket);
await app.register(cors, {
  origin: env.WEB_ORIGIN,
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Org-Id",
    "X-Branch-Id",
    "X-Request-Id",
    ...(env.AUTH_STUB ? ["X-User-Id"] : []),
  ],
  methods: ["GET", "POST", "PATCH", "PUT", "OPTIONS"],
});

app.get("/health", async () => {
  return HealthResponseSchema.parse({ ok: true as const });
});

await app.register(
  authRoutes(services.auth, {
    cookieName: env.REFRESH_COOKIE_NAME,
    secureCookies: env.NODE_ENV === "production",
    accessTokenVerifier: services.accessTokens,
  }),
  { prefix: "/api/v1" },
);

await app.register(
  createContextPlugin({
    membershipAccess: services.membershipAccess,
    accessTokens: services.accessTokens,
    authStub: env.AUTH_STUB,
  }),
);

await app.register(orgRoutes(services.org), { prefix: "/api/v1" });
await app.register(branchesRoutes(services.branches), { prefix: "/api/v1" });
await app.register(locationsRoutes(services.locations), { prefix: "/api/v1" });
await app.register(categoriesRoutes(services.categories), {
  prefix: "/api/v1",
});
await app.register(productsRoutes(services.products), { prefix: "/api/v1" });
await app.register(suppliersRoutes(services.suppliers), { prefix: "/api/v1" });
await app.register(customersRoutes(services.customers), { prefix: "/api/v1" });
await app.register(usersRoutes(services.users), { prefix: "/api/v1" });
await app.register(membershipInviteRoutes(services.membershipInvites), {
  prefix: "/api/v1",
});
await app.register(
  notificationsRoutes(services.notifications, {
    actionTokens: services.actionTokens,
  }),
  { prefix: "/api/v1" },
);
await app.register(notificationActionRoutes(services.executeNotificationAction), {
  prefix: "/api/v1",
});
await app.register(
  notificationWsRoutes({
    accessTokens: services.accessTokens,
    hub: services.notificationHub,
    membershipAccess: services.membershipAccess,
  }),
  { prefix: "/api/v1" },
);
await app.register(purchaseOrdersRoutes(services.purchaseOrders), {
  prefix: "/api/v1",
});
await app.register(approvalPoliciesRoutes(services.approvalPolicies), {
  prefix: "/api/v1",
});
await app.register(webhooksRoutes(services.webhookSubscriptions), {
  prefix: "/api/v1",
});
await app.register(goodsReceiptsRoutes(services), { prefix: "/api/v1" });
await app.register(stockRoutes(services.stockInquiry, services.costInquiry), {
  prefix: "/api/v1",
});
await app.register(stockIssuesRoutes(services), { prefix: "/api/v1" });
await app.register(stockTransfersRoutes(services), { prefix: "/api/v1" });
await app.register(stockAdjustmentsRoutes(services), { prefix: "/api/v1" });
await app.register(stockCountsRoutes(services), { prefix: "/api/v1" });
await app.register(reservationsRoutes(services), { prefix: "/api/v1" });
await app.register(availabilityRoutes(services.availability), {
  prefix: "/api/v1",
});
await app.register(supplierReturnsRoutes(services), { prefix: "/api/v1" });
await app.register(customerReturnsRoutes(services), { prefix: "/api/v1" });
await app.register(landedCostsRoutes(services), { prefix: "/api/v1" });
await app.register(costRevaluationsRoutes(services), { prefix: "/api/v1" });
await app.register(costReportsRoutes(services), { prefix: "/api/v1" });
await app.register(accountingRoutes(services), { prefix: "/api/v1" });
await app.register(financialReportsRoutes({
  trialBalance: services.trialBalance,
  pnl: services.pnlReport,
  balanceSheet: services.balanceSheet,
}), { prefix: "/api/v1" });
await app.register(supplierInvoicesRoutes(services), { prefix: "/api/v1" });
await app.register(apReportsRoutes(services.apAging), { prefix: "/api/v1" });

const outboxPoller = env.OUTBOX_POLLER_ENABLED
  ? new OutboxPoller({
      intervalMs: env.OUTBOX_POLLER_INTERVAL_MS,
      log: app.log,
      runInTransaction: (fn) =>
        db.transaction(async (tx) => {
          const store = new DrizzleOutboxRepository(tx);
          const accounting = new DrizzleAccountingRepository(tx);
          const processor = new ProcessOutboxForJournals(
            accounting,
            new EnsureDefaultChartOfAccounts(accounting),
          );
          const webhooks = new ProcessOutboxForWebhooks(
            new DrizzleWebhookRepository(tx),
            httpPoster,
          );
          const notificationRepo = new DrizzleNotificationRepository(tx);
          const preferenceRepo = new DrizzleNotificationPreferenceRepository(
            tx,
          );
          const notificationChannel = new InAppChannelDecorator(
            new EmailChannelDecorator(
              new BaseNotificationChannel(),
              createMailer(env),
              preferenceRepo,
              {
                appPublicUrl: env.APP_PUBLIC_URL,
                inviteAcceptLinks: new RotatingInviteAcceptLinkResolver(
                  new DrizzleMembershipInviteStore(db),
                  new Sha256OpaqueTokenService(),
                  env.APP_PUBLIC_URL,
                ),
                actionTokens: services.actionTokens,
              },
            ),
            notificationRepo,
            preferenceRepo,
            services.notificationHub,
          );
          const notifications = new ProcessOutboxForNotifications(
            notificationChannel,
            new DrizzleNotificationRecipientDirectory(tx),
          );
          return fn({
            store,
            processJournal: async (event) => {
              await processor.execute(event);
            },
            processWebhooks: async (event) => {
              await webhooks.execute(event);
            },
            processNotifications: async (event) => {
              await notifications.execute(event);
            },
          });
        }),
    })
  : null;

if (outboxPoller) {
  outboxPoller.start();
  app.log.info(
    { intervalMs: env.OUTBOX_POLLER_INTERVAL_MS },
    "outbox poller started",
  );
  app.addHook("onClose", async () => {
    outboxPoller.stop();
    app.log.info("outbox poller stopped");
  });
}

const reservationExpirePoller = env.RESERVATION_EXPIRE_ENABLED
  ? new ReservationExpirePoller(services.expireReservations, {
      intervalMs: env.RESERVATION_EXPIRE_INTERVAL_MS,
      log: app.log,
    })
  : null;

if (reservationExpirePoller) {
  reservationExpirePoller.start();
  app.log.info(
    { intervalMs: env.RESERVATION_EXPIRE_INTERVAL_MS },
    "reservation expire poller started",
  );
  app.addHook("onClose", async () => {
    reservationExpirePoller.stop();
    app.log.info("reservation expire poller stopped");
  });
}

await app.listen({ port: env.PORT, host: "0.0.0.0" });
