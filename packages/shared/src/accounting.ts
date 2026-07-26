import { z } from "zod";
import { UuidSchema } from "./enums.js";

export const AccountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
]);

export const AccountSchema = z.object({
  id: UuidSchema,
  code: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  active: z.boolean(),
});

export const CreateAccountBodySchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(256),
  type: AccountTypeSchema,
});

export const PatchAccountBodySchema = z.object({
  name: z.string().min(1).max(256).optional(),
  active: z.boolean().optional(),
});

export const UpsertMappingBodySchema = z.object({
  journalEventType: z.string().min(1),
  debitAccountId: UuidSchema,
  creditAccountId: UuidSchema,
});

export const GeneratePeriodsBodySchema = z.object({
  fiscalYear: z.number().int().min(2000).max(2100),
});

export const JournalsQuerySchema = z.object({
  sourceDocumentType: z.string().min(1),
  sourceDocumentId: UuidSchema,
});

export const JournalLineSchema = z.object({
  id: UuidSchema,
  accountId: UuidSchema,
  debit: z.string(),
  credit: z.string(),
  lineNo: z.number().int(),
});

export const JournalSchema = z.object({
  id: UuidSchema,
  periodId: UuidSchema,
  branchId: UuidSchema.nullable(),
  sourceDocumentType: z.string(),
  sourceDocumentId: UuidSchema,
  outboxEventId: UuidSchema.nullable(),
  reversesJournalId: UuidSchema.nullable(),
  postedAt: z.string().datetime(),
  lines: z.array(JournalLineSchema),
});

export type CreateAccountBody = z.infer<typeof CreateAccountBodySchema>;
export type PatchAccountBody = z.infer<typeof PatchAccountBodySchema>;
export type UpsertMappingBody = z.infer<typeof UpsertMappingBodySchema>;
export type GeneratePeriodsBody = z.infer<typeof GeneratePeriodsBodySchema>;
export type JournalsQuery = z.infer<typeof JournalsQuerySchema>;

const MoneyStringSchema = z.string().regex(/^-?\d+\.\d{4}$/);

export const AccountBalanceRowSchema = z.object({
  accountId: UuidSchema,
  code: z.string(),
  name: z.string(),
  type: AccountTypeSchema,
  debitTotal: MoneyStringSchema,
  creditTotal: MoneyStringSchema,
  net: MoneyStringSchema.optional(),
});

export const TrialBalanceQuerySchema = z
  .object({
    periodId: UuidSchema.optional(),
    asOf: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    branchId: UuidSchema.optional(),
  })
  .refine((q) => Boolean(q.periodId) !== Boolean(q.asOf), {
    message: "Provide exactly one of periodId or asOf",
  });

export const TrialBalanceResponseSchema = z.object({
  rows: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  totalDebit: MoneyStringSchema,
  totalCredit: MoneyStringSchema,
});

export const PnlQuerySchema = z.object({
  periodId: UuidSchema,
  branchId: UuidSchema.optional(),
});

export const PnlResponseSchema = z.object({
  income: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  expense: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  totalIncome: MoneyStringSchema,
  totalExpense: MoneyStringSchema,
  netIncome: MoneyStringSchema,
});

export const BalanceSheetQuerySchema = z.object({
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  branchId: UuidSchema.optional(),
});

export const BalanceSheetResponseSchema = z.object({
  assets: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  liabilities: z.array(
    AccountBalanceRowSchema.extend({ net: MoneyStringSchema }),
  ),
  equity: z.array(AccountBalanceRowSchema.extend({ net: MoneyStringSchema })),
  netIncome: MoneyStringSchema,
  totalAssets: MoneyStringSchema,
  totalLiabilities: MoneyStringSchema,
  totalEquity: MoneyStringSchema,
  balanced: z.boolean(),
});

export const AccountingPeriodIdParamsSchema = z.object({ id: UuidSchema });

export const CloseChecklistWarningSchema = z.object({
  code: z.enum([
    "UNPOSTED_INVENTORY_DOCS",
    "OUTBOX_PENDING_OR_FAILED",
    "UNMATCHED_GRNI",
    "DRAFT_SUPPLIER_INVOICES",
  ]),
  message: z.string(),
  count: z.number().int().optional(),
  amount: MoneyStringSchema.optional(),
  documentType: z.string().optional(),
});

export const CloseChecklistResponseSchema = z.object({
  periodId: UuidSchema,
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  warnings: z.array(CloseChecklistWarningSchema),
  canCloseSuggested: z.boolean(),
});

export type TrialBalanceQuery = z.infer<typeof TrialBalanceQuerySchema>;
export type PnlQuery = z.infer<typeof PnlQuerySchema>;
export type BalanceSheetQuery = z.infer<typeof BalanceSheetQuerySchema>;
