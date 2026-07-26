import { describe, expect, it } from "vitest";
import {
  PeriodClosedError,
  ThreeWayMatchError,
} from "@stock-management/domain";
import { makeThreeWayDodHarness } from "./supplier-invoice.harness.js";

describe("PostSupplierInvoice", () => {
  it("posts with exact 3-way and writes Dr GRNI Cr AP journal", async () => {
    const { post, seedDraft, accounts } = makeThreeWayDodHarness();
    const accts = await accounts();
    const draftId = await seedDraft({ qty: "2", unitCost: "10", amount: "20" });
    const result = await post.execute("org-1", "user-1", draftId);
    expect(result.invoice.status).toBe("posted");
    expect(result.matches).toHaveLength(1);
    expect(result.journal.lines[0]).toMatchObject({
      accountId: accts.grni.id,
      debit: "20",
      credit: "0",
    });
    expect(result.journal.lines[1]).toMatchObject({
      accountId: accts.ap.id,
      debit: "0",
      credit: "20",
    });
    expect(result.journal.outboxEventId).toBeNull();
    expect(result.journal.sourceDocumentType).toBe("supplier_invoice");
  });

  it("rejects over-qty vs remaining GR", async () => {
    const { post, seedDraft, seedPostedMatch } = makeThreeWayDodHarness({
      grQty: "2",
    });
    await seedPostedMatch({
      grLineId: "grl-1",
      poLineId: "pol-1",
      matchedQty: "2",
      matchedAmount: "20",
    });
    const draftId = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
    await expect(post.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
      ThreeWayMatchError,
    );
  });

  it("rejects unit-cost mismatch", async () => {
    const { post, seedDraft } = makeThreeWayDodHarness({
      poUnitCost: "10",
      grUnitCost: "10",
    });
    const draftId = await seedDraft({ qty: "1", unitCost: "11", amount: "11" });
    await expect(post.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
      ThreeWayMatchError,
    );
  });

  it("rejects when period closed", async () => {
    const { post, seedDraft, closePeriod } = makeThreeWayDodHarness({
      periodClosed: true,
    });
    await closePeriod();
    const draftId = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
    await expect(post.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
      PeriodClosedError,
    );
  });
});
