ALTER TABLE "stock_transfers" ADD COLUMN "from_branch_id" uuid;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD COLUMN "to_branch_id" uuid;--> statement-breakpoint
UPDATE "stock_transfers" AS st
SET
  "from_branch_id" = fl."branch_id",
  "to_branch_id" = tl."branch_id"
FROM "locations" AS fl, "locations" AS tl
WHERE fl."id" = st."from_location_id"
  AND tl."id" = st."to_location_id";--> statement-breakpoint
ALTER TABLE "stock_transfers" ALTER COLUMN "from_branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_transfers" ALTER COLUMN "to_branch_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_branch_id_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_branch_id_branches_id_fk" FOREIGN KEY ("to_branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
