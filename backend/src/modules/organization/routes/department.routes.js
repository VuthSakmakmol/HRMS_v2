import multer from "multer"
import { Router } from "express"

import {
    requireAuthentication,
    requirePermission,
} from "../../access/middleware/auth.middleware.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    departmentCreateSchema,
    departmentIdParamSchema,
    departmentListQuerySchema,
    departmentUpdateSchema,
} from "../schemas/department.schema.js"
import {
    archiveDepartment,
    createDepartment,
    getDepartmentById,
    listDepartments,
    updateDepartment,
} from "../services/department.service.js"
import {
    buildDepartmentExportWorkbook,
    buildDepartmentImportTemplateWorkbook,
    getExportDepartments,
    importDepartmentsFromRows,
    parseDepartmentImportWorkbook,
} from "../services/departmentExcel.service.js"

const router = Router()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
})

const DEPARTMENT_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.DEPARTMENT.VIEW",
    CREATE: "ORGANIZATION.DEPARTMENT.CREATE",
    UPDATE: "ORGANIZATION.DEPARTMENT.UPDATE",
    ARCHIVE: "ORGANIZATION.DEPARTMENT.ARCHIVE",
    IMPORT: "ORGANIZATION.DEPARTMENT.IMPORT",
    EXPORT: "ORGANIZATION.DEPARTMENT.EXPORT",
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
    requirePermission(DEPARTMENT_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const query = parseRequest(departmentListQuerySchema, req.query)
            const result = await listDepartments({
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
    requirePermission(DEPARTMENT_PERMISSIONS.CREATE),
    async (req, res, next) => {
        try {
            const payload = parseRequest(departmentCreateSchema, req.body)
            const department = await createDepartment({
                payload,
                user: req.auth.user,
            })

            res.status(201).json({
                success: true,
                data: {
                    department,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/import-template",
    requirePermission(DEPARTMENT_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const workbook = await buildDepartmentImportTemplateWorkbook()
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="department-import-template.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/export",
    requirePermission(DEPARTMENT_PERMISSIONS.EXPORT),
    async (req, res, next) => {
        try {
            const query = parseRequest(departmentListQuerySchema, req.query)

            const departments = await getExportDepartments({
                query,
                user: req.auth.user,
            })

            const workbook = await buildDepartmentExportWorkbook({
                departments,
            })
            const buffer = await workbook.xlsx.writeBuffer()

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
            res.setHeader(
                "Content-Disposition",
                'attachment; filename="departments-export.xlsx"',
            )

            res.status(200).send(Buffer.from(buffer))
        } catch (error) {
            next(error)
        }
    },
)

router.post(
    "/import",
    requirePermission(DEPARTMENT_PERMISSIONS.IMPORT),
    upload.single("file"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                throw new AppError({
                    statusCode: 422,
                    code: "ORGANIZATION_DEPARTMENT_IMPORT_FILE_REQUIRED",
                    messageKey:
                        "errors.organization.departmentImport.fileRequired",
                })
            }

            const { rows, errors } =
                await parseDepartmentImportWorkbook(req.file.buffer)

            const summary = await importDepartmentsFromRows({
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
                              code: "ORGANIZATION_DEPARTMENT_IMPORT_HAS_ERRORS",
                              messageKey:
                                  "errors.organization.departmentImport.hasErrors",
                          }
                        : undefined,
            })
        } catch (error) {
            next(error)
        }
    },
)

router.get(
    "/:departmentId",
    requirePermission(DEPARTMENT_PERMISSIONS.VIEW),
    async (req, res, next) => {
        try {
            const { departmentId } = parseRequest(
                departmentIdParamSchema,
                req.params,
            )
            const department = await getDepartmentById({
                departmentId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    department,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:departmentId",
    requirePermission(DEPARTMENT_PERMISSIONS.UPDATE),
    async (req, res, next) => {
        try {
            const { departmentId } = parseRequest(
                departmentIdParamSchema,
                req.params,
            )
            const payload = parseRequest(departmentUpdateSchema, req.body)
            const department = await updateDepartment({
                departmentId,
                payload,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    department,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

router.patch(
    "/:departmentId/archive",
    requirePermission(DEPARTMENT_PERMISSIONS.ARCHIVE),
    async (req, res, next) => {
        try {
            const { departmentId } = parseRequest(
                departmentIdParamSchema,
                req.params,
            )
            const department = await archiveDepartment({
                departmentId,
                user: req.auth.user,
            })

            res.status(200).json({
                success: true,
                data: {
                    department,
                },
            })
        } catch (error) {
            next(error)
        }
    },
)

export default router
