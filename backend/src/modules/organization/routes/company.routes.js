import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    companyCreateSchema,
    companyIdParamSchema,
    companyListQuerySchema,
    companyUpdateSchema,
} from "../schemas/company.schema.js"
import {
    archiveCompany,
    createCompany,
    getCompanyById,
    listCompanies,
    lookupCompanies,
    updateCompany,
} from "../services/company.service.js"

const router = Router()

const COMPANY_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.COMPANY.LOOKUP",
    VIEW: "ORGANIZATION.COMPANY.VIEW",
    CREATE: "ORGANIZATION.COMPANY.CREATE",
    UPDATE: "ORGANIZATION.COMPANY.UPDATE",
    ARCHIVE: "ORGANIZATION.COMPANY.ARCHIVE",
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
    "/lookup",
    requirePermission(COMPANY_PERMISSIONS.LOOKUP),
    async (req, res, next) => {
        try {
            const query = parseRequest(companyListQuerySchema, req.query)
            const items = await lookupCompanies({
                query,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    items,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/",
    requirePermission(COMPANY_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(companyListQuerySchema, req.query)
            const result = await listCompanies({
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
    requirePermission(COMPANY_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(companyCreateSchema, req.body)
            const company = await createCompany({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    company,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:companyId",
    requirePermission(COMPANY_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { companyId } = parseRequest(
                companyIdParamSchema,
                req.params,
            )
            const company = await getCompanyById({
                companyId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    company,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:companyId",
    requirePermission(COMPANY_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { companyId } = parseRequest(
                companyIdParamSchema,
                req.params,
            )
            const payload = parseRequest(companyUpdateSchema, req.body)
            const company = await updateCompany({
                companyId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    company,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:companyId/archive",
    requirePermission(COMPANY_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { companyId } = parseRequest(
                companyIdParamSchema,
                req.params,
            )
            const company = await archiveCompany({
                companyId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    company,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router