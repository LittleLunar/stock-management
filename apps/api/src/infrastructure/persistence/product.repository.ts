import { and, eq } from "drizzle-orm";
import type {
  CreateProductInput,
  ProductRepository,
  UpdateProductInput,
} from "@stock-management/application";
import type { Product, ProductBarcode } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { productBarcodes, products } from "../db/schema/index.js";

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string): Promise<Product[]> {
    return this.db
      .select()
      .from(products)
      .where(eq(products.orgId, orgId)) as Promise<Product[]>;
  }

  findById(orgId: string, id: string): Promise<Product | null> {
    return this.db
      .select()
      .from(products)
      .where(and(eq(products.orgId, orgId), eq(products.id, id)))
      .then((rows) => (rows[0] as Product | undefined) ?? null);
  }

  async findByBarcode(orgId: string, barcode: string): Promise<Product | null> {
    const [row] = await this.db
      .select({ product: products })
      .from(productBarcodes)
      .innerJoin(products, eq(productBarcodes.productId, products.id))
      .where(
        and(
          eq(productBarcodes.orgId, orgId),
          eq(productBarcodes.barcode, barcode),
        ),
      )
      .limit(1);
    return (row?.product as Product | undefined) ?? null;
  }

  listBarcodes(orgId: string, productId: string): Promise<ProductBarcode[]> {
    return this.db
      .select()
      .from(productBarcodes)
      .where(
        and(eq(productBarcodes.orgId, orgId), eq(productBarcodes.productId, productId)),
      ) as Promise<ProductBarcode[]>;
  }

  async create(orgId: string, input: CreateProductInput): Promise<Product> {
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

      return product as Product;
    });
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateProductInput,
  ): Promise<Product | null> {
    const [row] = await this.db
      .update(products)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(products.orgId, orgId), eq(products.id, id)))
      .returning();
    return (row as Product | undefined) ?? null;
  }
}
