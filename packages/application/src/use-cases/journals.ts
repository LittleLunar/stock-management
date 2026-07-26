import { NotFoundError } from "@stock-management/domain";
import type { AccountingPort, JournalWithLines } from "../ports/accounting.js";

export class JournalUseCases {
  constructor(private readonly accounting: AccountingPort) {}

  async getById(orgId: string, id: string): Promise<JournalWithLines> {
    const journal = await this.accounting.findJournalById(orgId, id);
    if (!journal) throw new NotFoundError("Journal");
    return journal;
  }

  listBySourceDocument(
    orgId: string,
    sourceDocumentType: string,
    sourceDocumentId: string,
  ): Promise<JournalWithLines[]> {
    return this.accounting.listJournalsBySourceDocument(
      orgId,
      sourceDocumentType,
      sourceDocumentId,
    );
  }
}
