import {
  boolean,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const masterStatusEnum = pgEnum("master_status", ["active", "inactive"]);

export const locationTypeEnum = pgEnum("location_type", [
  "storage",
  "receiving",
  "transit",
  "quarantine",
]);

export const membershipRoleEnum = pgEnum("membership_role", [
  "org_admin",
  "branch_manager",
  "warehouse",
  "purchasing",
  "accountant",
]);

export const costingMethodEnum = pgEnum("costing_method", ["fifo", "avg"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("THB"),
  timezone: text("timezone").notNull().default("Asia/Bangkok"),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
  status: masterStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("branches_org_code_uidx").on(t.orgId, t.code)],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: locationTypeEnum("type").notNull().default("storage"),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("locations_org_branch_code_uidx").on(t.orgId, t.branchId, t.code)],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_org_email_uidx").on(t.orgId, t.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: membershipRoleEnum("role").notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("memberships_org_user_uidx").on(t.orgId, t.userId)],
);

export const membershipBranches = pgTable(
  "membership_branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberships.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("membership_branches_membership_branch_uidx").on(
      t.membershipId,
      t.branchId,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("categories_org_code_uidx").on(t.orgId, t.code)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    uom: text("uom").notNull().default("EA"),
    categoryId: uuid("category_id").references(() => categories.id),
    trackLot: boolean("track_lot").notNull().default(false),
    trackSerial: boolean("track_serial").notNull().default(false),
    trackExpiry: boolean("track_expiry").notNull().default(false),
    costingMethod: costingMethodEnum("costing_method").notNull().default("fifo"),
    reorderMin: numeric("reorder_min", { precision: 18, scale: 4 }),
    reorderMax: numeric("reorder_max", { precision: 18, scale: 4 }),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("products_org_sku_uidx").on(t.orgId, t.sku)],
);

export const productBarcodes = pgTable(
  "product_barcodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    barcode: text("barcode").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("product_barcodes_org_barcode_uidx").on(t.orgId, t.barcode)],
);

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("suppliers_org_code_uidx").on(t.orgId, t.code)],
);

export const supplierProducts = pgTable(
  "supplier_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    supplierSku: text("supplier_sku"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_products_org_supplier_product_uidx").on(
      t.orgId,
      t.supplierId,
      t.productId,
    ),
  ],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [uniqueIndex("customers_org_code_uidx").on(t.orgId, t.code)],
);
