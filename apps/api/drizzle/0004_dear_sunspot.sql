CREATE TABLE "cost_consumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"cost_layer_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"qty" numeric(18, 4) NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"total_cost" numeric(18, 4) NOT NULL,
	"is_reversal" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"lot_id" uuid,
	"source_document_type" text NOT NULL,
	"source_document_id" uuid NOT NULL,
	"source_document_line_id" uuid,
	"source_movement_id" uuid NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"unit_cost" numeric(18, 4) NOT NULL,
	"qty_original" numeric(18, 4) NOT NULL,
	"qty_remaining" numeric(18, 4) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "unit_cost" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "total_cost" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "cost_consumptions" ADD CONSTRAINT "cost_consumptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_consumptions" ADD CONSTRAINT "cost_consumptions_cost_layer_id_cost_layers_id_fk" FOREIGN KEY ("cost_layer_id") REFERENCES "public"."cost_layers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_consumptions" ADD CONSTRAINT "cost_consumptions_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_layers" ADD CONSTRAINT "cost_layers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_layers" ADD CONSTRAINT "cost_layers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_layers" ADD CONSTRAINT "cost_layers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_layers" ADD CONSTRAINT "cost_layers_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_layers" ADD CONSTRAINT "cost_layers_source_movement_id_stock_movements_id_fk" FOREIGN KEY ("source_movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cost_layers_fifo_idx" ON "cost_layers" USING btree ("org_id","product_id","location_id","lot_id","received_at");