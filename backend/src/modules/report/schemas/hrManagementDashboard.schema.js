import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const optionalObjectIdSchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return undefined
        return value
    },
    objectIdSchema.optional(),
)

const dateOnlySchema = z.preprocess(
    (value) => {
        if (value === "" || value === undefined || value === null) return undefined
        return value
    },
    z.coerce.date().optional(),
)

const employmentStatuses = [
    "ALL",
    "WORKING",
    "RESIGNED",
    "TERMINATED",
    "ABANDONED",
    "PASSED_AWAY",
    "RETIRED",
]

export const hrManagementDashboardQuerySchema = z.object({
    companyId: optionalObjectIdSchema,
    branchId: optionalObjectIdSchema,
    departmentId: optionalObjectIdSchema,
    positionId: optionalObjectIdSchema,
    lineId: optionalObjectIdSchema,
    shiftId: optionalObjectIdSchema,
    employeeTypeId: optionalObjectIdSchema,
    employeeTypeChildId: optionalObjectIdSchema,

    asOfDate: dateOnlySchema,
    fromDate: dateOnlySchema,
    toDate: dateOnlySchema,

    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),

    gender: z.enum(["ALL", "MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("ALL"),
    nationality: z.string().trim().max(120).optional().default(""),
    employmentStatus: z.enum(employmentStatuses).default("ALL"),
})
