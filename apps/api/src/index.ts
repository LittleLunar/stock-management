import "dotenv/config";
import Fastify from "fastify";
import { HealthResponseSchema } from "@stock-management/shared";
import { createDb } from "./infrastructure/db/client.js";
import { createAppServices } from "./main/composition-root.js";
import { registerErrorHandler } from "./interfaces/plugins/error-handler.js";
import { contextPlugin } from "./interfaces/plugins/context.js";
import { orgRoutes } from "./interfaces/http/org.routes.js";
import { branchesRoutes } from "./interfaces/http/branches.routes.js";
import { locationsRoutes } from "./interfaces/http/locations.routes.js";
import { categoriesRoutes } from "./interfaces/http/categories.routes.js";
import { productsRoutes } from "./interfaces/http/products.routes.js";
import { suppliersRoutes } from "./interfaces/http/suppliers.routes.js";
import { usersRoutes } from "./interfaces/http/users.routes.js";

const port = Number(process.env.PORT ?? 3001);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/stock_management";

const db = createDb(databaseUrl);
const services = createAppServices(db);

const app = Fastify({ logger: true });

registerErrorHandler(app);

app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Org-Id, X-User-Id",
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
await app.register(categoriesRoutes(services.categories), { prefix: "/api/v1" });
await app.register(productsRoutes(services.products), { prefix: "/api/v1" });
await app.register(suppliersRoutes(services.suppliers), { prefix: "/api/v1" });
await app.register(usersRoutes(services.users), { prefix: "/api/v1" });

await app.listen({ port, host: "0.0.0.0" });
