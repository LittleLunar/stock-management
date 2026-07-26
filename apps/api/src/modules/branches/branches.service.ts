import type { CreateBranch, UpdateBranch } from "@stock-management/shared";
import { notFound } from "../../lib/errors.js";
import type { BranchRepository } from "./branches.repository.js";

export class BranchService {
  constructor(private readonly repo: BranchRepository) {}

  list(orgId: string) {
    return this.repo.list(orgId);
  }

  async get(orgId: string, id: string) {
    const branch = await this.repo.findById(orgId, id);
    if (!branch) throw notFound("Branch");
    return branch;
  }

  create(orgId: string, input: CreateBranch) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateBranch) {
    const branch = await this.repo.update(orgId, id, input);
    if (!branch) throw notFound("Branch");
    return branch;
  }
}
