import { NotFoundError } from "@stock-management/domain";
import type { CreateBranchInput, UpdateBranchInput } from "../dto/inputs.js";
import type { BranchRepository } from "../ports/repositories.js";

export class BranchUseCases {
  constructor(private readonly repo: BranchRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const branch = await this.repo.findById(orgId, id);
    if (!branch) throw new NotFoundError("Branch");
    return branch;
  }

  create(orgId: string, input: CreateBranchInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateBranchInput) {
    const branch = await this.repo.update(orgId, id, input);
    if (!branch) throw new NotFoundError("Branch");
    return branch;
  }
}
