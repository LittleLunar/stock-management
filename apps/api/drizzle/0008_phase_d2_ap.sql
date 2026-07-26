CREATE TYPE "public"."supplier_invoice_status" AS ENUM('draft', 'posted', 'voided');--> statement-breakpoint
CREATE TABLE "supplier_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"branch_id" uuid,
	"invoice_number" text NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"status" "supplier_invoice_status" DEFAULT 'draft' NOT NULL,
	"external_system" text,
	"external_id" text,
	"posted_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"supplier_invoice_id" uuid NOT NULL,
	"product_id" uuid,
	"line_number" integer NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"goods_receipt_line_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"supplier_invoice_line_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"goods_receipt_line_id" uuid NOT NULL,
	"matched_qty" numeric(18, 4) NOT NULL,
	"matched_amount" numeric(18, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_supplier_invoices_id_fk" FOREIGN KEY ("supplier_invoice_id") REFERENCES "public"."supplier_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_goods_receipt_line_id_goods_receipt_lines_id_fk" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_matches" ADD CONSTRAINT "invoice_matches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_matches" ADD CONSTRAINT "invoice_matches_supplier_invoice_line_id_supplier_invoice_lines_id_fk" FOREIGN KEY ("supplier_invoice_line_id") REFERENCES "public"."supplier_invoice_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_matches" ADD CONSTRAINT "invoice_matches_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_matches" ADD CONSTRAINT "invoice_matches_goods_receipt_line_id_goods_receipt_lines_id_fk" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_org_number_uidx" ON "supplier_invoices" USING btree ("org_id","invoice_number");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoices_org_external_uidx" ON "supplier_invoices" USING btree ("org_id","external_system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_invoice_lines_org_doc_line_uidx" ON "supplier_invoice_lines" USING btree ("org_id","supplier_invoice_id","line_number");
