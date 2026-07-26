import { NotFoundError } from "@stock-management/domain";
import type { CreateLocationInput, UpdateLocationInput } from "../dto/inputs.js";
import type { LocationRepository } from "../ports/repositories.js";

export class LocationUseCases {
  constructor(private readonly repo: LocationRepository) {}

  list(orgId: string, branchId?: string) {
    return this.repo.list(orgId, branchId);
  }

  async get(orgId: string, id: string) {
    const location = await this.repo.findById(orgId, id);
    if (!location) throw new NotFoundError("Location");
    return location;
  }

  create(orgId: string, input: CreateLocationInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateLocationInput) {
    const location = await this.repo.update(orgId, id, input);
    if (!location) throw new NotFoundError("Location");
    return location;
  }
}
