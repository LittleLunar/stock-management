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

