import { z } from "zod"

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const optionalObjectIdSchema = z.preprocess(
    (value) => {
        if (value === "" || value === null || value === undefined) {
            return undefined
        }

        return value
    },
    objectIdSchema.optional(),
)

const dateKeySchema = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Date must use YYYY-MM-DD format.",
})

function getTodayDateKey() {
    return new Date().toISOString().slice(0, 10)
}

export const ATTENDANCE_DASHBOARD_STATUSES = [
    "PRESENT",
    "LATE",
    "EARLY_LEAVE",
    "LATE_AND_EARLY_LEAVE",
    "MISSING_IN",
    "MISSING_OUT",
    "ABSENT",
    "REST_DAY",
    "HOLIDAY",
]

export const attendanceDashboardQuerySchema = z
    .object({
        dateFrom: dateKeySchema.optional().default(getTodayDateKey),
        dateTo: dateKeySchema.optional().default(getTodayDateKey),
        companyId: optionalObjectIdSchema,
        branchId: optionalObjectIdSchema,
        departmentId: optionalObjectIdSchema,
        positionId: optionalObjectIdSchema,
        lineId: optionalObjectIdSchema,
        shiftId: optionalObjectIdSchema,
        employeeTypeId: optionalObjectIdSchema,
        status: z.enum(["ALL", ...ATTENDANCE_DASHBOARD_STATUSES]).default("ALL"),
        search: z.string().trim().max(120).optional().default(""),
        reviewLimit: z.coerce.number().int().min(1).max(100).default(20),
        topLimit: z.coerce.number().int().min(1).max(50).default(10),
    })
    .superRefine((value, context) => {
        if (value.dateFrom > value.dateTo) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["dateTo"],
                message: "End date must be after start date.",
            })
        }

        const startTime = new Date(`${value.dateFrom}T00:00:00.000Z`).getTime()
        const endTime = new Date(`${value.dateTo}T00:00:00.000Z`).getTime()
        const dayCount = Math.round((endTime - startTime) / 86_400_000) + 1

        if (dayCount > 370) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["dateTo"],
                message: "Dashboard range cannot exceed 370 days.",
            })
        }
    })
