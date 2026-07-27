import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
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
  (t) => [
    uniqueIndex("locations_org_branch_code_uidx").on(
      t.orgId,
      t.branchId,
      t.code,
    ),
  ],
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
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    status: masterStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_org_email_uidx").on(t.orgId, t.email),
    uniqueIndex("users_email_uidx").on(t.email),
  ],
);

export const authEmailTokenPurposeEnum = pgEnum("auth_email_token_purpose", [
  "verify_email",
  "reset_password",
]);

export const authRefreshTokens = pgTable(
  "auth_refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("auth_refresh_tokens_token_hash_uidx").on(t.tokenHash),
    index("auth_refresh_tokens_user_idx").on(t.userId),
    index("auth_refresh_tokens_family_idx").on(t.familyId),
  ],
);

export const authEmailTokens = pgTable(
  "auth_email_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    purpose: authEmailTokenPurposeEnum("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("auth_email_tokens_token_hash_uidx").on(t.tokenHash),
    index("auth_email_tokens_user_purpose_idx").on(t.userId, t.purpose),
  ],
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

export const membershipInvites = pgTable(
  "membership_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    email: text("email").notNull(),
    role: membershipRoleEnum("role").notNull(),
    branchIds: jsonb("branch_ids").$type<string[]>().notNull().default([]),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    declinedAt: timestamp("declined_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("membership_invites_token_hash_uidx").on(t.tokenHash),
    index("membership_invites_org_email_idx").on(t.orgId, t.email),
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
    costingMethod: costingMethodEnum("costing_method")
      .notNull()
      .default("fifo"),
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
  (t) => [
    uniqueIndex("product_barcodes_org_barcode_uidx").on(t.orgId, t.barcode),
  ],
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

export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "submitted",
  "approved",
  "partially_received",
  "received",
  "closed",
  "cancelled",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "pending_approval",
  "approved",
  "posted",
  "void",
]);

export const transferPurposeEnum = pgEnum("transfer_purpose", [
  "standard",
  "replenishment",
]);

export const landedCostTypeEnum = pgEnum("landed_cost_type", [
  "freight",
  "duty",
  "other",
]);

export const lotStatusEnum = pgEnum("lot_status", [
  "active",
  "depleted",
  "quarantine",
]);

export const serialStatusEnum = pgEnum("serial_status", [
  "in_stock",
  "issued",
  "returned",
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "receipt",
  "receipt_void",
  "issue",
  "issue_void",
  "transfer_out",
  "transfer_out_void",
  "transfer_in",
  "transfer_in_void",
  "adjustment",
  "adjustment_void",
  "count_variance",
  "count_variance_void",
  "supplier_return",
  "supplier_return_void",
  "customer_return",
  "customer_return_void",
]);

export const issueTypeEnum = pgEnum("issue_type", [
  "consume",
  "sample",
  "write_off",
  "other",
]);

export const transferStatusEnum = pgEnum("transfer_status", [
  "draft",
  "in_transit",
  "received",
  "void",
]);

export const reservationStatusEnum = pgEnum("reservation_status", [
  "open",
  "committed",
  "released",
]);

export const outboxStatusEnum = pgEnum("outbox_status", [
  "pending",
  "processed",
  "failed",
]);

export const lots = pgTable(
  "lots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    lotCode: text("lot_code").notNull(),
    expiryDate: date("expiry_date", { mode: "date" }),
    status: lotStatusEnum("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("lots_org_product_code_uidx").on(
      t.orgId,
      t.productId,
      t.lotCode,
    ),
  ],
);

export const serials = pgTable(
  "serials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    lotId: uuid("lot_id").references(() => lots.id),
    locationId: uuid("location_id").references(() => locations.id),
    serialNumber: text("serial_number").notNull(),
    status: serialStatusEnum("status").notNull().default("in_stock"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("serials_org_product_number_uidx").on(
      t.orgId,
      t.productId,
      t.serialNumber,
    ),
  ],
);

export const stockBalances = pgTable(
  "stock_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    lotId: uuid("lot_id").references(() => lots.id),
    qtyOnHand: numeric("qty_on_hand", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    qtyReserved: numeric("qty_reserved", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_balances_org_product_location_lot_uidx").on(
      t.orgId,
      t.productId,
      t.locationId,
      sql`coalesce(${t.lotId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
  ],
);

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  lotId: uuid("lot_id").references(() => lots.id),
  documentType: text("document_type").notNull(),
  documentId: uuid("document_id").notNull(),
  documentLineId: uuid("document_line_id"),
  movementType: movementTypeEnum("movement_type").notNull(),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
  totalCost: numeric("total_cost", { precision: 18, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const costLayers = pgTable(
  "cost_layers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    lotId: uuid("lot_id").references(() => lots.id),
    sourceDocumentType: text("source_document_type").notNull(),
    sourceDocumentId: uuid("source_document_id").notNull(),
    sourceDocumentLineId: uuid("source_document_line_id"),
    sourceMovementId: uuid("source_movement_id")
      .notNull()
      .references(() => stockMovements.id),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull(),
    originalUnitCost: numeric("original_unit_cost", { precision: 18, scale: 4 }).notNull(),
    qtyOriginal: numeric("qty_original", { precision: 18, scale: 4 }).notNull(),
    qtyRemaining: numeric("qty_remaining", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [
    index("cost_layers_fifo_idx").on(
      t.orgId,
      t.productId,
      t.locationId,
      t.lotId,
      t.receivedAt,
    ),
  ],
);

export const costConsumptions = pgTable("cost_consumptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  costLayerId: uuid("cost_layer_id")
    .notNull()
    .references(() => costLayers.id),
  movementId: uuid("movement_id")
    .notNull()
    .references(() => stockMovements.id),
  qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull(),
  totalCost: numeric("total_cost", { precision: 18, scale: 4 }).notNull(),
  isReversal: boolean("is_reversal").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const costLayerValueAdjustments = pgTable("cost_layer_value_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  costLayerId: uuid("cost_layer_id")
    .notNull()
    .references(() => costLayers.id),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  oldUnitCost: numeric("old_unit_cost", { precision: 18, scale: 4 }).notNull(),
  newUnitCost: numeric("new_unit_cost", { precision: 18, scale: 4 }).notNull(),
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  sourceDocumentType: text("source_document_type").notNull(),
  sourceDocumentId: uuid("source_document_id").notNull(),
  sourceDocumentLineId: uuid("source_document_line_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const landedCostDocuments = pgTable("landed_cost_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  costType: landedCostTypeEnum("cost_type").notNull(),
  totalAmount: numeric("total_amount", { precision: 18, scale: 4 }).notNull(),
  status: documentStatusEnum("status").notNull().default("draft"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  ...timestamps,
});

export const landedCostLines = pgTable(
  "landed_cost_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    landedCostDocumentId: uuid("landed_cost_document_id")
      .notNull()
      .references(() => landedCostDocuments.id),
    lineNumber: integer("line_number").notNull(),
    goodsReceiptLineId: uuid("goods_receipt_line_id").references(
      () => goodsReceiptLines.id,
    ),
    costLayerId: uuid("cost_layer_id").references(() => costLayers.id),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [
    uniqueIndex("landed_cost_lines_org_doc_line_uidx").on(
      t.orgId,
      t.landedCostDocumentId,
      t.lineNumber,
    ),
  ],
);

export const costRevaluations = pgTable("cost_revaluations", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  reasonCode: text("reason_code").notNull(),
  reasonNote: text("reason_note"),
  status: documentStatusEnum("status").notNull().default("draft"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  ...timestamps,
});

export const costRevaluationLines = pgTable(
  "cost_revaluation_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    costRevaluationId: uuid("cost_revaluation_id")
      .notNull()
      .references(() => costRevaluations.id),
    lineNumber: integer("line_number").notNull(),
    costLayerId: uuid("cost_layer_id")
      .notNull()
      .references(() => costLayers.id),
    newUnitCost: numeric("new_unit_cost", { precision: 18, scale: 4 }).notNull(),
  },
  (t) => [
    uniqueIndex("cost_revaluation_lines_org_doc_line_uidx").on(
      t.orgId,
      t.costRevaluationId,
      t.lineNumber,
    ),
  ],
);

export const productCostSummaries = pgTable(
  "product_cost_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    lotId: uuid("lot_id").references(() => lots.id),
    qtyRemainingSum: numeric("qty_remaining_sum", { precision: 18, scale: 4 }).notNull(),
    onHandValue: numeric("on_hand_value", { precision: 18, scale: 4 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("product_cost_summaries_org_product_location_lot_uidx").on(
      t.orgId,
      t.productId,
      t.locationId,
      sql`coalesce(${t.lotId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
  ],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    status: poStatusEnum("status").notNull().default("draft"),
    documentNumber: text("document_number"),
    expectedDate: date("expected_date", { mode: "date" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("purchase_orders_org_document_number_uidx").on(
      t.orgId,
      t.documentNumber,
    ),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    orderedQty: numeric("ordered_qty", { precision: 18, scale: 4 }).notNull(),
    receivedQty: numeric("received_qty", { precision: 18, scale: 4 })
      .notNull()
      .default("0"),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("purchase_order_lines_org_order_line_uidx").on(
      t.orgId,
      t.purchaseOrderId,
      t.lineNumber,
    ),
  ],
);

export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  purchaseOrderId: uuid("purchase_order_id").references(
    () => purchaseOrders.id,
  ),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id),
  locationId: uuid("location_id")
    .notNull()
    .references(() => locations.id),
  status: documentStatusEnum("status").notNull().default("draft"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  voidedAt: timestamp("voided_at", { withTimezone: true }),
  ...timestamps,
});

export const goodsReceiptLines = pgTable(
  "goods_receipt_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    goodsReceiptId: uuid("goods_receipt_id")
      .notNull()
      .references(() => goodsReceipts.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    purchaseOrderLineId: uuid("purchase_order_line_id").references(
      () => purchaseOrderLines.id,
    ),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
    lotId: uuid("lot_id").references(() => lots.id),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("goods_receipt_lines_org_receipt_line_uidx").on(
      t.orgId,
      t.goodsReceiptId,
      t.lineNumber,
    ),
  ],
);

export const goodsReceiptSerials = pgTable(
  "goods_receipt_serials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    goodsReceiptLineId: uuid("goods_receipt_line_id")
      .notNull()
      .references(() => goodsReceiptLines.id),
    serialNumber: text("serial_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("goods_receipt_serials_org_line_number_uidx").on(
      t.orgId,
      t.goodsReceiptLineId,
      t.serialNumber,
    ),
  ],
);

export const stockIssues = pgTable(
  "stock_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    documentNumber: text("document_number"),
    issueType: issueTypeEnum("issue_type").notNull(),
    reasonNote: text("reason_note"),
    status: documentStatusEnum("status").notNull().default("draft"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_issues_org_document_number_uidx").on(
      t.orgId,
      t.documentNumber,
    ),
    uniqueIndex("stock_issues_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const stockIssueLines = pgTable(
  "stock_issue_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    stockIssueId: uuid("stock_issue_id")
      .notNull()
      .references(() => stockIssues.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    lotId: uuid("lot_id").references(() => lots.id),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_issue_lines_org_issue_line_uidx").on(
      t.orgId,
      t.stockIssueId,
      t.lineNumber,
    ),
    check("stock_issue_lines_qty_positive", sql`${t.qty} > 0`),
  ],
);

export const stockIssueSerials = pgTable(
  "stock_issue_serials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    stockIssueLineId: uuid("stock_issue_line_id")
      .notNull()
      .references(() => stockIssueLines.id),
    serialNumber: text("serial_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_issue_serials_org_line_number_uidx").on(
      t.orgId,
      t.stockIssueLineId,
      t.serialNumber,
    ),
  ],
);

export const stockTransfers = pgTable(
  "stock_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    fromLocationId: uuid("from_location_id")
      .notNull()
      .references(() => locations.id),
    toLocationId: uuid("to_location_id")
      .notNull()
      .references(() => locations.id),
    transitLocationId: uuid("transit_location_id")
      .notNull()
      .references(() => locations.id),
    fromBranchId: uuid("from_branch_id")
      .notNull()
      .references(() => branches.id),
    toBranchId: uuid("to_branch_id")
      .notNull()
      .references(() => branches.id),
    purpose: transferPurposeEnum("purpose").notNull().default("standard"),
    documentNumber: text("document_number"),
    status: transferStatusEnum("status").notNull().default("draft"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    shippedBy: uuid("shipped_by").references(() => users.id),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receivedBy: uuid("received_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_transfers_org_document_number_uidx").on(
      t.orgId,
      t.documentNumber,
    ),
    uniqueIndex("stock_transfers_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const stockTransferLines = pgTable(
  "stock_transfer_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    stockTransferId: uuid("stock_transfer_id")
      .notNull()
      .references(() => stockTransfers.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    lotId: uuid("lot_id").references(() => lots.id),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_transfer_lines_org_transfer_line_uidx").on(
      t.orgId,
      t.stockTransferId,
      t.lineNumber,
    ),
    check("stock_transfer_lines_qty_positive", sql`${t.qty} > 0`),
  ],
);

export const stockTransferSerials = pgTable(
  "stock_transfer_serials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    stockTransferLineId: uuid("stock_transfer_line_id")
      .notNull()
      .references(() => stockTransferLines.id),
    serialNumber: text("serial_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_transfer_serials_org_line_number_uidx").on(
      t.orgId,
      t.stockTransferLineId,
      t.serialNumber,
    ),
  ],
);

export const approvalPolicies = pgTable(
  "approval_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    documentType: text("document_type").notNull(),
    required: boolean("required").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("approval_policies_org_type_uidx").on(
      t.orgId,
      t.documentType,
    ),
    index("approval_policies_org_idx").on(t.orgId),
    check(
      "approval_policies_document_type_chk",
      sql`${t.documentType} IN ('purchase_order', 'stock_adjustment')`,
    ),
  ],
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    documentNumber: text("document_number"),
    reasonCode: text("reason_code").notNull(),
    reasonNote: text("reason_note"),
    status: documentStatusEnum("status").notNull().default("draft"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_adjustments_org_document_number_uidx").on(
      t.orgId,
      t.documentNumber,
    ),
    uniqueIndex("stock_adjustments_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const stockAdjustmentLines = pgTable(
  "stock_adjustment_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    stockAdjustmentId: uuid("stock_adjustment_id")
      .notNull()
      .references(() => stockAdjustments.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    lotId: uuid("lot_id").references(() => lots.id),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_adjustment_lines_org_adjustment_line_uidx").on(
      t.orgId,
      t.stockAdjustmentId,
      t.lineNumber,
    ),
    check("stock_adjustment_lines_qty_nonzero", sql`${t.qty} <> 0`),
  ],
);

export const stockAdjustmentSerials = pgTable(
  "stock_adjustment_serials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    stockAdjustmentLineId: uuid("stock_adjustment_line_id")
      .notNull()
      .references(() => stockAdjustmentLines.id),
    serialNumber: text("serial_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_adjustment_serials_org_line_number_uidx").on(
      t.orgId,
      t.stockAdjustmentLineId,
      t.serialNumber,
    ),
  ],
);

export const stockCounts = pgTable(
  "stock_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    documentNumber: text("document_number"),
    status: documentStatusEnum("status").notNull().default("draft"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_counts_org_document_number_uidx").on(
      t.orgId,
      t.documentNumber,
    ),
  ],
);

export const stockCountLines = pgTable(
  "stock_count_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    stockCountId: uuid("stock_count_id")
      .notNull()
      .references(() => stockCounts.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    lotId: uuid("lot_id").references(() => lots.id),
    expectedQty: numeric("expected_qty", { precision: 18, scale: 4 }).notNull(),
    countedQty: numeric("counted_qty", { precision: 18, scale: 4 }),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_count_lines_org_count_line_uidx").on(
      t.orgId,
      t.stockCountId,
      t.lineNumber,
    ),
  ],
);

export const stockReservations = pgTable(
  "stock_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    lotId: uuid("lot_id").references(() => lots.id),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    status: reservationStatusEnum("status").notNull().default("open"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    committedIssueId: uuid("committed_issue_id").references(
      () => stockIssues.id,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("stock_reservations_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
    index("stock_reservations_org_product_location_status_idx").on(
      t.orgId,
      t.productId,
      t.locationId,
      t.status,
    ),
    index("stock_reservations_org_status_expires_idx").on(
      t.orgId,
      t.status,
      t.expiresAt,
    ),
    check("stock_reservations_qty_positive", sql`${t.qty} > 0`),
  ],
);

export const supplierReturns = pgTable(
  "supplier_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    goodsReceiptId: uuid("goods_receipt_id").references(() => goodsReceipts.id),
    documentNumber: text("document_number"),
    status: documentStatusEnum("status").notNull().default("draft"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_returns_org_document_number_uidx").on(
      t.orgId,
      t.documentNumber,
    ),
    uniqueIndex("supplier_returns_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const supplierReturnLines = pgTable(
  "supplier_return_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    supplierReturnId: uuid("supplier_return_id")
      .notNull()
      .references(() => supplierReturns.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    lotId: uuid("lot_id").references(() => lots.id),
    goodsReceiptLineId: uuid("goods_receipt_line_id").references(
      () => goodsReceiptLines.id,
    ),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_return_lines_org_return_line_uidx").on(
      t.orgId,
      t.supplierReturnId,
      t.lineNumber,
    ),
    check("supplier_return_lines_qty_positive", sql`${t.qty} > 0`),
  ],
);

export const supplierReturnSerials = pgTable(
  "supplier_return_serials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    supplierReturnLineId: uuid("supplier_return_line_id")
      .notNull()
      .references(() => supplierReturnLines.id),
    serialNumber: text("serial_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_return_serials_org_line_number_uidx").on(
      t.orgId,
      t.supplierReturnLineId,
      t.serialNumber,
    ),
  ],
);

export const customerReturns = pgTable(
  "customer_returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    documentNumber: text("document_number"),
    status: documentStatusEnum("status").notNull().default("draft"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customer_returns_org_document_number_uidx").on(
      t.orgId,
      t.documentNumber,
    ),
    uniqueIndex("customer_returns_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const customerReturnLines = pgTable(
  "customer_return_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    customerReturnId: uuid("customer_return_id")
      .notNull()
      .references(() => customerReturns.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    lotId: uuid("lot_id").references(() => lots.id),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }),
    lineNumber: integer("line_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customer_return_lines_org_return_line_uidx").on(
      t.orgId,
      t.customerReturnId,
      t.lineNumber,
    ),
    check("customer_return_lines_qty_positive", sql`${t.qty} > 0`),
  ],
);

export const customerReturnSerials = pgTable(
  "customer_return_serials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    customerReturnLineId: uuid("customer_return_line_id")
      .notNull()
      .references(() => customerReturnLines.id),
    serialNumber: text("serial_number").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("customer_return_serials_org_line_number_uidx").on(
      t.orgId,
      t.customerReturnLineId,
      t.serialNumber,
    ),
  ],
);

export const outboxEvents = pgTable("outbox_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  eventType: text("event_type").notNull(),
  aggregateType: text("aggregate_type").notNull(),
  aggregateId: uuid("aggregate_id").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: outboxStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  availableAt: timestamp("available_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  lastError: text("last_error"),
  ...timestamps,
});

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    operation: text("operation").notNull(),
    externalSystem: text("external_system").notNull(),
    externalId: text("external_id").notNull(),
    result: jsonb("result").$type<unknown>().notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("idempotency_keys_org_operation_external_uidx").on(
      t.orgId,
      t.operation,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const periodStatusEnum = pgEnum("period_status", ["open", "closed"]);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: accountTypeEnum("type").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("accounts_org_code_uidx").on(t.orgId, t.code)],
);

export const accountMappings = pgTable(
  "account_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    journalEventType: text("journal_event_type").notNull(),
    debitAccountId: uuid("debit_account_id")
      .notNull()
      .references(() => accounts.id),
    creditAccountId: uuid("credit_account_id")
      .notNull()
      .references(() => accounts.id),
  },
  (t) => [
    uniqueIndex("account_mappings_org_event_uidx").on(
      t.orgId,
      t.journalEventType,
    ),
  ],
);

export const accountingPeriods = pgTable(
  "accounting_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    status: periodStatusEnum("status").notNull().default("open"),
  },
  (t) => [
    uniqueIndex("accounting_periods_org_year_month_uidx").on(
      t.orgId,
      t.year,
      t.month,
    ),
  ],
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    periodId: uuid("period_id")
      .notNull()
      .references(() => accountingPeriods.id),
    branchId: uuid("branch_id").references(() => branches.id),
    sourceDocumentType: text("source_document_type").notNull(),
    sourceDocumentId: uuid("source_document_id").notNull(),
    outboxEventId: uuid("outbox_event_id"),
    reversesJournalId: uuid("reverses_journal_id").references(
      (): AnyPgColumn => journalEntries.id,
    ),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("journal_entries_org_outbox_uidx")
      .on(t.orgId, t.outboxEventId)
      .where(sql`${t.outboxEventId} is not null`),
    index("journal_entries_source_idx").on(
      t.orgId,
      t.sourceDocumentType,
      t.sourceDocumentId,
    ),
  ],
);

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  journalEntryId: uuid("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id),
  debit: numeric("debit", { precision: 18, scale: 4 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 4 }).notNull().default("0"),
  lineNo: integer("line_no").notNull(),
});

export const supplierInvoiceStatusEnum = pgEnum("supplier_invoice_status", [
  "draft",
  "posted",
  "voided",
]);

export const supplierInvoices = pgTable(
  "supplier_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    branchId: uuid("branch_id").references(() => branches.id),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: date("invoice_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    status: supplierInvoiceStatusEnum("status").notNull().default("draft"),
    externalSystem: text("external_system"),
    externalId: text("external_id"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_invoices_org_number_uidx").on(
      t.orgId,
      t.invoiceNumber,
    ),
    uniqueIndex("supplier_invoices_org_external_uidx").on(
      t.orgId,
      t.externalSystem,
      t.externalId,
    ),
  ],
);

export const supplierInvoiceLines = pgTable(
  "supplier_invoice_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    supplierInvoiceId: uuid("supplier_invoice_id")
      .notNull()
      .references(() => supplierInvoices.id),
    productId: uuid("product_id").references(() => products.id),
    lineNumber: integer("line_number").notNull(),
    qty: numeric("qty", { precision: 18, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    purchaseOrderLineId: uuid("purchase_order_line_id")
      .notNull()
      .references(() => purchaseOrderLines.id),
    goodsReceiptLineId: uuid("goods_receipt_line_id")
      .notNull()
      .references(() => goodsReceiptLines.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("supplier_invoice_lines_org_doc_line_uidx").on(
      t.orgId,
      t.supplierInvoiceId,
      t.lineNumber,
    ),
  ],
);

export const invoiceMatches = pgTable("invoice_matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  supplierInvoiceLineId: uuid("supplier_invoice_line_id")
    .notNull()
    .references(() => supplierInvoiceLines.id),
  purchaseOrderLineId: uuid("purchase_order_line_id")
    .notNull()
    .references(() => purchaseOrderLines.id),
  goodsReceiptLineId: uuid("goods_receipt_line_id")
    .notNull()
    .references(() => goodsReceiptLines.id),
  matchedQty: numeric("matched_qty", { precision: 18, scale: 4 }).notNull(),
  matchedAmount: numeric("matched_amount", {
    precision: 18,
    scale: 4,
  }).notNull(),
  ...timestamps,
});

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "succeeded",
  "failed",
]);

export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    eventTypes: text("event_types").array().notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("webhook_subscriptions_org_idx").on(t.orgId)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => webhookSubscriptions.id),
    outboxEventId: uuid("outbox_event_id")
      .notNull()
      .references(() => outboxEvents.id),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    httpStatus: integer("http_status"),
    error: text("error"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("webhook_deliveries_sub_event_uidx").on(
      t.subscriptionId,
      t.outboxEventId,
    ),
    index("webhook_deliveries_org_idx").on(t.orgId),
  ],
);
