import mongoose from "mongoose"

import { getCache, setCache } from "../../../shared/cache/memoryCache.js"
import AttendanceRecord from "../../attendance/models/AttendanceRecord.js"
import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../../employeeMovement/models/EmployeeMovement.js"
import RecruitmentChannel from "../../recruitmentChannel/models/RecruitmentChannel.js"
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

const LATE_STATUSES = new Set(["LATE", "LATE_AND_EARLY_LEAVE"])
const EARLY_STATUSES = new Set(["EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"])
const MISSING_STATUSES = new Set(["MISSING_IN", "MISSING_OUT"])

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

function parseEmployeeTypeFilter(query = {}) {
    const result = {
        employeeTypeId: query.employeeTypeId || null,
        employeeTypeChildCode: query.employeeTypeChildCode || null,
        employeeTypeFilterKey: query.employeeTypeFilterKey || null,
    }

    if (!query.employeeTypeFilterKey) {
        return result
    }

    const parts = String(query.employeeTypeFilterKey).split(":")

    if (parts[0] === "TYPE") {
        result.employeeTypeId = parts[1]
        result.employeeTypeChildCode = null
    }

    if (parts[0] === "CHILD") {
        result.employeeTypeId = parts[1]
        result.employeeTypeChildCode = parts[2]
    }

    return result
}

function normalizedQuery(query = {}) {
    const employeeTypeFilter = parseEmployeeTypeFilter(query)

    return {
        ...query,
        employeeTypeId: employeeTypeFilter.employeeTypeId || undefined,
        employeeTypeChildCode:
            employeeTypeFilter.employeeTypeChildCode || undefined,
        employeeTypeFilterKey:
            employeeTypeFilter.employeeTypeFilterKey || undefined,
    }
}

function buildDimensionMatch(query, prefix = "") {
    const match = {}
    const filter = normalizedQuery(query)

    for (const field of FILTER_FIELDS) {
        if (!filter[field]) continue

        const key = prefix ? `${prefix}.${field}` : field
        match[key] = toObjectId(filter[field])
    }

    if (filter.employeeTypeChildCode) {
        const key = prefix ? `${prefix}.employeeTypeChildCode` : "employeeTypeChildCode"
        match[key] = filter.employeeTypeChildCode
    }

    return match
}

function buildAttendanceDimensionMatch(query) {
    const match = {}

    for (const field of ATTENDANCE_FILTER_FIELDS) {
        if (!query[field]) continue
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
            targetGap: 0,
            roadmapGap: 0,
            fillRate: 0,
            in: 0,
            out: 0,
            balance: 0,
        })

        cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }

    return periods
}

function round(value, digits = 2) {
    const factor = 10 ** digits
    return Math.round((Number(value) || 0) * factor) / factor
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value))

    if (!validValues.length) return 0

    return validValues.reduce((sum, value) => sum + value, 0) / validValues.length
}

function calculateYears(startDate, endDate) {
    if (!startDate) return null

    const milliseconds = endDate.getTime() - new Date(startDate).getTime()

    if (milliseconds < 0) return null

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
        recordStatus: { $ne: "ARCHIVED" },
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
            "employeeTypeChildId",
            "employeeTypeChildCode",
            "employeeTypeChildName",
            "sourceOfHiring",
            "recruitmentChannelId",
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
            "employeeTypeId",
            "employeeTypeChildId",
            "employeeTypeChildCode",
            "employeeTypeChildName",
        ])
        .lean()
}

async function loadMovements(query, startDate, endDate) {
    const fromMatch = buildDimensionMatch(query, "from")
    const toMatch = buildDimensionMatch(query, "to")
    const hasDimensionFilter =
        FILTER_FIELDS.some((field) => normalizedQuery(query)[field]) ||
        Boolean(normalizedQuery(query).employeeTypeChildCode)

    return EmployeeMovement.find({
        effectiveDate: { $gte: startDate, $lte: endDate },
        status: "ACTIVE",
        ...(hasDimensionFilter ? { $or: [fromMatch, toMatch] } : {}),
    })
        .select([
            "movementType",
            "effectiveDate",
            "from.employeeTypeId",
            "from.employeeTypeChildId",
            "from.employeeTypeChildCode",
            "from.employeeTypeChildName",
            "to.employeeTypeId",
            "to.employeeTypeChildId",
            "to.employeeTypeChildCode",
            "to.employeeTypeChildName",
        ])
        .lean()
}

async function loadAttendanceRecords(query, startDate, endDate, employees) {
    const match = {
        ...buildAttendanceDimensionMatch(query),
        attendanceDate: { $gte: startDate, $lte: endDate },
    }

    const employeeTypeFilter = normalizedQuery(query)

    if (employeeTypeFilter.employeeTypeId || employeeTypeFilter.employeeTypeChildCode) {
        const employeeIds = employees.map((employee) => employee._id)

        if (!employeeIds.length) return []

        match.employeeId = { $in: employeeIds }
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
        targetGap: 0,
        roadmapGap: 0,
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

function buildManpowerSeries({ employees, plans, periods }) {
    const rows = clonePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))

    for (const plan of plans) {
        const key = `${plan.year}-${String(plan.month).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) continue

        row.budget += Number(plan.targetBudget) || 0
        row.roadmap += Number(plan.targetRoadmap) || 0
    }

    for (const row of rows) {
        const periodEnd = monthEnd(row.year, row.month)

        row.actual = employees.filter((employee) =>
            employeeWasActiveOn(employee, periodEnd),
        ).length

        row.targetGap = row.actual - row.budget
        row.roadmapGap = row.actual - row.roadmap
        row.fillRate = row.roadmap > 0
            ? round((row.actual / row.roadmap) * 100, 1)
            : 0
    }

    return rows
}

function movementMatchesEmployeeTypeFilter(snapshot = {}, filter = {}) {
    if (filter.employeeTypeId) {
        const id = snapshot.employeeTypeId?.toString?.() || snapshot.employeeTypeId
        if (id !== filter.employeeTypeId) return false
    }

    if (filter.employeeTypeChildCode) {
        if (snapshot.employeeTypeChildCode !== filter.employeeTypeChildCode) {
            return false
        }
    }

    return true
}

function buildMovementSeries({ movements, periods, query }) {
    const rows = clonePeriods(periods)
    const rowByKey = new Map(rows.map((row) => [row.key, row]))
    const filter = normalizedQuery(query)

    for (const movement of movements) {
        const date = new Date(movement.effectiveDate)
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) continue

        if (ENTRY_TYPES.has(movement.movementType)) {
            if (movementMatchesEmployeeTypeFilter(movement.to, filter)) {
                row.in += 1
            }
        }

        if (EXIT_TYPES.has(movement.movementType)) {
            if (movementMatchesEmployeeTypeFilter(movement.from, filter)) {
                row.out += 1
            }
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
        const date = new Date(record.attendanceDate)
        const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
        const row = rowByKey.get(key)

        if (!row) continue

        row.processed += 1

        if (PRESENT_STATUSES.has(record.status)) row.present += 1
        if (record.status === "ABSENT") row.absent += 1
        if (LATE_STATUSES.has(record.status) || Number(record.lateMinutes) > 0) row.late += 1
        if (EARLY_STATUSES.has(record.status) || Number(record.earlyLeaveMinutes) > 0) row.earlyLeave += 1
        if (MISSING_STATUSES.has(record.status)) row.missingPunch += 1
        if (record.verificationStatus === "NEEDS_REVIEW") row.needsReview += 1
        if (record.status === "HOLIDAY") row.holiday += 1
        if (record.status === "REST_DAY") row.restDay += 1
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
    const summary = {
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
    }

    for (const row of rows) {
        for (const key of Object.keys(summary)) {
            if (key !== "attendanceRate") summary[key] += Number(row[key]) || 0
        }
    }

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
        if (!lineId) continue

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
        if (PRESENT_STATUSES.has(record.status)) row.present += 1
        if (record.status === "ABSENT") row.absent += 1
        if (LATE_STATUSES.has(record.status) || Number(record.lateMinutes) > 0) row.late += 1
        if (MISSING_STATUSES.has(record.status)) row.missingPunch += 1
        if (record.verificationStatus === "NEEDS_REVIEW") row.needsReview += 1
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


function normalizeRecruitmentText(value) {
    return String(value || "")
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .toUpperCase()
}

function getRecruitmentSourceKeys(channel = {}) {
    const keys = []

    if (channel._id) {
        keys.push(`ID:${channel._id.toString()}`)
    }

    for (const value of [channel.code, channel.name, channel.shortName]) {
        const normalized = normalizeRecruitmentText(value)
        if (normalized) keys.push(`TEXT:${normalized}`)
    }

    return [...new Set(keys)]
}

function getEmployeeRecruitmentSourceKeys(employee = {}) {
    const keys = []

    if (employee.recruitmentChannelId) {
        keys.push(`ID:${employee.recruitmentChannelId.toString()}`)
    }

    const normalizedSource = normalizeRecruitmentText(employee.sourceOfHiring)

    if (normalizedSource) {
        keys.push(`TEXT:${normalizedSource}`)
    }

    return keys
}

function getChannelTargetMonthly(channel = {}) {
    return Number(
        channel.targetMonthly ??
        channel.targetPerMonth ??
        channel.monthlyTarget ??
        0,
    ) || 0
}

async function loadRecruitmentChannels(query = {}) {
    const match = {
        status: "ACTIVE",
    }
    const andConditions = []

    if (query.companyId) {
        andConditions.push({
            $or: [
                { companyId: toObjectId(query.companyId) },
                { companyId: null },
                { companyId: { $exists: false } },
            ],
        })
    }

    if (query.branchId) {
        andConditions.push({
            $or: [
                { branchId: toObjectId(query.branchId) },
                { branchId: null },
                { branchId: { $exists: false } },
            ],
        })
    }

    if (andConditions.length) {
        match.$and = andConditions
    }

    return RecruitmentChannel.find(match)
        .select([
            "companyId",
            "branchId",
            "code",
            "name",
            "shortName",
            "targetMonthly",
            "targetPerMonth",
            "monthlyTarget",
            "sortOrder",
            "status",
        ])
        .sort({ sortOrder: 1, name: 1 })
        .lean()
}

function createRecruitmentMonthRows(periods = []) {
    return periods.map((period) => ({
        key: period.key,
        year: period.year,
        month: period.month,
        label: period.label,
        count: 0,
    }))
}

function createRecruitmentRowFromChannel(channel, periods) {
    return {
        id: channel._id?.toString?.() || null,
        key: channel._id?.toString?.() || normalizeRecruitmentText(channel.code || channel.name),
        code: channel.code || "",
        name: channel.name || channel.code || "-",
        shortName: channel.shortName || channel.name || channel.code || "-",
        targetPerMonth: getChannelTargetMonthly(channel),
        previousTotal: 0,
        previousAveragePerMonth: 0,
        currentTotal: 0,
        averagePerMonth: 0,
        months: createRecruitmentMonthRows(periods),
    }
}

function createRecruitmentRowFromText(sourceText, periods) {
    const label = sourceText
        ? String(sourceText).trim().replace(/\s+/g, " ")
        : "Unassigned"

    return {
        id: null,
        key: `TEXT:${normalizeRecruitmentText(label) || "UNASSIGNED"}`,
        code: normalizeRecruitmentText(label) || "UNASSIGNED",
        name: label,
        shortName: label,
        targetPerMonth: 0,
        previousTotal: 0,
        previousAveragePerMonth: 0,
        currentTotal: 0,
        averagePerMonth: 0,
        months: createRecruitmentMonthRows(periods),
    }
}

function findRecruitmentRowForEmployee(employee, rowBySourceKey, rows, periods) {
    for (const key of getEmployeeRecruitmentSourceKeys(employee)) {
        const row = rowBySourceKey.get(key)
        if (row) return row
    }

    const sourceKey = normalizeRecruitmentText(employee.sourceOfHiring)
    const fallbackKey = sourceKey ? `TEXT:${sourceKey}` : "TEXT:UNASSIGNED"

    if (!rowBySourceKey.has(fallbackKey)) {
        const row = createRecruitmentRowFromText(employee.sourceOfHiring || "Unassigned", periods)
        rows.push(row)
        rowBySourceKey.set(fallbackKey, row)
    }

    return rowBySourceKey.get(fallbackKey)
}

function buildRecruitmentPie(items = [], valueKey) {
    const total = items.reduce(
        (sum, item) => sum + (Number(item[valueKey]) || 0),
        0,
    )

    if (!total) return []

    return items
        .filter((item) => Number(item[valueKey]) > 0)
        .map((item) => ({
            name: item.shortName || item.name,
            value: Number(item[valueKey]) || 0,
            percent: round(((Number(item[valueKey]) || 0) / total) * 100, 1),
        }))
        .sort((a, b) => b.value - a.value)
}

function buildRecruitmentTotalRow(rows = [], periods = []) {
    const totalRow = {
        id: null,
        key: "TOTAL",
        code: "TOTAL",
        name: "Total",
        shortName: "Total",
        targetPerMonth: 0,
        previousTotal: 0,
        previousAveragePerMonth: 0,
        currentTotal: 0,
        averagePerMonth: 0,
        months: createRecruitmentMonthRows(periods),
    }

    for (const row of rows) {
        totalRow.targetPerMonth += Number(row.targetPerMonth) || 0
        totalRow.previousTotal += Number(row.previousTotal) || 0
        totalRow.currentTotal += Number(row.currentTotal) || 0

        row.months.forEach((month, index) => {
            totalRow.months[index].count += Number(month.count) || 0
        })
    }

    totalRow.previousAveragePerMonth = round(totalRow.previousTotal / 12, 0)
    totalRow.averagePerMonth = periods.length
        ? round(totalRow.currentTotal / periods.length, 0)
        : 0

    return totalRow
}

function buildRecruitmentChannelDashboard({
    employees,
    recruitmentChannels,
    periods,
    startDate,
    endDate,
}) {
    const firstPeriod = periods[0]
    const currentYear = firstPeriod?.year || startDate.getUTCFullYear()
    const previousYear = currentYear - 1
    const rows = []
    const rowBySourceKey = new Map()
    const monthIndexByKey = new Map(periods.map((period, index) => [period.key, index]))

    for (const channel of recruitmentChannels) {
        const row = createRecruitmentRowFromChannel(channel, periods)
        rows.push(row)

        for (const key of getRecruitmentSourceKeys(channel)) {
            rowBySourceKey.set(key, row)
        }
    }

    for (const employee of employees) {
        if (!employee.joinDate) continue

        const joinDate = new Date(employee.joinDate)
        const joinYear = joinDate.getUTCFullYear()
        const row = findRecruitmentRowForEmployee(employee, rowBySourceKey, rows, periods)

        if (joinYear === previousYear) {
            row.previousTotal += 1
        }

        if (joinDate >= startDate && joinDate <= endDate) {
            const key = `${joinYear}-${String(joinDate.getUTCMonth() + 1).padStart(2, "0")}`
            const monthIndex = monthIndexByKey.get(key)

            if (monthIndex !== undefined) {
                row.months[monthIndex].count += 1
                row.currentTotal += 1
            }
        }
    }

    for (const row of rows) {
        row.previousAveragePerMonth = round(row.previousTotal / 12, 0)
        row.averagePerMonth = periods.length
            ? round(row.currentTotal / periods.length, 0)
            : 0
    }

    const sortedRows = rows.sort(
        (a, b) =>
            (Number(b.currentTotal) || 0) - (Number(a.currentTotal) || 0) ||
            String(a.name || "").localeCompare(String(b.name || "")),
    )

    return {
        previousYear,
        currentYear,
        periods: periods.map((period) => ({
            key: period.key,
            year: period.year,
            month: period.month,
            label: period.label,
        })),
        rows: sortedRows,
        total: buildRecruitmentTotalRow(sortedRows, periods),
        charts: {
            previousYear: buildRecruitmentPie(sortedRows, "previousTotal"),
            currentYear: buildRecruitmentPie(sortedRows, "currentTotal"),
        },
    }
}

function summarizeEmployeesForGeneralData({ employees, selectedDate }) {
    const activeEmployees = employees.filter((employee) =>
        employeeWasActiveOn(employee, selectedDate),
    )
    const workingEmployees = activeEmployees.filter(
        (employee) => employee.employmentStatus === "WORKING",
    )
    const inactiveEmployees = activeEmployees.filter(
        (employee) => employee.employmentStatus !== "WORKING",
    )

    return {
        totalEmployees: activeEmployees.length,
        workingEmployees: workingEmployees.length,
        inactiveEmployees: inactiveEmployees.length,
        averageAge: round(
            average(
                activeEmployees.map((employee) =>
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
    }
}

function findPeriodRow(rows = [], periodKey) {
    return rows.find((row) => row.key === periodKey) || null
}

function getBudgetValue(row) {
    if (!row) return 0

    const budget = Number(row.budget) || 0
    const roadmap = Number(row.roadmap) || 0

    return budget > 0 ? budget : roadmap
}

function buildIndirectDirectRatio({
    totalSummary,
    selectedSummary,
    totalManpower,
    selectedManpower,
    selectedPeriodKey,
}) {
    const directActual = Number(selectedSummary.totalEmployees) || 0
    const totalActual = Number(totalSummary.totalEmployees) || 0
    const indirectActual = Math.max(totalActual - directActual, 0)
    const actualRatio = directActual > 0
        ? round(indirectActual / directActual, 2)
        : 0

    const totalPeriod = findPeriodRow(totalManpower, selectedPeriodKey)
    const selectedPeriod = findPeriodRow(selectedManpower, selectedPeriodKey)
    const directBudget = getBudgetValue(selectedPeriod)
    const totalBudget = getBudgetValue(totalPeriod)
    const indirectBudget = Math.max(totalBudget - directBudget, 0)
    const budgetRatio = directBudget > 0
        ? round(indirectBudget / directBudget, 2)
        : 0

    return {
        actualRatio,
        budgetRatio,
        directActual,
        indirectActual,
        directBudget,
        indirectBudget,
    }
}

function buildGeneralData({
    totalEmployees,
    selectedEmployees,
    selectedDate,
    selectedLabel,
    selectedPeriod,
    totalManpower,
    selectedManpower,
}) {
    const totalSummary = summarizeEmployeesForGeneralData({
        employees: totalEmployees,
        selectedDate,
    })
    const selectedSummary = summarizeEmployeesForGeneralData({
        employees: selectedEmployees,
        selectedDate,
    })
    const selectedPeriodKey = selectedPeriod?.key || null

    return {
        // Keep old fields for backward compatibility while the UI is being changed.
        totalEmployees: selectedSummary.totalEmployees,
        workingEmployees: selectedSummary.workingEmployees,
        inactiveEmployees: selectedSummary.inactiveEmployees,
        averageAge: selectedSummary.averageAge,
        averageServiceYears: selectedSummary.averageServiceYears,

        selectedLabel,
        budgetLabel: selectedPeriod?.year
            ? `Budget ${selectedPeriod.year}`
            : "Budget",
        total: totalSummary,
        selected: selectedSummary,
        indirectDirect: buildIndirectDirectRatio({
            totalSummary,
            selectedSummary,
            totalManpower,
            selectedManpower,
            selectedPeriodKey,
        }),
    }
}

function toStringId(value) {
    return value?.toString?.() || value || null
}

function normalizeIdList(values = []) {
    return [...new Set(
        values
            .map((value) => toStringId(value))
            .filter(Boolean),
    )]
}

function normalizeLookupItem(document, nameField = "name") {
    return {
        id: document._id.toString(),
        code: document.code || "",
        name: document[nameField] || document.name || document.code || "",
        companyId: document.companyId?.toString?.() || null,
        branchId: document.branchId?.toString?.() || null,
        departmentId: document.departmentId?.toString?.() || null,
        positionIds: normalizeIdList(
            document.positionIds ||
            document.allowedPositionIds ||
            [],
        ),
    }
}

function aggregateChildPositionIds(children = []) {
    const positionIds = []

    for (const child of children) {
        positionIds.push(...(child.positionIds || []))
    }

    return normalizeIdList(positionIds)
}

function employeeTypeUsesAllChildPositions(children = []) {
    return children.some(
        (child) => child.positionAssignmentMode === "ALL_POSITIONS",
    )
}

function buildEmployeeTypeLookupOptions(employeeTypes = []) {
    const options = []

    for (const employeeType of employeeTypes) {
        const parentId = employeeType._id.toString()
        const parentName = employeeType.name || employeeType.code
        const children = employeeType.children || []
        const hasChildren = children.length > 0
        const parentPositionMode = hasChildren && employeeTypeUsesAllChildPositions(children)
            ? "ALL_POSITIONS"
            : employeeType.positionAssignmentMode || "SPECIFIC_POSITIONS"
        const parentPositionIds = hasChildren
            ? aggregateChildPositionIds(children)
            : normalizeIdList(employeeType.positionIds || [])

        options.push({
            id: parentId,
            key: `TYPE:${parentId}`,
            type: "TYPE",
            code: employeeType.code,
            name: parentName,
            label: employeeType.code
                ? `${employeeType.code} - ${parentName}`
                : parentName,
            companyId: employeeType.companyId?.toString?.() || null,
            employeeTypeId: parentId,
            employeeTypeChildCode: null,
            dashboardCategory: employeeType.dashboardCategory || "CUSTOM",
            positionAssignmentMode: parentPositionMode,
            positionIds: parentPositionIds,
            hasChildren,
        })

        for (const child of children) {
            const childPositionMode = child.positionAssignmentMode || "SPECIFIC_POSITIONS"
            const childPositionIds = normalizeIdList(child.positionIds || [])
            const childHasAssignment = childPositionMode === "ALL_POSITIONS" ||
                childPositionIds.length > 0

            if (!childHasAssignment) continue

            options.push({
                id: `${parentId}:${child.code}`,
                key: `CHILD:${parentId}:${child.code}`,
                type: "CHILD",
                code: child.code,
                name: child.name,
                label: `${parentName} / ${child.name}`,
                companyId: employeeType.companyId?.toString?.() || null,
                employeeTypeId: parentId,
                employeeTypeChildCode: child.code,
                dashboardCategory: child.dashboardCategory || "CUSTOM",
                positionAssignmentMode: childPositionMode,
                positionIds: childPositionIds,
                hasChildren: false,
            })
        }
    }

    return options.sort((a, b) =>
        String(a.label || "").localeCompare(String(b.label || "")),
    )
}

function getSelectedEmployeeTypeLabel({ query, lookups }) {
    const filter = normalizedQuery(query)

    if (!filter.employeeTypeFilterKey) return "All Employee Types"

    const selected = lookups.employeeTypes.find(
        (item) => item.key === filter.employeeTypeFilterKey,
    )

    return selected?.label || "Selected Employee Type"
}

function findLookupName(items = [], id) {
    if (!id) return ""

    const item = items.find((entry) => entry.id === id)

    return item?.name || item?.label || item?.code || ""
}

function getSelectedMetricLabel({ query, lookups }) {
    const filter = normalizedQuery(query)

    if (filter.employeeTypeFilterKey) {
        const selected = lookups.employeeTypes.find(
            (item) => item.key === filter.employeeTypeFilterKey,
        )

        return selected?.name || selected?.label || "Selected"
    }

    if (filter.positionId) {
        return findLookupName(lookups.positions, filter.positionId) || "Selected"
    }

    if (filter.lineId) {
        return findLookupName(lookups.lines, filter.lineId) || "Selected"
    }

    if (filter.departmentId) {
        return findLookupName(lookups.departments, filter.departmentId) || "Selected"
    }

    return "Selected"
}

function buildGeneralTotalQuery(query = {}) {
    return {
        companyId: query.companyId || undefined,
        branchId: query.branchId || undefined,
    }
}

export async function getHrDashboardLookups({ query }) {
    const cacheKey = `hr-dashboard:lookups:${JSON.stringify(query)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) return cachedResult

    const companyMatch = query.companyId
        ? { _id: toObjectId(query.companyId) }
        : {}
    const branchMatch = {
        status: "ACTIVE",
        ...(query.companyId ? { companyId: toObjectId(query.companyId) } : {}),
        ...(query.branchId ? { _id: toObjectId(query.branchId) } : {}),
    }
    const dimensionMatch = {
        status: "ACTIVE",
        ...(query.companyId ? { companyId: toObjectId(query.companyId) } : {}),
        ...(query.branchId ? { branchId: toObjectId(query.branchId) } : {}),
    }
    const departmentMatch = {
        ...dimensionMatch,
        ...(query.departmentId ? { _id: toObjectId(query.departmentId) } : {}),
    }
    const childDimensionMatch = {
        ...dimensionMatch,
        ...(query.departmentId ? { departmentId: toObjectId(query.departmentId) } : {}),
    }
    const employeeTypeMatch = {
        status: "ACTIVE",
        ...(query.companyId ? { companyId: toObjectId(query.companyId) } : {}),
    }

    const [companies, branches, departments, positions, lines, employeeTypes] =
        await Promise.all([
            Company.find({ status: "ACTIVE", ...companyMatch })
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
                .select([
                    "code",
                    "name",
                    "companyId",
                    "branchId",
                    "departmentId",
                    "positionIds",
                    "allowedPositionIds",
                ])
                .sort({ name: 1 })
                .lean(),
            EmployeeType.find(employeeTypeMatch)
                .select([
                    "code",
                    "name",
                    "companyId",
                    "dashboardCategory",
                    "positionAssignmentMode",
                    "positionIds",
                    "children.code",
                    "children.name",
                    "children.dashboardCategory",
                    "children.positionAssignmentMode",
                    "children.positionIds",
                ])
                .sort({ name: 1 })
                .lean(),
        ])

    const result = {
        companies: companies.map((item) => normalizeLookupItem(item, "displayName")),
        branches: branches.map((item) => normalizeLookupItem(item)),
        departments: departments.map((item) => normalizeLookupItem(item)),
        positions: positions.map((item) => normalizeLookupItem(item, "title")),
        lines: lines.map((item) => normalizeLookupItem(item)),
        employeeTypes: buildEmployeeTypeLookupOptions(employeeTypes),
    }

    return setCache(cacheKey, result, 60_000)
}

export async function getHrDashboard({ query }) {
    const cleanQuery = normalizedQuery(query)
    const cacheKey = `hr-dashboard:data:${JSON.stringify(cleanQuery)}`
    const cachedResult = getCache(cacheKey)

    if (cachedResult) return cachedResult

    const startDate = parseStartDate(cleanQuery.startDate)
    const endDate = parseEndDate(cleanQuery.endDate)
    const periods = createPeriods(startDate, endDate)

    const lookups = await getHrDashboardLookups({
        query: {
            companyId: cleanQuery.companyId,
            branchId: cleanQuery.branchId,
            departmentId: cleanQuery.departmentId,
        },
    })

    const totalGeneralQuery = buildGeneralTotalQuery(cleanQuery)

    const [
        employees,
        totalGeneralEmployees,
        plans,
        totalGeneralPlans,
        movements,
        recruitmentChannels,
        lines,
    ] = await Promise.all([
            loadEmployees(cleanQuery),
            loadEmployees(totalGeneralQuery),
            loadPlans(cleanQuery, periods),
            loadPlans(totalGeneralQuery, periods),
            loadMovements(cleanQuery, startDate, endDate),
            loadRecruitmentChannels(cleanQuery),
            Line.find({
                status: "ACTIVE",
                ...(cleanQuery.companyId ? { companyId: toObjectId(cleanQuery.companyId) } : {}),
                ...(cleanQuery.branchId ? { branchId: toObjectId(cleanQuery.branchId) } : {}),
                ...(cleanQuery.departmentId ? { departmentId: toObjectId(cleanQuery.departmentId) } : {}),
                ...(cleanQuery.lineId ? { _id: toObjectId(cleanQuery.lineId) } : {}),
            })
                .select(["code", "name"])
                .lean(),
        ])

    const attendanceRecords = await loadAttendanceRecords(
        cleanQuery,
        startDate,
        endDate,
        employees,
    )

    const selectedPeriod = periods.at(-1)
    const attendanceMonthly = buildAttendanceSeries({ records: attendanceRecords, periods })
    const manpower = buildManpowerSeries({ employees, plans, periods })
    const totalManpower = buildManpowerSeries({
        employees: totalGeneralEmployees,
        plans: totalGeneralPlans,
        periods,
    })
    const selectedEmployeeTypeLabel = getSelectedEmployeeTypeLabel({
        query: cleanQuery,
        lookups,
    })
    const selectedMetricLabel = getSelectedMetricLabel({
        query: cleanQuery,
        lookups,
    })

    const result = {
        filters: {
            startDate: cleanQuery.startDate,
            endDate: cleanQuery.endDate,
            selectedPeriodKey: selectedPeriod?.key || null,
            companyId: cleanQuery.companyId || null,
            branchId: cleanQuery.branchId || null,
            departmentId: cleanQuery.departmentId || null,
            positionId: cleanQuery.positionId || null,
            lineId: cleanQuery.lineId || null,
            employeeTypeId: cleanQuery.employeeTypeId || null,
            employeeTypeChildCode: cleanQuery.employeeTypeChildCode || null,
            employeeTypeFilterKey: cleanQuery.employeeTypeFilterKey || null,
            employeeTypeLabel: selectedEmployeeTypeLabel,
        },
        general: buildGeneralData({
            totalEmployees: totalGeneralEmployees,
            selectedEmployees: employees,
            selectedDate: endDate,
            selectedLabel: selectedMetricLabel,
            selectedPeriod,
            totalManpower,
            selectedManpower: manpower,
        }),
        manpower,
        recruitment: buildRecruitmentChannelDashboard({
            employees,
            recruitmentChannels,
            periods,
            startDate,
            endDate,
        }),
        attendance: {
            summary: buildAttendanceSummary(attendanceMonthly),
            monthly: attendanceMonthly,
            byLine: buildAttendanceLineSummary({ records: attendanceRecords, lines }),
        },
        movement: buildMovementSeries({ movements, periods, query: cleanQuery }),
    }

    return setCache(cacheKey, result, 30_000)
}
