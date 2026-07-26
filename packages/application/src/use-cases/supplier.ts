import { NotFoundError } from "@stock-management/domain";
import type { CreateSupplierInput, UpdateSupplierInput } from "../dto/inputs.js";
import type { SupplierRepository } from "../ports/repositories.js";

export class SupplierUseCases {
  constructor(private readonly repo: SupplierRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const row = await this.repo.findById(orgId, id);
    if (!row) throw new NotFoundError("Supplier");
    return row;
  }

  create(orgId: string, input: CreateSupplierInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateSupplierInput) {
    const row = await this.repo.update(orgId, id, input);
    if (!row) throw new NotFoundError("Supplier");
    return row;
  }
}
