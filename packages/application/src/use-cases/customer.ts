import { NotFoundError } from "@stock-management/domain";
import type { CreateCustomerInput } from "../dto/inputs.js";
import type { CustomerRepository } from "../ports/repositories.js";

export class CustomerUseCases {
  constructor(private readonly repo: CustomerRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const row = await this.repo.findById(orgId, id);
    if (!row) throw new NotFoundError("Customer");
    return row;
  }

  create(orgId: string, input: CreateCustomerInput) {
    return this.repo.create(orgId, input);
  }
}
