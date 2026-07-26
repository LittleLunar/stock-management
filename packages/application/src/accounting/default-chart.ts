import type { AccountType, JournalEventType } from "@stock-management/domain";

export const DEFAULT_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: AccountType;
}> = [
  { code: "1300", name: "Inventory", type: "asset" },
  { code: "1350", name: "Landed Cost Clearing", type: "asset" },
  { code: "2000", name: "Accounts Payable", type: "liability" },
  { code: "2100", name: "GRNI", type: "liability" },
  { code: "3900", name: "Revaluation Reserve", type: "equity" },
  { code: "5000", name: "COGS", type: "expense" },
  { code: "5100", name: "Inventory Adjustment Expense", type: "expense" },
];

export const DEFAULT_MAPPING_SPECS: Array<{
  journalEventType: JournalEventType;
  debitCode: string;
  creditCode: string;
}> = [
  {
    journalEventType: "goods_receipt.posted",
    debitCode: "1300",
    creditCode: "2100",
  },
  {
    journalEventType: "goods_receipt.voided",
    debitCode: "2100",
    creditCode: "1300",
  },
  {
    journalEventType: "stock_issue.posted",
    debitCode: "5000",
    creditCode: "1300",
  },
  {
    journalEventType: "stock_issue.voided",
    debitCode: "1300",
    creditCode: "5000",
  },
  {
    journalEventType: "supplier_return.posted",
    debitCode: "5000",
    creditCode: "1300",
  },
  {
    journalEventType: "supplier_return.voided",
    debitCode: "1300",
    creditCode: "5000",
  },
  {
    journalEventType: "inventory_decrease.posted",
    debitCode: "5100",
    creditCode: "1300",
  },
  {
    journalEventType: "inventory_decrease.voided",
    debitCode: "1300",
    creditCode: "5100",
  },
  {
    journalEventType: "inventory_increase.posted",
    debitCode: "1300",
    creditCode: "5100",
  },
  {
    journalEventType: "inventory_increase.voided",
    debitCode: "5100",
    creditCode: "1300",
  },
  {
    journalEventType: "landed_cost.posted",
    debitCode: "1300",
    creditCode: "1350",
  },
  {
    journalEventType: "landed_cost.voided",
    debitCode: "1350",
    creditCode: "1300",
  },
  {
    journalEventType: "cost_revaluation.increase",
    debitCode: "1300",
    creditCode: "3900",
  },
  {
    journalEventType: "cost_revaluation.increase.voided",
    debitCode: "3900",
    creditCode: "1300",
  },
  {
    journalEventType: "cost_revaluation.decrease",
    debitCode: "3900",
    creditCode: "1300",
  },
  {
    journalEventType: "cost_revaluation.decrease.voided",
    debitCode: "1300",
    creditCode: "3900",
  },
  {
    journalEventType: "supplier_invoice.posted",
    debitCode: "2100",
    creditCode: "2000",
  },
  {
    journalEventType: "supplier_invoice.voided",
    debitCode: "2000",
    creditCode: "2100",
  },
];
