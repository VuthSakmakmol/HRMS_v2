import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import { attendanceDashboardQuerySchema } from "../schemas/attendanceDashboard.schema.js"
import { getAttendanceDashboard } from "../services/attendanceDashboard.service.js"

const router = Router()

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

router.get(
    "/",
    requirePermission("ATTENDANCE.DASHBOARD.VIEW"),
    async (req, res, next) => {
        try {
            const query = parseRequest(attendanceDashboardQuerySchema, req.query)
            const dashboard = await getAttendanceDashboard({
                query,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: dashboard,
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
