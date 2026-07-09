import { z } from "zod"

const EMPLOYEE_TYPE_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"]
const EMPLOYEE_TYPE_UPDATE_STATUSES = ["ACTIVE", "INACTIVE"]

const objectIdSchema = z.string().trim().regex(/^[0-9a-fA-F]{24}$/, {
    message: "Invalid MongoDB ObjectId.",
})

const normalizedCodeSchema = z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "_").toUpperCase())
    .pipe(
        z
            .string()
            .min(2)
            .max(30)
            .regex(/^[A-Z0-9_-]+$/, {
                message:
                    "Code can contain uppercase letters, numbers, underscore, and dash only.",
            }),
    )

const normalizedTextSchema = (min, max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().min(min).max(max))

const optionalTextSchema = (max) =>
    z
        .string()
        .trim()
        .transform((value) => value.replace(/\s+/g, " "))
        .pipe(z.string().max(max))
        .optional()

const createPositionIdsSchema = z
    .array(objectIdSchema)
    .max(300)
    .optional()
    .default([])

const updatePositionIdsSchema = z.array(objectIdSchema).max(300).optional()

const employeeTypeChildSchema = z.object({
    code: normalizedCodeSchema.optional(),
    name: normalizedTextSchema(2, 120),
    positionIds: z.array(objectIdSchema).min(1).max(300),
})

function normalizeChildren(children = []) {
    return children.map((child) => ({
        ...child,
        code:
            child.code ||
            child.name
                .trim()
                .replace(/\s+/g, "_")
                .toUpperCase()
                .replace(/[^A-Z0-9_-]/g, ""),
        positionIds: [...new Set(child.positionIds || [])],
    }))
}

function validateAssignmentMode(payload, context) {
    const positionIds = payload.positionIds || []
    const children = payload.children || []
    const hasDirectPositions = positionIds.length > 0
    const hasChildren = children.length > 0

    if (hasDirectPositions && hasChildren) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["positionIds"],
            message:
                "Use direct positions or child groups, not both on the same employee type.",
        })
    }

    if (!hasDirectPositions && !hasChildren) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["positionIds"],
            message:
                "Add at least one direct position or one child group with positions.",
        })
    }

    const childCodeSet = new Set()
    const positionSet = new Set()

    for (const positionId of positionIds) {
        if (positionSet.has(positionId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["positionIds"],
                message: "Duplicate position selected.",
            })
            break
        }

        positionSet.add(positionId)
    }

    for (const [index, child] of children.entries()) {
        const childCode = child.code

        if (childCodeSet.has(childCode)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["children", index, "name"],
                message: "Duplicate child name in the same employee type.",
            })
        }

        childCodeSet.add(childCode)

        for (const positionId of child.positionIds || []) {
            if (positionSet.has(positionId)) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["children", index, "positionIds"],
                    message: "Duplicate position selected.",
                })
                break
            }

            positionSet.add(positionId)
        }
    }
}

export const employeeTypeIdParamSchema = z.object({
    employeeTypeId: objectIdSchema,
})

export const employeeTypeListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    companyId: objectIdSchema.optional(),
    branchId: objectIdSchema.optional(),
    departmentId: objectIdSchema.optional(),
    positionId: objectIdSchema.optional(),
    status: z.enum(["ALL", ...EMPLOYEE_TYPE_STATUSES]).default("ALL"),
    search: z.string().trim().max(120).optional().default(""),
})

export const employeeTypeCreateSchema = z
    .object({
        companyId: objectIdSchema,
        code: normalizedCodeSchema,
        name: normalizedTextSchema(2, 160),
        shortName: optionalTextSchema(80),
        positionIds: createPositionIdsSchema,
        children: z
            .array(employeeTypeChildSchema)
            .max(20)
            .optional()
            .default([])
            .transform(normalizeChildren),
        description: optionalTextSchema(500),
        status: z.enum(EMPLOYEE_TYPE_UPDATE_STATUSES).optional(),
    })
    .superRefine(validateAssignmentMode)

function validateUpdateAssignmentMode(payload, context) {
    if (payload.positionIds === undefined && payload.children === undefined) {
        return
    }

    validateAssignmentMode(payload, context)
}

export const employeeTypeUpdateSchema = z
    .object({
        code: normalizedCodeSchema.optional(),
        name: normalizedTextSchema(2, 160).optional(),
        shortName: optionalTextSchema(80),
        positionIds: updatePositionIdsSchema,
        children: z
            .array(employeeTypeChildSchema)
            .max(20)
            .optional()
            .transform((value) =>
                value === undefined ? undefined : normalizeChildren(value),
            ),
        description: optionalTextSchema(500),
        status: z.enum(EMPLOYEE_TYPE_UPDATE_STATUSES).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field is required.",
    })
    .superRefine(validateUpdateAssignmentMode)
