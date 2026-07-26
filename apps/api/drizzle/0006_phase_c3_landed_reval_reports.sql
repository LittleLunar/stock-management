CREATE TYPE "public"."landed_cost_type" AS ENUM('freight', 'duty', 'other');--> statement-breakpoint
CREATE TABLE "cost_layer_value_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"cost_layer_id" uuid NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"old_unit_cost" numeric(18, 4) NOT NULL,
	"new_unit_cost" numeric(18, 4) NOT NULL,
	"amount" numeric(18, 4) NOT NULL,
	"source_document_type" text NOT NULL,
	"source_document_id" uuid NOT NULL,
	"source_document_line_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_revaluation_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"cost_revaluation_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"cost_layer_id" uuid NOT NULL,
	"new_unit_cost" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_revaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"reason_code" text NOT NULL,
	"reason_note" text,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"posted_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landed_cost_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"supplier_id" uuid,
	"cost_type" "landed_cost_type" NOT NULL,
	"total_amount" numeric(18, 4) NOT NULL,
	"status" "document_status" DEFAULT 'draft' NOT NULL,
	"posted_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "landed_cost_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"landed_cost_document_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"goods_receipt_line_id" uuid,
	"cost_layer_id" uuid,
	"amount" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_cost_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"lot_id" uuid,
	"qty_remaining_sum" numeric(18, 4) NOT NULL,
	"on_hand_value" numeric(18, 4) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_layers" ADD COLUMN "original_unit_cost" numeric(18, 4);--> statement-breakpoint
UPDATE "cost_layers" SET "original_unit_cost" = "unit_cost" WHERE "original_unit_cost" IS NULL;--> statement-breakpoint
ALTER TABLE "cost_layers" ALTER COLUMN "original_unit_cost" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "cost_layer_value_adjustments" ADD CONSTRAINT "cost_layer_value_adjustments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_layer_value_adjustments" ADD CONSTRAINT "cost_layer_value_adjustments_cost_layer_id_cost_layers_id_fk" FOREIGN KEY ("cost_layer_id") REFERENCES "public"."cost_layers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_revaluation_lines" ADD CONSTRAINT "cost_revaluation_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_revaluation_lines" ADD CONSTRAINT "cost_revaluation_lines_cost_revaluation_id_cost_revaluations_id_fk" FOREIGN KEY ("cost_revaluation_id") REFERENCES "public"."cost_revaluations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_revaluation_lines" ADD CONSTRAINT "cost_revaluation_lines_cost_layer_id_cost_layers_id_fk" FOREIGN KEY ("cost_layer_id") REFERENCES "public"."cost_layers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_revaluations" ADD CONSTRAINT "cost_revaluations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_revaluations" ADD CONSTRAINT "cost_revaluations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_documents" ADD CONSTRAINT "landed_cost_documents_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_documents" ADD CONSTRAINT "landed_cost_documents_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_documents" ADD CONSTRAINT "landed_cost_documents_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_lines" ADD CONSTRAINT "landed_cost_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_lines" ADD CONSTRAINT "landed_cost_lines_landed_cost_document_id_landed_cost_documents_id_fk" FOREIGN KEY ("landed_cost_document_id") REFERENCES "public"."landed_cost_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_lines" ADD CONSTRAINT "landed_cost_lines_goods_receipt_line_id_goods_receipt_lines_id_fk" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "public"."goods_receipt_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landed_cost_lines" ADD CONSTRAINT "landed_cost_lines_cost_layer_id_cost_layers_id_fk" FOREIGN KEY ("cost_layer_id") REFERENCES "public"."cost_layers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_summaries" ADD CONSTRAINT "product_cost_summaries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_summaries" ADD CONSTRAINT "product_cost_summaries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_summaries" ADD CONSTRAINT "product_cost_summaries_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_cost_summaries" ADD CONSTRAINT "product_cost_summaries_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cost_revaluation_lines_org_doc_line_uidx" ON "cost_revaluation_lines" USING btree ("org_id","cost_revaluation_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "landed_cost_lines_org_doc_line_uidx" ON "landed_cost_lines" USING btree ("org_id","landed_cost_document_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "product_cost_summaries_org_product_location_lot_uidx" ON "product_cost_summaries" USING btree ("org_id","product_id","location_id",coalesce("lot_id", '00000000-0000-0000-0000-000000000000'::uuid));