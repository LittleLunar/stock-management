ALTER TABLE "stock_adjustment_lines" ADD COLUMN "unit_cost" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "stock_count_lines" ADD COLUMN "unit_cost" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "customer_return_lines" ADD COLUMN "unit_cost" numeric(18, 4);
