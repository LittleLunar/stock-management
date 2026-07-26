import type { CreateCategory, UpdateCategory } from "@stock-management/shared";
import { notFound } from "../../lib/errors.js";
import type { CategoryRepository } from "./categories.repository.js";

export class CategoryService {
  constructor(private readonly repo: CategoryRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const row = await this.repo.findById(orgId, id);
    if (!row) throw notFound("Category");
    return row;
  }

  create(orgId: string, input: CreateCategory) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateCategory) {
    const row = await this.repo.update(orgId, id, input);
    if (!row) throw notFound("Category");
    return row;
  }
}
