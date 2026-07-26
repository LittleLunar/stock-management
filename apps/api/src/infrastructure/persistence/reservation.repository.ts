import { and, eq, isNull, type SQL } from "drizzle-orm";
import type {
  CreateReservationInput,
  ReservationListFilters,
  ReservationPort,
  UpdateReservationInput,
} from "@stock-management/application";
import type { StockReservation } from "@stock-management/domain";
import type { DbClient } from "../db/client.js";
import { stockReservations } from "../db/schema/index.js";

export class DrizzleReservationRepository implements ReservationPort {
  constructor(
    private readonly db: DbClient,
    private readonly lockForUpdate = false,
  ) {}

  list(
    orgId: string,
    filters?: ReservationListFilters,
  ): Promise<StockReservation[]> {
    const conditions: SQL[] = [eq(stockReservations.orgId, orgId)];
    if (filters?.productId) {
      conditions.push(eq(stockReservations.productId, filters.productId));
    }
    if (filters?.locationId) {
      conditions.push(eq(stockReservations.locationId, filters.locationId));
    }
    if (filters?.branchId) {
      conditions.push(eq(stockReservations.branchId, filters.branchId));
    }
    if (filters?.status) {
      conditions.push(eq(stockReservations.status, filters.status));
    }
    if (filters?.lotId === null) {
      conditions.push(isNull(stockReservations.lotId));
    } else if (filters?.lotId) {
      conditions.push(eq(stockReservations.lotId, filters.lotId));
    }

    return this.db
      .select()
      .from(stockReservations)
      .where(and(...conditions)) as Promise<StockReservation[]>;
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<StockReservation | null> {
    const query = this.db
      .select()
      .from(stockReservations)
      .where(
        and(eq(stockReservations.orgId, orgId), eq(stockReservations.id, id)),
      );
    const rows = this.lockForUpdate ? await query.for("update") : await query;
    return (rows[0] as StockReservation | undefined) ?? null;
  }

  async create(
    orgId: string,
    input: CreateReservationInput,
  ): Promise<StockReservation> {
    const [row] = await this.db
      .insert(stockReservations)
      .values({
        orgId,
        branchId: input.branchId,
        productId: input.productId,
        locationId: input.locationId,
        lotId: input.lotId ?? null,
        qty: input.qty,
        expiresAt: input.expiresAt ?? null,
        externalSystem: input.externalSystem ?? null,
        externalId: input.externalId ?? null,
      })
      .returning();
    return row as StockReservation;
  }

  async update(
    orgId: string,
    id: string,
    input: UpdateReservationInput,
  ): Promise<StockReservation | null> {
    const [row] = await this.db
      .update(stockReservations)
      .set({
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.committedIssueId !== undefined
          ? { committedIssueId: input.committedIssueId }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(stockReservations.orgId, orgId), eq(stockReservations.id, id)),
      )
      .returning();
    return (row as StockReservation | undefined) ?? null;
  }
}
