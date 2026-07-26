import type { AccountType } from "./types.js";

export function formatMoney(n: number): string {
  return (Math.round(n * 10000) / 10000).toFixed(4);
}

export type AccountBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debitTotal: string;
  creditTotal: string;
};

export type TrialBalanceReport = {
  rows: Array<AccountBalanceRow & { net: string }>;
  totalDebit: string;
  totalCredit: string;
};

export function buildTrialBalance(rows: AccountBalanceRow[]): TrialBalanceReport {
  let totalDebit = 0;
  let totalCredit = 0;
  const reportRows = rows.map((row) => {
    const debit = Number(row.debitTotal);
    const credit = Number(row.creditTotal);
    totalDebit += debit;
    totalCredit += credit;
    return {
      ...row,
      net: formatMoney(debit - credit),
    };
  });
  return {
    rows: reportRows,
    totalDebit: formatMoney(totalDebit),
    totalCredit: formatMoney(totalCredit),
  };
}

export type PnlReport = {
  income: Array<AccountBalanceRow & { net: string }>;
  expense: Array<AccountBalanceRow & { net: string }>;
  totalIncome: string;
  totalExpense: string;
  netIncome: string;
};

export function buildPnl(rows: AccountBalanceRow[]): PnlReport {
  const income: Array<AccountBalanceRow & { net: string }> = [];
  const expense: Array<AccountBalanceRow & { net: string }> = [];
  let totalIncome = 0;
  let totalExpense = 0;

  for (const row of rows) {
    const debit = Number(row.debitTotal);
    const credit = Number(row.creditTotal);
    const net = debit - credit;
    if (row.type === "income") {
      const contribution = -net;
      totalIncome += contribution;
      income.push({ ...row, net: formatMoney(contribution) });
    } else if (row.type === "expense") {
      totalExpense += net;
      expense.push({ ...row, net: formatMoney(net) });
    }
  }

  return {
    income,
    expense,
    totalIncome: formatMoney(totalIncome),
    totalExpense: formatMoney(totalExpense),
    netIncome: formatMoney(totalIncome - totalExpense),
  };
}

export type BalanceSheetReport = {
  assets: Array<AccountBalanceRow & { net: string }>;
  liabilities: Array<AccountBalanceRow & { net: string }>;
  equity: Array<AccountBalanceRow & { net: string }>;
  netIncome: string;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  balanced: boolean;
};

export function buildBalanceSheet(rows: AccountBalanceRow[]): BalanceSheetReport {
  const pnl = buildPnl(rows);
  const assets: Array<AccountBalanceRow & { net: string }> = [];
  const liabilities: Array<AccountBalanceRow & { net: string }> = [];
  const equity: Array<AccountBalanceRow & { net: string }> = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let equityAccountsTotal = 0;

  for (const row of rows) {
    const debit = Number(row.debitTotal);
    const credit = Number(row.creditTotal);
    if (row.type === "asset") {
      const amount = debit - credit;
      totalAssets += amount;
      assets.push({ ...row, net: formatMoney(amount) });
    } else if (row.type === "liability") {
      const amount = credit - debit;
      totalLiabilities += amount;
      liabilities.push({ ...row, net: formatMoney(amount) });
    } else if (row.type === "equity") {
      const amount = credit - debit;
      equityAccountsTotal += amount;
      equity.push({ ...row, net: formatMoney(amount) });
    }
  }

  const netIncomeNum = Number(pnl.netIncome);
  const totalEquity = equityAccountsTotal + netIncomeNum;
  const diff = Math.abs(totalAssets - (totalLiabilities + totalEquity));

  return {
    assets,
    liabilities,
    equity,
    netIncome: pnl.netIncome,
    totalAssets: formatMoney(totalAssets),
    totalLiabilities: formatMoney(totalLiabilities),
    totalEquity: formatMoney(totalEquity),
    balanced: diff < 0.0001,
  };
}
