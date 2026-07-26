import type { AccountingPeriod, JournalLineDraft } from "./entities.js";
import type { JournalEventType } from "./types.js";
import {
  PeriodClosedError,
  UnbalancedJournalError,
} from "./errors.js";

export function assertJournalBalanced(
  lines: Pick<JournalLineDraft, "debit" | "credit">[],
): void {
  const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
  if (debit !== credit) {
    throw new UnbalancedJournalError(
      `Journal unbalanced: debit=${debit} credit=${credit}`,
    );
  }
}

export function assertPeriodOpen(
  period: Pick<AccountingPeriod, "status">,
): void {
  if (period.status !== "open") {
    throw new PeriodClosedError();
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthBounds(
  year: number,
  month: number,
): { startsOn: string; endsOn: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startsOn: `${year}-${pad2(month)}-01`,
    endsOn: `${year}-${pad2(month)}-${pad2(lastDay)}`,
  };
}

export function periodsForFiscalYear(
  fiscalYearStartMonth: number,
  fiscalYear: number,
): Array<{ year: number; month: number; startsOn: string; endsOn: string }> {
  const periods: Array<{
    year: number;
    month: number;
    startsOn: string;
    endsOn: string;
  }> = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = fiscalYearStartMonth - 1 + i;
    const year = fiscalYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    periods.push({ year, month, ...monthBounds(year, month) });
  }
  return periods;
}

export function moneyAbs(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Math.abs(n));
}

export function voidEventType(postedType: JournalEventType): JournalEventType {
  if (postedType.endsWith(".voided")) return postedType;
  if (postedType.endsWith(".posted")) {
    return `${postedType.slice(0, -".posted".length)}.voided` as JournalEventType;
  }
  return `${postedType}.voided` as JournalEventType;
}
