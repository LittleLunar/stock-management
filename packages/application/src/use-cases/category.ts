import { NotFoundError } from "@stock-management/domain";
import type { CreateCategoryInput, UpdateCategoryInput } from "../dto/inputs.js";
import type { CategoryRepository } from "../ports/repositories.js";

export class CategoryUseCases {
  constructor(private readonly repo: CategoryRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const row = await this.repo.findById(orgId, id);
    if (!row) throw new NotFoundError("Category");
    return row;
  }

  create(orgId: string, input: CreateCategoryInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateCategoryInput) {
    const row = await this.repo.update(orgId, id, input);
    if (!row) throw new NotFoundError("Category");
    return row;
  }
}
