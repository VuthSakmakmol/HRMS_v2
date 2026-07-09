import ExcelJS from "exceljs"

import { AppError } from "../../../shared/errors/AppError.js"
import {
    createLocation,
    listLocationsForExport,
    resolveLocationIdsFromCodes,
} from "./location.service.js"

const TEMPLATE_CONFIG = Object.freeze({
    countries: {
        sheetName: "Countries",
        filename: "country-import-template.xlsx",
        headers: [
            "code",
            "name",
            "nationality",
            "phoneCode",
            "status",
            "description",
        ],
        sampleRows: [
            {
                code: "KH",
                name: "Cambodia",
                nationality: "Cambodian",
                phoneCode: "+855",
                status: "ACTIVE",
                description: "",
            },
        ],
    },
    provinces: {
        sheetName: "Provinces",
        filename: "province-import-template.xlsx",
        headers: [
            "countryCode",
            "code",
            "name",
            "shortName",
            "status",
            "description",
        ],
        sampleRows: [
            {
                countryCode: "KH",
                code: "KSP",
                name: "Kampong Speu",
                shortName: "KSP",
                status: "ACTIVE",
                description: "",
            },
        ],
    },
    districts: {
        sheetName: "Districts",
        filename: "district-import-template.xlsx",
        headers: [
            "countryCode",
            "provinceCode",
            "code",
            "name",
            "shortName",
            "status",
            "description",
        ],
        sampleRows: [
            {
                countryCode: "KH",
                provinceCode: "KSP",
                code: "SRT",
                name: "Samraong Tong",
                shortName: "SRT",
                status: "ACTIVE",
                description: "",
            },
        ],
    },
    communes: {
        sheetName: "Communes",
        filename: "commune-import-template.xlsx",
        headers: [
            "countryCode",
            "provinceCode",
            "districtCode",
            "code",
            "name",
            "shortName",
            "status",
            "description",
        ],
        sampleRows: [
            {
                countryCode: "KH",
                provinceCode: "KSP",
                districtCode: "SRT",
                code: "KAH",
                name: "Kahaeng",
                shortName: "KAH",
                status: "ACTIVE",
                description: "",
            },
        ],
    },
    villages: {
        sheetName: "Villages",
        filename: "village-import-template.xlsx",
        headers: [
            "countryCode",
            "provinceCode",
            "districtCode",
            "communeCode",
            "code",
            "name",
            "shortName",
            "status",
            "description",
        ],
        sampleRows: [
            {
                countryCode: "KH",
                provinceCode: "KSP",
                districtCode: "SRT",
                communeCode: "KAH",
                code: "TPC",
                name: "Trapeang Chhuk",
                shortName: "TPC",
                status: "ACTIVE",
                description: "",
            },
        ],
    },
})

function getTemplateConfig(entity) {
    const config = TEMPLATE_CONFIG[entity]

    if (!config) {
        throw new AppError({
            statusCode: 404,
            code: "LOCATION_ENTITY_NOT_FOUND",
            messageKey: "errors.location.entityNotFound",
        })
    }

    return config
}

function normalizeCellValue(value) {
    if (value === null || value === undefined) {
        return ""
    }

    if (typeof value === "object" && value.text) {
        return String(value.text).trim()
    }

    if (typeof value === "object" && value.result) {
        return String(value.result).trim()
    }

    return String(value).trim()
}

function styleHeader(row) {
    row.font = {
        bold: true,
        color: {
            argb: "FFFFFFFF",
        },
    }

    row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
            argb: "FF2563EB",
        },
    }

    row.alignment = {
        vertical: "middle",
        horizontal: "center",
    }
}

function setSheetWidths(worksheet, headers) {
    headers.forEach((header, index) => {
        worksheet.getColumn(index + 1).width = Math.max(16, header.length + 4)
    })
}

export async function buildLocationImportTemplateWorkbook({ entity }) {
    const config = getTemplateConfig(entity)
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(config.sheetName)

    worksheet.addRow(config.headers)
    styleHeader(worksheet.getRow(1))

    for (const sampleRow of config.sampleRows) {
        worksheet.addRow(config.headers.map((header) => sampleRow[header] || ""))
    }

    setSheetWidths(worksheet, config.headers)
    worksheet.views = [
        {
            state: "frozen",
            ySplit: 1,
        },
    ]

    return workbook
}

export async function parseLocationImportWorkbook(buffer, entity) {
    const config = getTemplateConfig(entity)
    const workbook = new ExcelJS.Workbook()

    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]

    if (!worksheet) {
        return {
            rows: [],
            errors: [
                {
                    row: 0,
                    message: "No worksheet found.",
                },
            ],
        }
    }

    const headerRow = worksheet.getRow(1)
    const headerMap = new Map()

    headerRow.eachCell((cell, columnNumber) => {
        const header = normalizeCellValue(cell.value)

        if (header) {
            headerMap.set(header, columnNumber)
        }
    })

    const missingHeaders = config.headers.filter((header) => !headerMap.has(header))

    if (missingHeaders.length > 0) {
        return {
            rows: [],
            errors: [
                {
                    row: 1,
                    message: `Missing headers: ${missingHeaders.join(", ")}`,
                },
            ],
        }
    }

    const rows = []

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
            return
        }

        const rowData = {}
        let hasValue = false

        for (const header of config.headers) {
            const value = normalizeCellValue(row.getCell(headerMap.get(header)).value)
            rowData[header] = value

            if (value) {
                hasValue = true
            }
        }

        if (hasValue) {
            rows.push({
                rowNumber,
                data: rowData,
            })
        }
    })

    return {
        rows,
        errors: [],
    }
}

function getExportRow(entity, item) {
    if (entity === "countries") {
        return {
            code: item.code,
            name: item.name,
            nationality: item.nationality,
            phoneCode: item.phoneCode,
            status: item.status,
            description: item.description,
        }
    }

    return {
        countryCode: item.country?.code || "",
        provinceCode: item.province?.code || "",
        districtCode: item.district?.code || "",
        communeCode: item.commune?.code || "",
        code: item.code,
        name: item.name,
        shortName: item.shortName,
        status: item.status,
        description: item.description,
    }
}

export async function buildLocationExportWorkbook({ entity, items }) {
    const config = getTemplateConfig(entity)
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(config.sheetName)

    worksheet.addRow(config.headers)
    styleHeader(worksheet.getRow(1))

    for (const item of items) {
        const row = getExportRow(entity, item)
        worksheet.addRow(config.headers.map((header) => row[header] || ""))
    }

    setSheetWidths(worksheet, config.headers)
    worksheet.views = [
        {
            state: "frozen",
            ySplit: 1,
        },
    ]

    return workbook
}

export async function getExportLocations({ entity, query }) {
    return listLocationsForExport({
        entity,
        query,
    })
}

function cleanImportPayload(data) {
    const payload = {
        ...data,
    }

    for (const key of Object.keys(payload)) {
        if (payload[key] === "") {
            delete payload[key]
        }
    }

    return payload
}

export async function importLocationsFromRows({
    entity,
    rows,
    parseErrors,
    user,
}) {
    const summary = {
        total: rows.length,
        created: 0,
        failed: 0,
        errors: [...parseErrors],
    }

    if (parseErrors.length > 0) {
        summary.failed = parseErrors.length
        return summary
    }

    for (const row of rows) {
        try {
            const cleanPayload = cleanImportPayload(row.data)
            const payload = await resolveLocationIdsFromCodes({
                entity,
                row: cleanPayload,
            })

            await createLocation({
                entity,
                payload,
                user,
            })

            summary.created += 1
        } catch (error) {
            summary.failed += 1
            summary.errors.push({
                row: row.rowNumber,
                message: error.messageKey || error.message || "Import failed.",
                fields: error.fields,
            })
        }
    }

    return summary
}

export function getLocationImportFilename(entity) {
    return getTemplateConfig(entity).filename
}

export function getLocationExportFilename(entity) {
    return `${entity}-export.xlsx`
}
