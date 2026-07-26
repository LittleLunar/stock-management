import { and, eq } from "drizzle-orm";
import type {
  BranchRepository,
  CreateBranchInput,
  UpdateBranchInput,
} from "@stock-management/application";
import type { Branch } from "@stock-management/domain";
import type { Db } from "../db/client.js";
import { branches } from "../db/schema/index.js";

export class DrizzleBranchRepository implements BranchRepository {
  constructor(private readonly db: Db) {}

  list(orgId: string): Promise<Branch[]> {
    return this.db
      .select()
      .from(branches)
      .where(eq(branches.orgId, orgId)) as Promise<Branch[]>;
  }

  findById(orgId: string, id: string): Promise<Branch | null> {
    return this.db
      .select()
      .from(branches)
      .where(and(eq(branches.orgId, orgId), eq(branches.id, id)))
      .then((rows) => (rows[0] as Branch | undefined) ?? null);
  }

  async create(orgId: string, input: CreateBranchInput): Promise<Branch> {
    const [row] = await this.db
      .insert(branches)
      .values({
        orgId,
        code: input.code,
        name: input.name,
        status: input.status ?? "active",
      })
      .returning();
    return row as Branch;
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateBranchInput,
  ): Promise<Branch | null> {
    const [row] = await this.db
      .update(branches)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(branches.orgId, orgId), eq(branches.id, id)))
      .returning();
    return (row as Branch | undefined) ?? null;
  }
}
