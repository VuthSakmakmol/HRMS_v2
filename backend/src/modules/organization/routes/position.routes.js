import multer from "multer"
import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    positionCreateSchema,
    positionIdParamSchema,
    positionListQuerySchema,
    positionUpdateSchema,
} from "../schemas/position.schema.js"
import {
    archivePosition,
    createPosition,
    getPositionById,
    listPositions,
    lookupPositions,
    updatePosition,
} from "../services/position.service.js"
import {
    buildPositionExportWorkbook,
    buildPositionImportTemplateWorkbook,
    getExportPositions,
    importPositionsFromRows,
    parsePositionImportWorkbook,
} from "../services/positionExcel.service.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
})

const POSITION_PERMISSIONS = Object.freeze({
    LOOKUP: "ORGANIZATION.POSITION.LOOKUP",
    VIEW: "ORGANIZATION.POSITION.VIEW",
    CREATE: "ORGANIZATION.POSITION.CREATE",
    UPDATE: "ORGANIZATION.POSITION.UPDATE",
    ARCHIVE: "ORGANIZATION.POSITION.ARCHIVE",
    IMPORT: "ORGANIZATION.POSITION.IMPORT",
    EXPORT: "ORGANIZATION.POSITION.EXPORT",
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
    requirePermission(POSITION_PERMISSIONS.LOOKUP),
    async (req, res, next) => {
        try {
            const query = parseRequest(positionListQuerySchema, req.query)
            const items = await lookupPositions({
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
    requirePermission(POSITION_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(positionListQuerySchema, req.query)
            const result = await listPositions({
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
    requirePermission(POSITION_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(positionCreateSchema, req.body)
            const position = await createPosition({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    position,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission(POSITION_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const workbook = await buildPositionImportTemplateWorkbook()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="position-import-template.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/export",
    requirePermission(POSITION_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(positionListQuerySchema, req.query)

            const positions = await getExportPositions({
                query,
                user: req.auth.user,
            })

            const workbook = await buildPositionExportWorkbook({
                positions,
            })
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="positions-export.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission(POSITION_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "ORGANIZATION_POSITION_IMPORT_FILE_REQUIRED",
                    messageKey:
                        "errors.organization.positionImport.fileRequired",
                })
            }

            const { rows, errors } =
                await parsePositionImportWorkbook(req.file.buffer)

            const summary = await importPositionsFromRows({
                rows,
                parseErrors: errors,
                user: req.auth.user,
            })

            res.status(summary.errors.length > 0 ? 207 : 200).json({
                success: summary.errors.length === 0,
                data: {
                    summary,
                },
                error:
                    summary.errors.length > 0
                        ? {
                              code: "ORGANIZATION_POSITION_IMPORT_HAS_ERRORS",
                              messageKey:
                                  "errors.organization.positionImport.hasErrors",
                          }
                        : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:positionId",
    requirePermission(POSITION_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { positionId } = parseRequest(
                positionIdParamSchema,
                req.params,
            )
            const position = await getPositionById({
                positionId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    position,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:positionId",
    requirePermission(POSITION_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { positionId } = parseRequest(
                positionIdParamSchema,
                req.params,
            )
            const payload = parseRequest(positionUpdateSchema, req.body)
            const position = await updatePosition({
                positionId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    position,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:positionId/archive",
    requirePermission(POSITION_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { positionId } = parseRequest(
                positionIdParamSchema,
                req.params,
            )
            const position = await archivePosition({
                positionId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    position,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router