import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"

import { hrManagementDashboardQuerySchema } from "../schemas/hrManagementDashboard.schema.js"
import { getHrManagementDashboard } from "../services/hrManagementDashboard.service.js"

const router = Router()

const PERMISSIONS = Object.freeze({
    VIEW: "REPORT.HR_ANALYTICS.VIEW",
})

function parseRequest(schema, value) {
    const parsed = schema.safeParse(value)

    if (!parsed.success) {
        throw new AppError({
            statusCode: 422,
            code: "VALIDATION_FAILED",
            messageKey: "errors.validationFailed",
            fields: parsed.error.flatten().fieldErrors,
        })
    }

    return parsed.data
}

router.use(requireAuthentication)

router.get("/", requirePermission(PERMISSIONS.VIEW), async (req, res, next) => {
    try {
        const query = parseRequest(hrManagementDashboardQuerySchema, req.query)
        const dashboard = await getHrManagementDashboard({
            query,
            user: req.auth.user,
        })

        res.status(200).json({
            success: true,
            data: {
                dashboard,
            },
        })
    } catch (error) {
        next(error)
    }
})

export default router
