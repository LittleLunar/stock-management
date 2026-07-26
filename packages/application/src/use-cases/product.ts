import { NotFoundError } from "@stock-management/domain";
import type { CreateProductInput, UpdateProductInput } from "../dto/inputs.js";
import type { ProductRepository } from "../ports/repositories.js";

export class ProductUseCases {
  constructor(private readonly repo: ProductRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const product = await this.repo.findById(orgId, id);
    if (!product) throw new NotFoundError("Product");
    const barcodes = await this.repo.listBarcodes(orgId, id);
    return { ...product, barcodes };
  }

  async findByBarcode(orgId: string, code: string) {
    const product = await this.repo.findByBarcode(orgId, code);
    if (!product) throw new NotFoundError("Product");
    const barcodes = await this.repo.listBarcodes(orgId, product.id);
    return { ...product, barcodes };
  }

  create(orgId: string, input: CreateProductInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateProductInput) {
    const product = await this.repo.update(orgId, id, input);
    if (!product) throw new NotFoundError("Product");
    return product;
  }
}
