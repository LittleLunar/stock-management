import type { UpdateOrganization } from "@stock-management/shared";
import { notFound, unauthorized } from "../../lib/errors.js";
import type { OrgRepository } from "./org.repository.js";

export class OrgService {
  constructor(private readonly repo: OrgRepository) {}

  async get(orgId: string, requestedId: string) {
    if (orgId !== requestedId) {
      throw unauthorized("Cannot access another organization");
    }
    const org = await this.repo.findById(requestedId);
    if (!org) throw notFound("Organization");
    return org;
  }

  async update(orgId: string, requestedId: string, input: UpdateOrganization) {
    if (orgId !== requestedId) {
      throw unauthorized("Cannot access another organization");
    }
    const org = await this.repo.update(requestedId, input);
    if (!org) throw notFound("Organization");
    return org;
  }

  create(input: {
    name: string;
    currency?: string;
    timezone?: string;
    fiscalYearStartMonth?: number;
  }) {
    return this.repo.create(input);
  }
}
