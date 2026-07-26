CREATE TYPE "public"."issue_type" AS ENUM('consume', 'sample', 'write_off', 'other');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('draft', 'in_transit', 'received', 'void');--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'issue';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'issue_void';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_out';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_out_void';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_in';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'transfer_in_void';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'adjustment';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'adjustment_void';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'count_variance';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'count_variance_void';--> statement-breakpoint
CREATE TABLE "stock_adjustment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stock_adjustment_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"lot_id" uuid,
	"line_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustment_lines_qty_nonzero" CHECK ("stock_adjustment_lines"."qty" <> 0)
);
--> statement-breakpoint
CREATE TABLE "stock_adjustment_serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stock_adjustment_line_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"document_number" text,
	"reason_code" text NOT NULL,
	"reason_note" text,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"external_system" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_count_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stock_count_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"lot_id" uuid,
	"expected_qty" numeric(18, 4) NOT NULL,
	"counted_qty" numeric(18, 4),
	"line_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_counts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"document_number" text,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_issue_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stock_issue_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"lot_id" uuid,
	"line_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_issue_lines_qty_positive" CHECK ("stock_issue_lines"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_issue_serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stock_issue_line_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"document_number" text,
	"issue_type" "issue_type" NOT NULL,
	"reason_note" text,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"external_system" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stock_transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"lot_id" uuid,
	"line_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_transfer_lines_qty_positive" CHECK ("stock_transfer_lines"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_transfer_serials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"stock_transfer_line_id" uuid NOT NULL,
	"serial_number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"transit_location_id" uuid NOT NULL,
	"document_number" text,
	"status" "transfer_status" DEFAULT 'draft' NOT NULL,
	"shipped_at" timestamp with time zone,
	"shipped_by" uuid,
	"received_at" timestamp with time zone,
	"received_by" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	"external_system" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "serials" ADD COLUMN "location_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_stock_adjustment_id_stock_adjustments_id_fk" FOREIGN KEY ("stock_adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_serials" ADD CONSTRAINT "stock_adjustment_serials_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_serials" ADD CONSTRAINT "stock_adjustment_serials_stock_adjustment_line_id_stock_adjustment_lines_id_fk" FOREIGN KEY ("stock_adjustment_line_id") REFERENCES "public"."stock_adjustment_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_stock_count_id_stock_counts_id_fk" FOREIGN KEY ("stock_count_id") REFERENCES "public"."stock_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_stock_issue_id_stock_issues_id_fk" FOREIGN KEY ("stock_issue_id") REFERENCES "public"."stock_issues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_lines" ADD CONSTRAINT "stock_issue_lines_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_serials" ADD CONSTRAINT "stock_issue_serials_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issue_serials" ADD CONSTRAINT "stock_issue_serials_stock_issue_line_id_stock_issue_lines_id_fk" FOREIGN KEY ("stock_issue_line_id") REFERENCES "public"."stock_issue_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_issues" ADD CONSTRAINT "stock_issues_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_stock_transfer_id_stock_transfers_id_fk" FOREIGN KEY ("stock_transfer_id") REFERENCES "public"."stock_transfers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_serials" ADD CONSTRAINT "stock_transfer_serials_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_serials" ADD CONSTRAINT "stock_transfer_serials_stock_transfer_line_id_stock_transfer_lines_id_fk" FOREIGN KEY ("stock_transfer_line_id") REFERENCES "public"."stock_transfer_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_location_id_locations_id_fk" FOREIGN KEY ("from_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_location_id_locations_id_fk" FOREIGN KEY ("to_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_transit_location_id_locations_id_fk" FOREIGN KEY ("transit_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_shipped_by_users_id_fk" FOREIGN KEY ("shipped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustment_lines_org_adjustment_line_uidx" ON "stock_adjustment_lines" USING btree ("org_id","stock_adjustment_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustment_serials_org_line_number_uidx" ON "stock_adjustment_serials" USING btree ("org_id","stock_adjustment_line_id","serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_org_document_number_uidx" ON "stock_adjustments" USING btree ("org_id","document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_adjustments_org_external_uidx" ON "stock_adjustments" USING btree ("org_id","external_system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_count_lines_org_count_line_uidx" ON "stock_count_lines" USING btree ("org_id","stock_count_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_counts_org_document_number_uidx" ON "stock_counts" USING btree ("org_id","document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_issue_lines_org_issue_line_uidx" ON "stock_issue_lines" USING btree ("org_id","stock_issue_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_issue_serials_org_line_number_uidx" ON "stock_issue_serials" USING btree ("org_id","stock_issue_line_id","serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_issues_org_document_number_uidx" ON "stock_issues" USING btree ("org_id","document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_issues_org_external_uidx" ON "stock_issues" USING btree ("org_id","external_system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfer_lines_org_transfer_line_uidx" ON "stock_transfer_lines" USING btree ("org_id","stock_transfer_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfer_serials_org_line_number_uidx" ON "stock_transfer_serials" USING btree ("org_id","stock_transfer_line_id","serial_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfers_org_document_number_uidx" ON "stock_transfers" USING btree ("org_id","document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfers_org_external_uidx" ON "stock_transfers" USING btree ("org_id","external_system","external_id");--> statement-breakpoint
ALTER TABLE "serials" ADD CONSTRAINT "serials_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;