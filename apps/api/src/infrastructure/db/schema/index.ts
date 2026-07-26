import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
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
  "partially_received",
  "received",
  "closed",
  "cancelled",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "draft",
  "posted",
  "void",
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
