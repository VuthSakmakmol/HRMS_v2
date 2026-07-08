import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    branchCreateSchema,
    branchIdParamSchema,
    branchListQuerySchema,
    branchUpdateSchema,
} from "../schemas/branch.schema.js"
import {
    archiveBranch,
    createBranch,
    getBranchById,
    listBranches,
    updateBranch,
} from "../services/branch.service.js"

const router = Router()

const BRANCH_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.BRANCH.VIEW",
    CREATE: "ORGANIZATION.BRANCH.CREATE",
    UPDATE: "ORGANIZATION.BRANCH.UPDATE",
    ARCHIVE: "ORGANIZATION.BRANCH.ARCHIVE",
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

router.get(
    "/",
    requirePermission(BRANCH_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(branchListQuerySchema, req.query)
            const result = await listBranches({
                query,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: result,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/",
    requirePermission(BRANCH_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(branchCreateSchema, req.body)
            const branch = await createBranch({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    branch,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:branchId",
    requirePermission(BRANCH_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { branchId } = parseRequest(
                branchIdParamSchema,
                req.params,
            )
            const branch = await getBranchById({
                branchId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    branch,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:branchId",
    requirePermission(BRANCH_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { branchId } = parseRequest(
                branchIdParamSchema,
                req.params,
            )
            const payload = parseRequest(branchUpdateSchema, req.body)
            const branch = await updateBranch({
                branchId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    branch,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:branchId/archive",
    requirePermission(BRANCH_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { branchId } = parseRequest(
                branchIdParamSchema,
                req.params,
            )
            const branch = await archiveBranch({
                branchId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    branch,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router