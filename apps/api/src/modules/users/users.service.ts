import type { CreateMembership, CreateUser } from "@stock-management/shared";
import { notFound } from "../../lib/errors.js";
import type { UsersRepository } from "./users.repository.js";

export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  listUsers(orgId: string) {
    return this.repo.listUsers(orgId);
  }

  createUser(orgId: string, input: CreateUser) {
    return this.repo.createUser(orgId, input);
  }

  listMemberships(orgId: string) {
    return this.repo.listMemberships(orgId);
  }

  createMembership(orgId: string, input: CreateMembership) {
    return this.repo.createMembership(orgId, input);
  }

  async getMembership(orgId: string, id: string) {
    const row = await this.repo.findMembership(orgId, id);
    if (!row) throw notFound("Membership");
    return row;
  }
}
