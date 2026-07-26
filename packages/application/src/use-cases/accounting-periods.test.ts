import { describe, expect, it } from "vitest";
import { makeFakeAccounting } from "../accounting/fake-accounting.js";
import { AccountingPeriodUseCases } from "./accounting-periods.js";

function makePeriodHarness(fiscalYearStartMonth: number) {
  const { port } = makeFakeAccounting();
  const uc = new AccountingPeriodUseCases(port, async () => fiscalYearStartMonth);
  return { port, uc };
}

describe("AccountingPeriodUseCases", () => {
  it("generates 12 open periods for fiscal year starting in January", async () => {
    const { uc } = makePeriodHarness(1);
    const result = await uc.generate("org-1", 2026);
    expect(result.created).toHaveLength(12);
    expect(result.created[0]).toMatchObject({
      year: 2026,
      month: 1,
      status: "open",
      startsOn: "2026-01-01",
      endsOn: "2026-01-31",
    });
    const again = await uc.generate("org-1", 2026);
    expect(again.created).toHaveLength(0);
    expect(again.existing).toHaveLength(12);
  });

  it("closes and reopens a period", async () => {
    const { uc } = makePeriodHarness(1);
    const { created } = await uc.generate("org-1", 2026);
    const closed = await uc.close("org-1", created[0]!.id);
    expect(closed.status).toBe("closed");
    const opened = await uc.open("org-1", created[0]!.id);
    expect(opened.status).toBe("open");
  });
});
