CREATE TYPE "public"."transfer_purpose" AS ENUM('standard', 'replenishment');--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "purpose" "transfer_purpose" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TYPE "public"."po_status" ADD VALUE 'approved';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'pending_approval';--> statement-breakpoint
ALTER TYPE "public"."document_status" ADD VALUE 'approved';--> statement-breakpoint
CREATE TABLE "approval_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approval_policies_document_type_chk" CHECK ("document_type" IN ('purchase_order', 'stock_adjustment'))
);
--> statement-breakpoint
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "approval_policies_org_type_uidx" ON "approval_policies" USING btree ("org_id","document_type");--> statement-breakpoint
CREATE INDEX "approval_policies_org_idx" ON "approval_policies" USING btree ("org_id");
