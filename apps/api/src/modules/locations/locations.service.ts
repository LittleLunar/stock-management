import type { CreateLocation, UpdateLocation } from "@stock-management/shared";
import { notFound } from "../../lib/errors.js";
import type { LocationRepository } from "./locations.repository.js";

export class LocationService {
  constructor(private readonly repo: LocationRepository) {}

  list(orgId: string, branchId?: string) {
    return this.repo.list(orgId, branchId);
  }

  async get(orgId: string, id: string) {
    const location = await this.repo.findById(orgId, id);
    if (!location) throw notFound("Location");
    return location;
  }

  create(orgId: string, input: CreateLocation) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateLocation) {
    const location = await this.repo.update(orgId, id, input);
    if (!location) throw notFound("Location");
    return location;
  }
}
