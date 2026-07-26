import { describe, expect, it } from "vitest";
import { ThreeWayMatchError } from "@stock-management/domain";
import { makeThreeWayDodHarness } from "./supplier-invoice.harness.js";

describe("supplier invoice three-way DoD", () => {
  it("happy path posts match journal", async () => {
    const { post, seedDraft, accounts } = makeThreeWayDodHarness();
    const accts = await accounts();
    const draftId = await seedDraft({
      qty: "2",
      unitCost: "10",
      amount: "20",
    });
    const result = await post.execute("org-1", "user-1", draftId);
    expect(result.invoice.status).toBe("posted");
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({
      matchedQty: "2",
      matchedAmount: "20",
    });
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

  it("rejects over-qty against remaining GR", async () => {
    const { post, seedDraft, seedPostedMatch } = makeThreeWayDodHarness({
      grQty: "2",
    });
    await seedPostedMatch({
      grLineId: "grl-1",
      poLineId: "pol-1",
      matchedQty: "2",
      matchedAmount: "20",
    });
    const draftId = await seedDraft({
      qty: "1",
      unitCost: "10",
      amount: "10",
    });
    await expect(post.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
      ThreeWayMatchError,
    );
  });

  it("rejects cost mismatch", async () => {
    const { post, seedDraft } = makeThreeWayDodHarness();
    const draftId = await seedDraft({
      qty: "1",
      unitCost: "11",
      amount: "11",
    });
    await expect(post.execute("org-1", "user-1", draftId)).rejects.toBeInstanceOf(
      ThreeWayMatchError,
    );
  });

  it("void reverses AP journal and frees capacity", async () => {
    const { post, voidInvoice, seedDraft, accounts } = makeThreeWayDodHarness({
      grQty: "2",
    });
    const accts = await accounts();
    const firstId = await seedDraft({
      invoiceNumber: "INV-1",
      qty: "2",
      unitCost: "10",
      amount: "20",
    });
    const posted = await post.execute("org-1", "user-1", firstId);
    const voided = await voidInvoice.execute("org-1", "user-1", firstId);
    expect(voided.invoice.status).toBe("voided");
    expect(voided.reverseJournal.reversesJournalId).toBe(posted.journal.id);
    expect(voided.reverseJournal.lines[0]).toMatchObject({
      accountId: accts.ap.id,
      debit: "20",
      credit: "0",
    });
    expect(voided.reverseJournal.lines[1]).toMatchObject({
      accountId: accts.grni.id,
      debit: "0",
      credit: "20",
    });

    const secondId = await seedDraft({
      invoiceNumber: "INV-2",
      qty: "2",
      unitCost: "10",
      amount: "20",
    });
    const repost = await post.execute("org-1", "user-1", secondId);
    expect(repost.invoice.status).toBe("posted");
    expect(repost.matches[0]!.matchedQty).toBe("2");
  });

  it("post is idempotent on external_system+external_id", async () => {
    const { post, seedDraft } = makeThreeWayDodHarness();
    const id = await seedDraft({
      qty: "1",
      unitCost: "10",
      amount: "10",
    });
    const a = await post.execute("org-1", "user-1", id, {
      externalSystem: "pos",
      externalId: "bill-1",
    });
    const b = await post.execute("org-1", "user-1", id, {
      externalSystem: "pos",
      externalId: "bill-1",
    });
    expect(b.journal.id).toBe(a.journal.id);
    expect(b.invoice.status).toBe("posted");
  });
});
