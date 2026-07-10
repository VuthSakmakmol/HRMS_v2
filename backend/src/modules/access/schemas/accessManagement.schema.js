import { z } from "zod";

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/);
const optionalObjectId = z
  .union([objectId, z.literal(""), z.null()])
  .optional();
const code = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, "_").toUpperCase())
  .pipe(
    z
      .string()
      .min(2)
      .max(80)
      .regex(/^[A-Z0-9_-]+$/),
  );
const text = (min, max) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(z.string().min(min).max(max));

export const idParamSchema = z.object({ id: objectId });
export const roleListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
});
export const roleCreateSchema = z.object({
  code,
  name: text(2, 120),
  description: z.string().trim().max(500).default(""),
  scope: z.enum(["GLOBAL", "COMPANY"]).default("COMPANY"),
  companyId: optionalObjectId,
  permissionIds: z.array(objectId).default([]),
  isActive: z.boolean().default(true),
});
export const roleUpdateSchema = roleCreateSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0);

const assignmentSchema = z.object({
  roleId: objectId,
  companyId: optionalObjectId,
  allBranches: z.boolean().default(true),
  branchIds: z.array(objectId).default([]),
});
export const accountListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["ALL", "ACTIVE", "DISABLED", "LOCKED"]).default("ALL"),
});
export const accountCreateSchema = z.object({
  loginId: z.string().trim().toLowerCase().min(3).max(120),
  displayName: text(2, 160),
  password: z.string().min(8).max(128),
  employeeId: optionalObjectId,
  status: z.enum(["ACTIVE", "DISABLED", "LOCKED"]).default("ACTIVE"),
  roleAssignments: z.array(assignmentSchema).default([]),
});
export const accountUpdateSchema = z
  .object({
    loginId: z.string().trim().toLowerCase().min(3).max(120).optional(),
    displayName: text(2, 160).optional(),
    employeeId: optionalObjectId,
    status: z.enum(["ACTIVE", "DISABLED", "LOCKED"]).optional(),
    roleAssignments: z.array(assignmentSchema).optional(),
  })
  .refine((v) => Object.keys(v).length > 0);
export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});
