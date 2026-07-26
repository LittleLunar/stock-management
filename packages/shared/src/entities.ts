import { z } from "zod";
import {
  CostingMethodSchema,
  LocationTypeSchema,
  MasterStatusSchema,
  UuidSchema,
} from "./enums.js";

export const OrganizationSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  currency: z.string(),
  timezone: z.string(),
  fiscalYearStartMonth: z.number().int().optional(),
  status: MasterStatusSchema.optional(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

export const BranchSchema = z.object({
  id: UuidSchema,
  code: z.string(),
  name: z.string(),
  status: MasterStatusSchema.or(z.string()),
});
export type Branch = z.infer<typeof BranchSchema>;

export const LocationSchema = z.object({
  id: UuidSchema,
  branchId: UuidSchema,
  code: z.string(),
  name: z.string(),
  type: LocationTypeSchema.or(z.string()),
  status: MasterStatusSchema.or(z.string()),
});
export type Location = z.infer<typeof LocationSchema>;

export const ProductSchema = z.object({
  id: UuidSchema,
  sku: z.string(),
  name: z.string(),
  uom: z.string(),
  trackLot: z.boolean(),
  trackSerial: z.boolean(),
  trackExpiry: z.boolean(),
  costingMethod: CostingMethodSchema.or(z.string()).optional(),
  status: MasterStatusSchema.or(z.string()),
});
export type Product = z.infer<typeof ProductSchema>;

export const SupplierSchema = z.object({
  id: UuidSchema,
  code: z.string(),
  name: z.string(),
  status: MasterStatusSchema.or(z.string()),
});
export type Supplier = z.infer<typeof SupplierSchema>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(256),
  currency: z.string().min(3).max(3).optional(),
  timezone: z.string().min(1).max(64).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;
