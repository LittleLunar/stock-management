import { InvalidStateError, NotFoundError } from "@stock-management/domain";
import type {
  CreateGoodsReceiptInput,
  UpdateGoodsReceiptInput,
} from "../dto/inputs.js";
import type { BranchListFilter } from "../access/list-scope.js";
import type { GoodsReceiptPort } from "../ports/inventory.js";

export class GoodsReceiptUseCases {
  constructor(private readonly repo: GoodsReceiptPort) {}

  list(orgId: string, filter?: BranchListFilter) {
    return this.repo.list(orgId, filter);
  }

  async get(orgId: string, id: string) {
    const receipt = await this.repo.findById(orgId, id);
    if (!receipt) throw new NotFoundError("Goods receipt");
    return receipt;
  }

  create(orgId: string, input: CreateGoodsReceiptInput) {
    return this.repo.create(orgId, input);
  }

  async update(orgId: string, id: string, input: UpdateGoodsReceiptInput) {
    const current = await this.get(orgId, id);
    if (current.status !== "draft") {
      throw new InvalidStateError("Only draft goods receipts can be updated");
    }
    const updated = await this.repo.update(orgId, id, input);
    if (!updated) throw new NotFoundError("Goods receipt");
    return updated;
  }
}
