import { NotFoundError, UnauthorizedError } from "@stock-management/domain";
import type { CreateOrganizationInput, UpdateOrganizationInput } from "../dto/inputs.js";
import type {
  OrganizationOwnerInput,
  OrganizationRepository,
} from "../ports/repositories.js";

export class OrganizationUseCases {
  constructor(private readonly repo: OrganizationRepository) {}

  async get(orgId: string, requestedId: string) {
    if (orgId !== requestedId) {
      throw new UnauthorizedError("Cannot access another organization");
    }
    const org = await this.repo.findById(requestedId);
    if (!org) throw new NotFoundError("Organization");
    return org;
  }

  async update(orgId: string, requestedId: string, input: UpdateOrganizationInput) {
    if (orgId !== requestedId) {
      throw new UnauthorizedError("Cannot access another organization");
    }
    const org = await this.repo.update(requestedId, input);
    if (!org) throw new NotFoundError("Organization");
    return org;
  }

  create(input: CreateOrganizationInput) {
    return this.repo.create(input);
  }

  createWithOwner(input: CreateOrganizationInput, owner: OrganizationOwnerInput) {
    return this.repo.createWithOwner(input, owner);
  }
}
