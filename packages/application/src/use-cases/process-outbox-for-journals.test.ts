import { describe, expect, it } from "vitest";
import { PeriodClosedError } from "@stock-management/domain";
import { makeFakeAccounting } from "../accounting/fake-accounting.js";
import { EnsureDefaultChartOfAccounts } from "./ensure-default-chart-of-accounts.js";
import { ProcessOutboxForJournals } from "./process-outbox-for-journals.js";

function makeJournalHarness() {
  const { port } = makeFakeAccounting();
  const ensureDefaults = new EnsureDefaultChartOfAccounts(port);
  const processor = new ProcessOutboxForJournals(port, ensureDefaults);

  async function ensureCoveringPeriod(onDate = new Date().toISOString().slice(0, 10)) {
    const [y, m] = onDate.split("-").map(Number);
    const year = y!;
    const month = m!;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    await port.insertPeriod({
      orgId: "org-1",
      year,
      month,
      startsOn: `${year}-${pad(month)}-01`,
      endsOn: `${year}-${pad(month)}-${pad(lastDay)}`,
      status: "open",
    });
  }

  async function closeCoveringPeriod() {
    const onDate = new Date().toISOString().slice(0, 10);
    const period = await port.findPeriodCoveringDate("org-1", onDate);
    if (!period) throw new Error("no period");
    await port.setPeriodStatus("org-1", period.id, "closed");
  }

  return { port, processor, ensureCoveringPeriod, closeCoveringPeriod };
}

describe("ProcessOutboxForJournals", () => {
  it("creates Dr Inventory Cr GRNI journal idempotently", async () => {
    const { processor, port, ensureCoveringPeriod } = makeJournalHarness();
    await ensureCoveringPeriod();
    const event = {
      id: "evt-1",
      orgId: "org-1",
      eventType: "document.posted",
      aggregateType: "goods_receipt",
      aggregateId: "gr-1",
      payload: { inventoryValueDelta: "30" },
    };
    const first = await processor.execute(event);
    expect(first?.lines).toHaveLength(2);
    const inv = await port.findAccountByCode("org-1", "1300");
    const grni = await port.findAccountByCode("org-1", "2100");
    expect(first?.lines[0]).toMatchObject({
      accountId: inv!.id,
      debit: "30",
      credit: "0",
    });
    expect(first?.lines[1]).toMatchObject({
      accountId: grni!.id,
      debit: "0",
      credit: "30",
    });
    const second = await processor.execute(event);
    expect(second?.id).toBe(first?.id);
  });

  it("rejects when period is closed", async () => {
    const { processor, ensureCoveringPeriod, closeCoveringPeriod } =
      makeJournalHarness();
    await ensureCoveringPeriod();
    await closeCoveringPeriod();
    await expect(
      processor.execute({
        id: "evt-x",
        orgId: "org-1",
        eventType: "document.posted",
        aggregateType: "goods_receipt",
        aggregateId: "gr-1",
        payload: { inventoryValueDelta: "10" },
      }),
    ).rejects.toBeInstanceOf(PeriodClosedError);
  });
});
