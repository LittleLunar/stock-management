import type { CreateSupplier, UpdateSupplier } from "@stock-management/shared";
import { notFound } from "../../lib/errors.js";
import type { SupplierRepository } from "./suppliers.repository.js";

export class SupplierService {
  constructor(private readonly repo: SupplierRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const row = await this.repo.findById(orgId, id);
    if (!row) throw notFound("Supplier");
    return row;
  }

  create(orgId: string, input: CreateSupplier) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateSupplier) {
    const row = await this.repo.update(orgId, id, input);
    if (!row) throw notFound("Supplier");
    return row;
  }
}
