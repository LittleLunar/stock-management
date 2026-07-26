import "dotenv/config";
import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { HealthResponseSchema } from "@stock-management/shared";
import { loadEnv } from "./infrastructure/config/env.js";
import { createDb } from "./infrastructure/db/client.js";
import { createAppServices } from "./main/composition-root.js";
import { registerErrorHandler } from "./interfaces/plugins/error-handler.js";
import { contextPlugin } from "./interfaces/plugins/context.js";
import { requestIdPlugin } from "./interfaces/plugins/request-id.js";
import { orgRoutes } from "./interfaces/http/org.routes.js";
import { branchesRoutes } from "./interfaces/http/branches.routes.js";
import { locationsRoutes } from "./interfaces/http/locations.routes.js";
import { categoriesRoutes } from "./interfaces/http/categories.routes.js";
import { productsRoutes } from "./interfaces/http/products.routes.js";
import { suppliersRoutes } from "./interfaces/http/suppliers.routes.js";
import { usersRoutes } from "./interfaces/http/users.routes.js";
import { purchaseOrdersRoutes } from "./interfaces/http/purchase-orders.routes.js";
import { goodsReceiptsRoutes } from "./interfaces/http/goods-receipts.routes.js";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
const services = createAppServices(db);

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

app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Org-Id, X-User-Id, X-Request-Id",
  );
  reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  if (request.method === "OPTIONS") {
    return reply.status(204).send();
  }
});

app.get("/health", async () => {
  return HealthResponseSchema.parse({ ok: true as const });
});

await app.register(contextPlugin);
await app.register(orgRoutes(services.org), { prefix: "/api/v1" });
await app.register(branchesRoutes(services.branches), { prefix: "/api/v1" });
await app.register(locationsRoutes(services.locations), { prefix: "/api/v1" });
await app.register(categoriesRoutes(services.categories), {
  prefix: "/api/v1",
});
await app.register(productsRoutes(services.products), { prefix: "/api/v1" });
await app.register(suppliersRoutes(services.suppliers), { prefix: "/api/v1" });
await app.register(usersRoutes(services.users), { prefix: "/api/v1" });
await app.register(purchaseOrdersRoutes(services.purchaseOrders), {
  prefix: "/api/v1",
});
await app.register(goodsReceiptsRoutes(services), { prefix: "/api/v1" });

await app.listen({ port: env.PORT, host: "0.0.0.0" });
