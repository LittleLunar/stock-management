import { describe, expect, it } from "vitest";
import {
  InvoiceAlreadyVoidedError,
  InvoiceNotPostedError,
} from "@stock-management/domain";
import { makeThreeWayDodHarness } from "./supplier-invoice.harness.js";

describe("VoidSupplierInvoice", () => {
  it("voids posted invoice and reverses AP journal", async () => {
    const { post, voidInvoice, seedDraft, accounts } = makeThreeWayDodHarness();
    const accts = await accounts();
    const draftId = await seedDraft({ qty: "2", unitCost: "10", amount: "20" });
    const posted = await post.execute("org-1", "user-1", draftId);
    const voided = await voidInvoice.execute("org-1", "user-1", draftId);
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
  });

  it("rejects void of draft", async () => {
    const { voidInvoice, seedDraft } = makeThreeWayDodHarness();
    const id = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
    await expect(voidInvoice.execute("org-1", "user-1", id)).rejects.toBeInstanceOf(
      InvoiceNotPostedError,
    );
  });

  it("rejects double void", async () => {
    const { post, voidInvoice, seedDraft } = makeThreeWayDodHarness();
    const id = await seedDraft({ qty: "1", unitCost: "10", amount: "10" });
    await post.execute("org-1", "user-1", id);
    await voidInvoice.execute("org-1", "user-1", id);
    await expect(voidInvoice.execute("org-1", "user-1", id)).rejects.toBeInstanceOf(
      InvoiceAlreadyVoidedError,
    );
  });
});
