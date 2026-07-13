import mongoose from "mongoose"

import { getCache, setCache } from "../../../shared/cache/memoryCache.js"
import AttendanceRecord from "../../attendance/models/AttendanceRecord.js"
import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../../employeeMovement/models/EmployeeMovement.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import Line from "../../line/models/Line.js"
import ManpowerPlan from "../../manpowerPlan/models/ManpowerPlan.js"
import Branch from "../../organization/models/Branch.js"
import Company from "../../organization/models/Company.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"

const MONTH_LABELS = Object.freeze([
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
])

const ENTRY_TYPES = new Set(["NEW_HIRE", "REJOIN"])
const EXIT_TYPES = new Set([
    "RESIGN",
    "TERMINATE",
    "ABANDON",
    "PASSED_AWAY",
    "RETIRE",
])

const FILTER_FIELDS = Object.freeze([
    "companyId",
    "branchId",
    "departmentId",
    "positionId",
    "lineId",
    "employeeTypeId",
])

const ATTENDANCE_FILTER_FIELDS = Object.freeze([
    "companyId",
    "branchId",
    "departmentId",
    "positionId",
    "lineId",
])

const PRESENT_STATUSES = new Set([
    "PRESENT",
    "LATE",
    "EARLY_LEAVE",
    "LATE_AND_EARLY_LEAVE",
    "MISSING_IN",
    "MISSING_OUT",
])

const LATE_STATUSES = new Set([
    "LATE",
    "LATE_AND_EARLY_LEAVE",
])

const EARLY_STATUSES = new Set([
    "EARLY_LEAVE",
    "LATE_AND_EARLY_LEAVE",
])

const MISSING_STATUSES = new Set([
    "MISSING_IN",
    "MISSING_OUT",
])

function toObjectId(value) {
    return value ? new mongoose.Types.ObjectId(value) : undefined
}

function parseStartDate(value) {
    return new Date(`${value}T00:00:00.000Z`)
}

function parseEndDate(value) {
    return new Date(`${value}T23:59:59.999Z`)
}

function monthStart(year, month) {
    return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0))
}

function monthEnd(year, month) {
    return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
}

function buildDimensionMatch(query, prefix = "") {
    const match = {}

    for (const field of FILTER_FIELDS) {
        if (!query[field]) {
            continue
        }

        const key = prefix ? `${prefix}.${field}` : field
        match[key] = toObjectId(query[field])
    }

    return match
}

function buildAttendanceDimensionMatch(query) {
    const match = {}

    for (const field of ATTENDANCE_FILTER_FIELDS) {
        if (!query[field]) {
            continue
        }

        match[field] = toObjectId(query[field])
    }

    return match
}

function createPeriods(startDate, endDate) {
    const periods = []
    const cursor = monthStart(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth() + 1,
    )
    const finalMonth = monthStart(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth() + 1,
    )
    const spansMultipleYears =
        startDate.getUTCFullYear() !== endDate.getUTCFullYear()

    while (cursor <= finalMonth) {
        const year = cursor.getUTCFullYear()
        const month = cursor.getUTCMonth() + 1
        const key = `${year}-${String(month).padStart(2, "0")}`

        periods.push({
            key,
            year,
            month,
            label: spansMultipleYears
                ? `${MONTH_LABELS[month - 1]} ${year}`
                : MONTH_LABELS[month - 1],
            startDate: new Date(Math.max(monthStart(year, month), startDate)),
            endDate: new Date(Math.min(monthEnd(year, month), endDate)),
            budget: 0,
            roadmap: 0,
            actual: 0,
            fillRate: 0,
            in: 0,
            out: 0,
            balance: 0,
        })

        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }

    return periods
}

function normalizeCategoryText(value) {
    return String(value || "")
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toUpperCase()
}

function classifyCategory(source = {}) {
    const categoryText = normalizeCategoryText(
        [
            source.employeeTypeChildCode,
            source.employeeTypeChildName,
        ].filter(Boolean).join(" "),
    )

    if (
        categoryText.includes("WHITE COLLAR") ||
        categoryText.includes("OFFICE") ||
        categoryText.includes("STAFF")
    ) {
        return "WHITE_COLLAR"
    }

    if (
        categoryText.includes("SEWER") ||
        categoryText.includes("SEWING OPERATOR") ||
        categoryText.includes("DIRECT LABOR") ||
        categoryText === "DIRECT"
    ) {
        return "SEWER"
    }

    return "NON_SEWER"
}

function round(value, digits = 2) {
    const factor = 10 ** digits
    return Math.round((Number(value) || 0) * factor) / factor
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value))

    if (!validValues.length) {
        return 0
    }

    return validValues.reduce((sum, value) => sum + value, 0) /
        validValues.length
}

function calculateYears(startDate, endDate) {
    if (!startDate) {
        return null
    }

    const milliseconds = endDate.getTime() - new Date(startDate).getTime()

    if (milliseconds < 0) {
        return null
    }

    return milliseconds / (365.2425 * 24 * 60 * 60 * 1000)
}

function employeeWasActiveOn(employee, date) {
    const joined = employee.joinDate && new Date(employee.joinDate) <= date
    const notLeft = !employee.resignDate || new Date(employee.resignDate) > date

    return Boolean(joined && notLeft)
}

async function loadEmployees(query) {
    return Employee.find({
        ...buildDimensionMatch(query),
        recordStatus: {
            $ne: "ARCHIVED",
        },
    })
        .select([
            "dateOfBirth",
            "joinDate",
            "resignDate",
            "employmentStatus",
            "companyId",
            "branchId",
            "departmentId",
            "positionId",
            "lineId",
            "employeeTypeId",
            "employeeTypeChildCode",
            "employeeTypeChildName",
        ])
        .lean()
}

async function loadPlans(query, periods) {
    const periodConditions = periods.map((period) => ({
        year: period.year,
        month: period.month,
    }))

    return ManpowerPlan.find({
        ...buildDimensionMatch(query),
        status: "ACTIVE",
        $or: periodConditions,
    })
        .select([
            "year",
            "month",
            "targetBudget",
            "targetRoadmap",
            "employeeTypeChildCode",
            "employeeTypeChildName",
        ])
        .lean()
}

async function loadMovements(query, startDate, endDate) {
    const fromMatch = buildDimensionMatch(query, "from")
    const toMatch = buildDimensionMatch(query, "to")
    const hasDimensionFilter = FILTER_FIELDS.some((field) => query[field])

    return EmployeeMovement.find({
        effectiveDate: {
            $gte: startDate,
            $lte: endDate,
        },
        status: "ACTIVE",
        ...(hasDimensionFilter
            ? {
                $or: [fromMatch, toMatch],
            }
            : {}),
    })
        .select([
            "movementType",
            "effectiveDate",
            "from.employeeTypeChildCode",
            "from.employeeTypeChildName",
            "to.employeeTypeChildCode",
            "to.employeeTypeChildName",
        ])
        .lean()
}

async function loadAttendanceRecords(query, startDate, endDate, employees) {
    const match = {
        ...buildAttendanceDimensionMatch(query),
        attendanceDate: {
            $gte: startDate,
            $lte: endDate,
        },
    }

    if (query.employeeTypeId) {
        const employeeIds = employees.map((employee) => employee._id)

        if (!employeeIds.length) {
            return []
        }

        match.employeeId = {
            $in: employeeIds,
        }
    }

    return AttendanceRecord.find(match)
        .select([
            "employeeId",
            "attendanceDate",
            "companyId",
            "branchId",
            "departmentId",
            "positionId",
            "lineId",
            "status",
            "verificationStatus",
            "workedMinutes",
            "lateMinutes",
            "earlyLeaveMinutes",
        ])
        .lean()
}

function clonePeriods(periods) {
    return periods.map((period) => ({
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        budget: 0,
        roadmap: 0,
        actual: 0,
        fillRate: 0,
        in: 0,
        out: 0,
        balance: 0,
    }))
}

function cloneAttendancePeriods(periods) {
    return periods.map((period) => ({
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        processed: 0,
        present: 0,
        absent: 0,
        late: 0,
        earlyLeave: 0,
        missingPunch: 0,
        needsReview: 0,
        holiday: 0,
        restDay: 0,
        attendanceRate: 0,
    }))
}

function buildManpowerSeries({ employees, plans, periods, category }) {
    const rows = clonePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))

    for (const plan of plans) {
        if (classifyCategory(plan) !== category) {
            continue
        }

        const key = `${plan.year}-${String(plan.month).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) {
            continue
        }

        row.budget += Number(plan.targetBudget) || 0
        row.roadmap += Number(plan.targetRoadmap) || 0
    }

    for (const row of rows) {
        const periodEnd = monthEnd(row.year, row.month)

        row.actual = employees.filter((employee) =>
            classifyCategory(employee) === category &&
            employeeWasActiveOn(employee, periodEnd),
        ).length

        row.fillRate = row.roadmap > 0
            ? round((row.actual / row.roadmap) * 100, 1)
            : 0
    }

    return rows
}

function movementCategory(movement, isEntry) {
    return classifyCategory(isEntry ? movement.to : movement.from)
}

function buildMovementSeries({ movements, periods, category }) {
    const rows = clonePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))

    for (const movement of movements) {
        const effectiveDate = new Date(movement.effectiveDate)
        const key = `${effectiveDate.getUTCFullYear()}-${String(
            effectiveDate.getUTCMonth() + 1,
        ).padStart(2, "0")}`
        const row = rowByKey.get(key)
        const isEntry = ENTRY_TYPES.has(movement.movementType)
        const isExit = EXIT_TYPES.has(movement.movementType)

        if (!row || (!isEntry && !isExit)) {
            continue
        }

        if (movementCategory(movement, isEntry) !== category) {
            continue
        }

        if (isEntry) {
            row.in += 1
        }

        if (isExit) {
            row.out += 1
        }
    }

    for (const row of rows) {
        row.balance = row.in - row.out
    }

    return rows
}

function buildAttendanceSeries({ records, periods }) {
    const rows = cloneAttendancePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))

    for (const record of records) {
        const attendanceDate = new Date(record.attendanceDate)
        const key = `${attendanceDate.getUTCFullYear()}-${String(
            attendanceDate.getUTCMonth() + 1,
        ).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) {
            continue
        }

        row.processed += 1

        if (PRESENT_STATUSES.has(record.status)) {
            row.present += 1
        }

        if (record.status === "ABSENT") {
            row.absent += 1
        }

        if (LATE_STATUSES.has(record.status) || Number(record.lateMinutes) > 0) {
            row.late += 1
        }

        if (
            EARLY_STATUSES.has(record.status) ||
            Number(record.earlyLeaveMinutes) > 0
        ) {
            row.earlyLeave += 1
        }

        if (MISSING_STATUSES.has(record.status)) {
            row.missingPunch += 1
        }

        if (record.verificationStatus === "NEEDS_REVIEW") {
            row.needsReview += 1
        }

        if (record.status === "HOLIDAY") {
            row.holiday += 1
        }

        if (record.status === "REST_DAY") {
            row.restDay += 1
        }
    }

    for (const row of rows) {
        const denominator = row.present + row.absent
        row.attendanceRate = denominator > 0
            ? round((row.present / denominator) * 100, 1)
            : 0
    }

    return rows
}

function buildAttendanceSummary(rows) {
    const summary = rows.reduce(
        (result, row) => {
            result.processed += row.processed
            result.present += row.present
            result.absent += row.absent
            result.late += row.late
            result.earlyLeave += row.earlyLeave
            result.missingPunch += row.missingPunch
            result.needsReview += row.needsReview
            result.holiday += row.holiday
            result.restDay += row.restDay
            return result
        },
        {
            processed: 0,
            present: 0,
            absent: 0,
            late: 0,
            earlyLeave: 0,
            missingPunch: 0,
            needsReview: 0,
            holiday: 0,
            restDay: 0,
            attendanceRate: 0,
        },
    )

    const denominator = summary.present + summary.absent
    summary.attendanceRate = denominator > 0
        ? round((summary.present / denominator) * 100, 1)
        : 0

    return summary
}

function buildAttendanceLineSummary({ records, lines }) {
    const lineById = new Map(lines.map((line) => [line._id.toString(), line]))
    const rowByLineId = new Map()

    for (const record of records) {
        const lineId = record.lineId?.toString?.()

        if (!lineId) {
            continue
        }

        if (!rowByLineId.has(lineId)) {
            const line = lineById.get(lineId)

            rowByLineId.set(lineId, {
                lineId,
                code: line?.code || "-",
                name: line?.name || "Unknown Line",
                processed: 0,
                present: 0,
                absent: 0,
                late: 0,
                missingPunch: 0,
                needsReview: 0,
                attendanceRate: 0,
            })
        }

        const row = rowByLineId.get(lineId)
        row.processed += 1

        if (PRESENT_STATUSES.has(record.status)) {
            row.present += 1
        }

        if (record.status === "ABSENT") {
            row.absent += 1
        }

        if (LATE_STATUSES.has(record.status) || Number(record.lateMinutes) > 0) {
            row.late += 1
        }

        if (MISSING_STATUSES.has(record.status)) {
            row.missingPunch += 1
        }

        if (record.verificationStatus === "NEEDS_REVIEW") {
            row.needsReview += 1
        }
    }

    return [...rowByLineId.values()]
        .map((row) => {
            const denominator = row.present + row.absent

            return {
                ...row,
                attendanceRate: denominator > 0
                    ? round((row.present / denominator) * 100, 1)
                    : 0,
            }
        })
        .sort((a, b) => b.absent - a.absent || b.late - a.late)
        .slice(0, 20)
}

function buildGeneralData({ employees, selectedDate }) {
    const activeEmployees = employees.filter((employee) =>
        employeeWasActiveOn(employee, selectedDate),
    )
    const sewerEmployees = activeEmployees.filter(
        (employee) => classifyCategory(employee) === "SEWER",
    )
    const directCount = sewerEmployees.length
    const indirectCount = activeEmployees.length - directCount

    return {
        totalEmployees: activeEmployees.length,
        sewerEmployees: sewerEmployees.length,
        averageAge: round(
            average(
                activeEmployees.map((employee) =>
                    calculateYears(employee.dateOfBirth, selectedDate),
                ),
            ),
            1,
        ),
        sewerAverageAge: round(
            average(
                sewerEmployees.map((employee) =>
                    calculateYears(employee.dateOfBirth, selectedDate),
                ),
            ),
            1,
        ),
        averageServiceYears: round(
            average(
                activeEmployees.map((employee) =>
                    calculateYears(employee.joinDate, selectedDate),
                ),
            ),
            1,
        ),
        sewerAverageServiceYears: round(
            average(
                sewerEmployees.map((employee) =>
                    calculateYears(employee.joinDate, selectedDate),
                ),
            ),
            1,
        ),
        directCount,
        indirectCount,
        directIndirectRatio: indirectCount > 0
            ? round(directCount / indirectCount, 2)
            : directCount,
    }
}

function normalizeLookupItem(document, nameField = "name") {
    return {
        id: document._id.toString(),
        code: document.code || "",
        name: document[nameField] || document.name || document.code || "",
        companyId: document.companyId?.toString?.() || null,
        branchId: document.branchId?.toString?.() || null,
        departmentId: document.departmentId?.toString?.() || null,
    }
}

export async function getHrDashboardLookups({ query }) {
    const cacheKey = `hr-dashboard:lookups:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const companyMatch = query.companyId
        ? { _id: toObjectId(query.companyId) }
        : {}
    const branchMatch = {
        status: "ACTIVE",
        ...(query.companyId
            ? { companyId: toObjectId(query.companyId) }
            : {}),
        ...(query.branchId
            ? { _id: toObjectId(query.branchId) }
            : {}),
    }
    const dimensionMatch = {
        status: "ACTIVE",
        ...(query.companyId
            ? { companyId: toObjectId(query.companyId) }
            : {}),
        ...(query.branchId
            ? { branchId: toObjectId(query.branchId) }
            : {}),
    }
    const departmentMatch = {
        ...dimensionMatch,
        ...(query.departmentId
            ? { _id: toObjectId(query.departmentId) }
            : {}),
    }
    const childDimensionMatch = {
        ...dimensionMatch,
        ...(query.departmentId
            ? { departmentId: toObjectId(query.departmentId) }
            : {}),
    }
    const employeeTypeMatch = {
        status: "ACTIVE",
        ...(query.companyId
            ? { companyId: toObjectId(query.companyId) }
            : {}),
    }

    const [companies, branches, departments, positions, lines, employeeTypes] =
        await Promise.all([
            Company.find({
                status: "ACTIVE",
                ...companyMatch,
            })
                .select(["code", "displayName"])
                .sort({ displayName: 1 })
                .lean(),
            Branch.find(branchMatch)
                .select(["code", "name", "companyId"])
                .sort({ name: 1 })
                .lean(),
            Department.find(departmentMatch)
                .select(["code", "name", "companyId", "branchId"])
                .sort({ name: 1 })
                .lean(),
            Position.find(childDimensionMatch)
                .select(["code", "title", "companyId", "branchId", "departmentId"])
                .sort({ title: 1 })
                .lean(),
            Line.find(childDimensionMatch)
                .select(["code", "name", "companyId", "branchId", "departmentId"])
                .sort({ name: 1 })
                .lean(),
            EmployeeType.find(employeeTypeMatch)
                .select(["code", "name", "companyId"])
                .sort({ name: 1 })
                .lean(),
        ])

    const result = {
        companies: companies.map((item) =>
            normalizeLookupItem(item, "displayName"),
        ),
        branches: branches.map((item) => normalizeLookupItem(item)),
        departments: departments.map((item) => normalizeLookupItem(item)),
        positions: positions.map((item) => normalizeLookupItem(item, "title")),
        lines: lines.map((item) => normalizeLookupItem(item)),
        employeeTypes: employeeTypes.map((item) => normalizeLookupItem(item)),
    }

    return setCache(cacheKey, result, 60_000)
}

export async function getHrDashboard({ query }) {
    const cacheKey = `hr-dashboard:data:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) {
        return cachedResult
    }

    const startDate = parseStartDate(query.startDate)
    const endDate = parseEndDate(query.endDate)
    const periods = createPeriods(startDate, endDate)

    const [employees, plans, movements, lines] = await Promise.all([
        loadEmployees(query),
        loadPlans(query, periods),
        loadMovements(query, startDate, endDate),
        Line.find({
            status: "ACTIVE",
            ...(query.companyId ? { companyId: toObjectId(query.companyId) } : {}),
            ...(query.branchId ? { branchId: toObjectId(query.branchId) } : {}),
            ...(query.departmentId ? { departmentId: toObjectId(query.departmentId) } : {}),
            ...(query.lineId ? { _id: toObjectId(query.lineId) } : {}),
        })
            .select(["code", "name"])
            .lean(),
    ])

    const attendanceRecords = await loadAttendanceRecords(
        query,
        startDate,
        endDate,
        employees,
    )

    const selectedPeriod = periods.at(-1)
    const attendanceMonthly = buildAttendanceSeries({
        records: attendanceRecords,
        periods,
    })

    const result = {
        filters: {
            startDate: query.startDate,
            endDate: query.endDate,
            selectedPeriodKey: selectedPeriod?.key || null,
            companyId: query.companyId || null,
            branchId: query.branchId || null,
            departmentId: query.departmentId || null,
            positionId: query.positionId || null,
            lineId: query.lineId || null,
            employeeTypeId: query.employeeTypeId || null,
        },
        general: buildGeneralData({
            employees,
            selectedDate: endDate,
        }),
        manpower: {
            sewer: buildManpowerSeries({
                employees,
                plans,
                periods,
                category: "SEWER",
            }),
            nonSewer: buildManpowerSeries({
                employees,
                plans,
                periods,
                category: "NON_SEWER",
            }),
        },
        attendance: {
            summary: buildAttendanceSummary(attendanceMonthly),
            monthly: attendanceMonthly,
            byLine: buildAttendanceLineSummary({
                records: attendanceRecords,
                lines,
            }),
        },
        movement: {
            sewer: buildMovementSeries({
                movements,
                periods,
                category: "SEWER",
            }),
            nonSewer: buildMovementSeries({
                movements,
                periods,
                category: "NON_SEWER",
            }),
            whiteCollar: buildMovementSeries({
                movements,
                periods,
                category: "WHITE_COLLAR",
            }),
        },
    }

    return setCache(cacheKey, result, 30_000)
}
