import { and, eq } from "drizzle-orm";
import type { CreateProduct, UpdateProduct } from "@stock-management/shared";
import type { Db } from "../../db/client.js";
import { productBarcodes, products } from "../../db/schema/index.js";

export class ProductRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string) {
    return this.db.select().from(products).where(eq(products.orgId, orgId));
  }

  findById(orgId: string, id: string) {
    return this.db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.id, id)))
      .then((rows) => rows[0] ?? null);
  }

  listBarcodes(orgId: string, productId: string) {
    return this.db
      .select()
      .from(productBarcodes)
      .where(
        and(eq(productBarcodes.orgId, orgId), eq(productBarcodes.productId, productId)),
      );
  }

  async create(orgId: string, input: CreateProduct) {
    return this.db.transaction(async (tx) => {
      const [product] = await tx
        .insert(products)
        .values({
          orgId,
          sku: input.sku,
          name: input.name,
          uom: input.uom ?? "EA",
          categoryId: input.categoryId ?? null,
          trackLot: input.trackLot ?? false,
          trackSerial: input.trackSerial ?? false,
          trackExpiry: input.trackExpiry ?? false,
          costingMethod: input.costingMethod ?? "fifo",
          reorderMin: input.reorderMin ?? null,
          reorderMax: input.reorderMax ?? null,
          status: input.status ?? "active",
        })
        .returning();

      if (input.barcodes?.length) {
        await tx.insert(productBarcodes).values(
          input.barcodes.map((barcode) => ({
            orgId,
            productId: product.id,
            barcode,
          })),
        );
      }

      return product;
    });
  }

  async update(orgId: string, id: string, input: UpdateProduct) {
    const [row] = await this.db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(products.orgId, orgId), eq(products.id, id)))
      .returning();
    return row ?? null;
  }
}
