import { and, eq } from "drizzle-orm";
import type {
  CreateLocationInput,
  LocationRepository,
  UpdateLocationInput,
} from "@stock-management/application";
import type { Location } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { locations } from "../db/schema/index.js";

export class DrizzleLocationRepository implements LocationRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string, branchId?: string): Promise<Location[]> {
    if (branchId) {
      return this.db
        .select()
        .from(locations)
        .where(and(eq(locations.orgId, orgId), eq(locations.branchId, branchId))) as Promise<
        Location[]
      >;
    }
    return this.db
      .select()
      .from(locations)
      .where(eq(locations.orgId, orgId)) as Promise<Location[]>;
  }

  findById(orgId: string, id: string): Promise<Location | null> {
    return this.db
      .select()
      .from(locations)
      .where(and(eq(locations.orgId, orgId), eq(locations.id, id)))
      .then((rows) => (rows[0] as Location | undefined) ?? null);
  }

  async create(orgId: string, input: CreateLocationInput): Promise<Location> {
    const [row] = await this.db
      .insert(locations)
      .values({
        orgId,
        branchId: input.branchId,
        code: input.code,
        name: input.name,
        type: input.type ?? "storage",
        status: input.status ?? "active",
      })
      .returning();
    return row as Location;
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateLocationInput,
  ): Promise<Location | null> {
    const [row] = await this.db
      .update(locations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(locations.orgId, orgId), eq(locations.id, id)))
      .returning();
    return (row as Location | undefined) ?? null;
  }
}
