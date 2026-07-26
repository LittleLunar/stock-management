import "dotenv/config";
import Fastify from "fastify";
import { HealthResponseSchema } from "@stock-management/shared";
import { createDb } from "./db/client.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { contextPlugin } from "./plugins/context.js";
import { BranchRepository } from "./modules/branches/branches.repository.js";
import { BranchService } from "./modules/branches/branches.service.js";
import { branchesRoutes } from "./modules/branches/branches.routes.js";
import { LocationRepository } from "./modules/locations/locations.repository.js";
import { LocationService } from "./modules/locations/locations.service.js";
import { locationsRoutes } from "./modules/locations/locations.routes.js";
import { OrgRepository } from "./modules/org/org.repository.js";
import { OrgService } from "./modules/org/org.service.js";
import { orgRoutes } from "./modules/org/org.routes.js";
import { CategoryRepository } from "./modules/categories/categories.repository.js";
import { CategoryService } from "./modules/categories/categories.service.js";
import { categoriesRoutes } from "./modules/categories/categories.routes.js";
import { ProductRepository } from "./modules/products/products.repository.js";
import { ProductService } from "./modules/products/products.service.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import { SupplierRepository } from "./modules/suppliers/suppliers.repository.js";
import { SupplierService } from "./modules/suppliers/suppliers.service.js";
import { suppliersRoutes } from "./modules/suppliers/suppliers.routes.js";
import { UsersRepository } from "./modules/users/users.repository.js";
import { UsersService } from "./modules/users/users.service.js";
import { usersRoutes } from "./modules/users/users.routes.js";

const port = Number(process.env.PORT ?? 3001);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/stock_management";

const db = createDb(databaseUrl);

const orgService = new OrgService(new OrgRepository(db));
const branchService = new BranchService(new BranchRepository(db));
const locationService = new LocationService(new LocationRepository(db));
const categoryService = new CategoryService(new CategoryRepository(db));
const productService = new ProductService(new ProductRepository(db));
const supplierService = new SupplierService(new SupplierRepository(db));
const usersService = new UsersService(new UsersRepository(db));

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
await app.register(orgRoutes(orgService), { prefix: "/api/v1" });
await app.register(branchesRoutes(branchService), { prefix: "/api/v1" });
await app.register(locationsRoutes(locationService), { prefix: "/api/v1" });
await app.register(categoriesRoutes(categoryService), { prefix: "/api/v1" });
await app.register(productsRoutes(productService), { prefix: "/api/v1" });
await app.register(suppliersRoutes(supplierService), { prefix: "/api/v1" });
await app.register(usersRoutes(usersService), { prefix: "/api/v1" });

await app.listen({ port, host: "0.0.0.0" });
