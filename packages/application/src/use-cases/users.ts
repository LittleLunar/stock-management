import { NotFoundError } from "@stock-management/domain";
import type { CreateMembershipInput, CreateUserInput } from "../dto/inputs.js";
import type { UsersRepository } from "../ports/repositories.js";

export class UsersUseCases {
  constructor(private readonly repo: UsersRepository) {}

  listUsers(orgId: string) {
    return this.repo.listUsers(orgId);
  }

  createUser(orgId: string, input: CreateUserInput) {
    return this.repo.createUser(orgId, input);
  }

  listMemberships(orgId: string) {
    return this.repo.listMemberships(orgId);
  }

  createMembership(orgId: string, input: CreateMembershipInput) {
    return this.repo.createMembership(orgId, input);
  }

  async getMembership(orgId: string, id: string) {
    const row = await this.repo.findMembership(orgId, id);
    if (!row) throw new NotFoundError("Membership");
    return row;
  }
}
