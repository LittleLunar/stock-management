import type { CreateProduct, UpdateProduct } from "@stock-management/shared";
import { notFound } from "../../lib/errors.js";
import type { ProductRepository } from "./products.repository.js";

export class ProductService {
  constructor(private readonly repo: ProductRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const product = await this.repo.findById(orgId, id);
    if (!product) throw notFound("Product");
    const barcodes = await this.repo.listBarcodes(orgId, id);
    return { ...product, barcodes };
  }

  create(orgId: string, input: CreateProduct) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateProduct) {
    const product = await this.repo.update(orgId, id, input);
    if (!product) throw notFound("Product");
    return product;
  }
}
