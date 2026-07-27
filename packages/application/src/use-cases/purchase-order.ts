import {
  InvalidStateError,
  NotFoundError,
  assertCanApprovePo,
  assertCanSubmitPo,
} from "@stock-management/domain";
import type {
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "../dto/inputs.js";
import type { BranchListFilter } from "../access/list-scope.js";
import type { PurchaseOrderPort } from "../ports/inventory.js";

export class PurchaseOrderUseCases {
  constructor(private readonly repo: PurchaseOrderPort) {}

  list(orgId: string, filter?: BranchListFilter) {
    return this.repo.list(orgId, filter);
  }

  async get(orgId: string, id: string) {
    const purchaseOrder = await this.repo.findById(orgId, id);
    if (!purchaseOrder) throw new NotFoundError("Purchase order");
    return purchaseOrder;
  }

  create(orgId: string, input: CreatePurchaseOrderInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdatePurchaseOrderInput) {
    const current = await this.get(orgId, id);
    if (current.status !== "draft") {
      throw new InvalidStateError("Only draft purchase orders can be updated");
    }
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Purchase order");
    return updated;
  }

  async submit(orgId: string, id: string) {
    const purchaseOrder = await this.get(orgId, id);
    assertCanSubmitPo(purchaseOrder);
    return this.repo.updateStatus(orgId, id, "submitted");
  }

  async approve(orgId: string, id: string) {
    const purchaseOrder = await this.get(orgId, id);
    assertCanApprovePo(purchaseOrder);
    return this.repo.updateStatus(orgId, id, "approved");
  }

  async cancel(orgId: string, id: string) {
    const purchaseOrder = await this.get(orgId, id);
    if (!["draft", "submitted", "approved"].includes(purchaseOrder.status)) {
      throw new InvalidStateError(
        `Cannot cancel purchase order in status ${purchaseOrder.status}`,
      );
    }
    return this.repo.updateStatus(orgId, id, "cancelled");
  }

  async close(orgId: string, id: string) {
    const purchaseOrder = await this.get(orgId, id);
    if (
      !["submitted", "approved", "partially_received", "received"].includes(
        purchaseOrder.status,
      )
    ) {
      throw new InvalidStateError(
        `Cannot close purchase order in status ${purchaseOrder.status}`,
      );
    }
    return this.repo.updateStatus(orgId, id, "closed");
  }
}
