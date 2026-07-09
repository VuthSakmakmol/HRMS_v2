import { Types } from "mongoose"

import { getCache, setCache } from "../../../shared/cache/memoryCache.js"

import Employee from "../../employee/models/Employee.js"
import EmployeeMovement from "../../employeeMovement/models/EmployeeMovement.js"
import ManpowerPlan from "../../manpowerPlan/models/ManpowerPlan.js"

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

const MOVEMENT_IN_TYPES = new Set(["NEW_HIRE", "REJOIN"])
const MOVEMENT_OUT_TYPES = new Set([
    "RESIGN",
    "TERMINATE",
    "ABANDON",
    "PASSED_AWAY",
    "RETIRE",
])
const MOVEMENT_CHANGE_TYPES = new Set([
    "TRANSFER",
    "DEPARTMENT_CHANGE",
    "POSITION_CHANGE",
    "LINE_CHANGE",
    "SHIFT_CHANGE",
    "EMPLOYEE_TYPE_CHANGE",
    "STATUS_CHANGE",
    "OTHER",
])

const DIMENSION_KEYS = Object.freeze([
    "companyId",
    "branchId",
    "departmentId",
    "positionId",
    "lineId",
    "shiftId",
    "employeeTypeId",
    "employeeTypeChildId",
])

function idString(value) {
    if (!value) return ""
    return value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || ""
}

function moneyNumber(value) {
    const number = Number(value || 0)
    return Number.isFinite(number) ? number : 0
}

function round(value, digits = 1) {
    const number = Number(value || 0)
    if (!Number.isFinite(number)) return 0
    const factor = 10 ** digits
    return Math.round(number * factor) / factor
}

function startOfDay(dateValue) {
    const date = new Date(dateValue)
    date.setHours(0, 0, 0, 0)
    return date
}

function endOfDay(dateValue) {
    const date = new Date(dateValue)
    date.setHours(23, 59, 59, 999)
    return date
}

function monthEndDate(year, month) {
    return endOfDay(new Date(year, month, 0))
}

function monthStartDate(year, month) {
    return startOfDay(new Date(year, month - 1, 1))
}

function resolveDateContext(query) {
    const now = new Date()
    const asOfDate = endOfDay(query.asOfDate || now)
    const year = query.year || asOfDate.getFullYear()
    const month = query.month || asOfDate.getMonth() + 1
    const fromDate = startOfDay(query.fromDate || monthStartDate(year, month))
    const toDate = endOfDay(query.toDate || monthEndDate(year, month))

    return { asOfDate, fromDate, toDate, year, month }
}

function toIsoDate(date) {
    return date.toISOString().slice(0, 10)
}

function getUserCompanyIds(user) {
    return [
        ...new Set(
            (user?.roleAssignments || [])
                .map((item) => item.companyId)
                .filter(Boolean)
                .map((item) => item.toString()),
        ),
    ]
}

function getScopedCompanyBranchPairs(user) {
    if (user?.isRootAdmin) {
        return { root: true, allBranchCompanyIds: [], branchIds: [] }
    }

    const allBranchCompanyIds = []
    const branchIds = []

    for (const assignment of user?.roleAssignments || []) {
        if (assignment.allBranches && assignment.companyId) {
            allBranchCompanyIds.push(assignment.companyId.toString())
        }

        for (const branchId of assignment.branchIds || []) {
            branchIds.push(branchId.toString())
        }
    }

    return {
        root: false,
        allBranchCompanyIds: [...new Set(allBranchCompanyIds)],
        branchIds: [...new Set(branchIds)],
    }
}

function getEmployeeScopeFilter(user) {
    const scope = getScopedCompanyBranchPairs(user)
    if (scope.root) return {}

    const filters = []
    if (scope.allBranchCompanyIds.length) {
        filters.push({ companyId: { $in: scope.allBranchCompanyIds } })
    }
    if (scope.branchIds.length) {
        filters.push({ branchId: { $in: scope.branchIds } })
    }

    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function getPlanScopeFilter(user) {
    const scope = getScopedCompanyBranchPairs(user)
    if (scope.root) return {}

    const filters = []
    if (scope.allBranchCompanyIds.length) {
        filters.push({ companyId: { $in: scope.allBranchCompanyIds } })
    }
    if (scope.branchIds.length) {
        filters.push({ branchId: { $in: scope.branchIds } })
    }

    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function getMovementScopeFilter(user) {
    const scope = getScopedCompanyBranchPairs(user)
    if (scope.root) return {}

    const filters = []
    if (scope.allBranchCompanyIds.length) {
        filters.push({ "to.companyId": { $in: scope.allBranchCompanyIds } })
        filters.push({ "from.companyId": { $in: scope.allBranchCompanyIds } })
    }
    if (scope.branchIds.length) {
        filters.push({ "to.branchId": { $in: scope.branchIds } })
        filters.push({ "from.branchId": { $in: scope.branchIds } })
    }

    return filters.length ? { $or: filters } : { _id: { $in: [] } }
}

function applyDimensionFilters(filter, query, { baseOnly = false } = {}) {
    const keys = baseOnly ? ["companyId", "branchId"] : DIMENSION_KEYS

    for (const key of keys) {
        if (query[key]) filter[key] = query[key]
    }

    if (!baseOnly) {
        if (query.gender && query.gender !== "ALL") filter.gender = query.gender
        if (query.nationality) {
            filter.nationality = new RegExp(`^${query.nationality.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")
        }
        if (query.employmentStatus && query.employmentStatus !== "ALL") {
            filter.employmentStatus = query.employmentStatus
        }
    }

    return filter
}

function buildActiveAsOfFilter({ query, user, asOfDate, baseOnly = false }) {
    const filter = {
        ...getEmployeeScopeFilter(user),
        recordStatus: "ACTIVE",
        joinDate: { $lte: asOfDate },
        $or: [
            { resignDate: null },
            { resignDate: { $exists: false } },
            { resignDate: { $gt: asOfDate } },
        ],
    }

    return applyDimensionFilters(filter, query, { baseOnly })
}

function buildEmployeePeriodFilter({ query, user, fromDate, toDate, dateField }) {
    const filter = {
        ...getEmployeeScopeFilter(user),
        recordStatus: "ACTIVE",
        [dateField]: { $gte: fromDate, $lte: toDate },
    }

    return applyDimensionFilters(filter, query)
}

function buildAnnualEmployeeFilter({ query, user, year }) {
    const yearStart = monthStartDate(year, 1)
    const yearEnd = monthEndDate(year, 12)
    const filter = {
        ...getEmployeeScopeFilter(user),
        recordStatus: "ACTIVE",
        joinDate: { $lte: yearEnd },
        $or: [
            { resignDate: null },
            { resignDate: { $exists: false } },
            { resignDate: { $gt: yearStart } },
        ],
    }

    return applyDimensionFilters(filter, query)
}

function employeePopulate(query) {
    return query
        .populate({ path: "companyId", select: "code displayName legalName name shortName status" })
        .populate({ path: "branchId", select: "code name shortName status" })
        .populate({ path: "departmentId", select: "code name shortName status" })
        .populate({ path: "positionId", select: "code title name shortName status" })
        .populate({ path: "lineId", select: "code name shortName status" })
        .populate({ path: "shiftId", select: "code name shortName status" })
        .populate({ path: "employeeTypeId", select: "code name typeCode typeName title displayName shortName status" })
}

function planPopulate(query) {
    return query
        .populate({ path: "departmentId", select: "code name shortName status" })
        .populate({ path: "positionId", select: "code title name shortName status" })
        .populate({ path: "lineId", select: "code name shortName status" })
        .populate({ path: "shiftId", select: "code name shortName status" })
        .populate({ path: "employeeTypeId", select: "code name typeCode typeName title displayName shortName status" })
}

function simpleOrg(item) {
    if (!item || typeof item !== "object") return null

    return {
        id: idString(item),
        code: item.code || item.typeCode || "",
        name:
            item.name ||
            item.title ||
            item.displayName ||
            item.legalName ||
            item.typeName ||
            "",
        shortName: item.shortName || "",
    }
}

function dimensionItem(id, label, code = "") {
    return {
        id: id || "UNASSIGNED",
        code: code || "",
        label: label || "Unassigned",
        value: 0,
        percent: 0,
    }
}

function getOrgLabel(item) {
    const org = simpleOrg(item)
    if (!org) return "Unassigned"
    return [org.code, org.name || org.shortName].filter(Boolean).join(" - ") || "Unassigned"
}

function ageInYears(dateValue, asOfDate) {
    if (!dateValue) return null
    const date = new Date(dateValue)
    if (Number.isNaN(date.getTime())) return null

    let years = asOfDate.getFullYear() - date.getFullYear()
    const monthDiff = asOfDate.getMonth() - date.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && asOfDate.getDate() < date.getDate())) {
        years -= 1
    }

    return years < 0 ? null : years
}

function serviceInYears(joinDate, asOfDate) {
    if (!joinDate) return null
    const date = new Date(joinDate)
    if (Number.isNaN(date.getTime()) || date > asOfDate) return null
    return round((asOfDate.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000), 1)
}

function average(values) {
    const cleanValues = values.filter((value) => typeof value === "number" && Number.isFinite(value))
    if (!cleanValues.length) return 0
    return round(cleanValues.reduce((sum, value) => sum + value, 0) / cleanValues.length, 1)
}

function buildSummary(employees, asOfDate) {
    return {
        headcount: employees.length,
        avgAge: average(employees.map((employee) => ageInYears(employee.dateOfBirth, asOfDate))),
        avgService: average(employees.map((employee) => serviceInYears(employee.joinDate, asOfDate))),
    }
}

function groupEmployees(employees, getKey, getLabel, total) {
    const map = new Map()

    for (const employee of employees) {
        const id = getKey(employee) || "UNASSIGNED"
        const labelData = getLabel(employee)

        if (!map.has(id)) {
            map.set(
                id,
                dimensionItem(
                    id,
                    labelData.label,
                    labelData.code,
                ),
            )
        }

        map.get(id).value += 1
    }

    return [...map.values()]
        .map((item) => ({
            ...item,
            percent: total > 0 ? round((item.value / total) * 100, 1) : 0,
        }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

function buildBreakdowns(employees) {
    const total = employees.length

    return {
        byEmployeeType: groupEmployees(
            employees,
            (employee) => idString(employee.employeeTypeId),
            (employee) => {
                const org = simpleOrg(employee.employeeTypeId)
                return { code: org?.code || "", label: getOrgLabel(employee.employeeTypeId) }
            },
            total,
        ),

        byChildGroup: groupEmployees(
            employees,
            (employee) => idString(employee.employeeTypeChildId) || "DIRECT_TO_TYPE",
            (employee) => ({
                code: employee.employeeTypeChildCode || "",
                label: employee.employeeTypeChildName || "Direct to employee type",
            }),
            total,
        ),

        byDepartment: groupEmployees(
            employees,
            (employee) => idString(employee.departmentId),
            (employee) => {
                const org = simpleOrg(employee.departmentId)
                return { code: org?.code || "", label: getOrgLabel(employee.departmentId) }
            },
            total,
        ),

        byPosition: groupEmployees(
            employees,
            (employee) => idString(employee.positionId),
            (employee) => {
                const org = simpleOrg(employee.positionId)
                return { code: org?.code || "", label: getOrgLabel(employee.positionId) }
            },
            total,
        ),

        byLine: groupEmployees(
            employees,
            (employee) => idString(employee.lineId),
            (employee) => {
                const org = simpleOrg(employee.lineId)
                return { code: org?.code || "", label: getOrgLabel(employee.lineId) }
            },
            total,
        ),
    }
}

function isActiveOn(employee, date) {
    const joinDate = employee.joinDate ? new Date(employee.joinDate) : null
    if (!joinDate || Number.isNaN(joinDate.getTime()) || joinDate > date) return false

    const resignDate = employee.resignDate ? new Date(employee.resignDate) : null
    if (resignDate && !Number.isNaN(resignDate.getTime()) && resignDate <= date) return false

    return employee.recordStatus !== "ARCHIVED"
}

function buildPlanFilter({ query, user, year, month = null }) {
    const filter = {
        ...getPlanScopeFilter(user),
        status: "ACTIVE",
        year,
    }

    if (month) filter.month = month

    for (const key of DIMENSION_KEYS) {
        if (query[key]) filter[key] = query[key]
    }

    return filter
}

function buildManpowerPlanMonths({ plans, annualEmployees, year }) {
    const monthMap = new Map()

    for (let month = 1; month <= 12; month += 1) {
        const endDate = monthEndDate(year, month)
        monthMap.set(month, {
            month,
            label: MONTH_LABELS[month - 1],
            targetBudget: 0,
            targetRoadmap: 0,
            actual: annualEmployees.filter((employee) => isActiveOn(employee, endDate)).length,
            gapBudget: 0,
            gapRoadmap: 0,
            fillRate: 0,
        })
    }

    for (const plan of plans) {
        const row = monthMap.get(plan.month)
        if (!row) continue

        row.targetBudget += moneyNumber(plan.targetBudget)
        row.targetRoadmap += moneyNumber(plan.targetRoadmap)
    }

    for (const row of monthMap.values()) {
        row.gapBudget = row.actual - row.targetBudget
        row.gapRoadmap = row.actual - row.targetRoadmap
        row.fillRate = row.targetRoadmap > 0 ? round((row.actual / row.targetRoadmap) * 100, 1) : 0
    }

    return [...monthMap.values()]
}

function snapshotMatches(snapshot = {}, query) {
    for (const key of DIMENSION_KEYS) {
        if (!query[key]) continue
        if (idString(snapshot[key]) !== query[key].toString()) return false
    }

    return true
}

function classifyMovement(movement, query) {
    const type = movement.movementType
    const fromMatches = snapshotMatches(movement.from, query)
    const toMatches = snapshotMatches(movement.to, query)

    if (MOVEMENT_IN_TYPES.has(type)) {
        return toMatches ? "IN" : "IGNORED"
    }

    if (MOVEMENT_OUT_TYPES.has(type)) {
        return fromMatches || toMatches ? "OUT" : "IGNORED"
    }

    if (MOVEMENT_CHANGE_TYPES.has(type)) {
        if (!fromMatches && toMatches) return "IN"
        if (fromMatches && !toMatches) return "OUT"
        if (fromMatches && toMatches) return "INTERNAL"
    }

    return "IGNORED"
}

function buildMovementResult({ movements, query, year }) {
    const months = MONTH_LABELS.map((label, index) => ({
        month: index + 1,
        label,
        in: 0,
        out: 0,
        balance: 0,
        internal: 0,
    }))

    const summary = {
        in: 0,
        out: 0,
        balance: 0,
        internal: 0,
    }

    for (const movement of movements) {
        const bucket = classifyMovement(movement, query)
        if (bucket === "IGNORED") continue

        const effectiveDate = new Date(movement.effectiveDate)
        const monthIndex = effectiveDate.getFullYear() === year ? effectiveDate.getMonth() : -1

        if (bucket === "IN") {
            summary.in += 1
            if (monthIndex >= 0) months[monthIndex].in += 1
        } else if (bucket === "OUT") {
            summary.out += 1
            if (monthIndex >= 0) months[monthIndex].out += 1
        } else if (bucket === "INTERNAL") {
            summary.internal += 1
            if (monthIndex >= 0) months[monthIndex].internal += 1
        }
    }

    summary.balance = summary.in - summary.out

    for (const month of months) {
        month.balance = month.in - month.out
    }

    return { summary, months }
}

function serviceBucket(joinDate, endDate) {
    const service = serviceInYears(joinDate, endDate)
    if (service === null) return "Unknown"
    if (service < 0.25) return "< 3M"
    if (service < 0.5) return "3-<6M"
    if (service < 0.75) return "6-<9M"
    if (service < 1) return "9-<12M"
    if (service < 3) return "1-<3Y"
    if (service < 5) return "3-<5Y"
    if (service < 10) return "5-<10Y"
    return "10Y+"
}

function groupSimple(items, getKey) {
    const map = new Map()

    for (const item of items) {
        const key = getKey(item) || "Unknown"
        map.set(key, (map.get(key) || 0) + 1)
    }

    const total = items.length

    return [...map.entries()]
        .map(([label, value]) => ({
            label,
            value,
            percent: total > 0 ? round((value / total) * 100, 1) : 0,
        }))
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

function buildRecruitmentResult(hires) {
    return {
        totalHires: hires.length,
        channels: groupSimple(hires, (employee) => employee.sourceOfHiring || "Unknown"),
    }
}

function buildTurnoverResult({ exits, startHeadcount, endHeadcount, toDate }) {
    const averageHeadcount = round((startHeadcount + endHeadcount) / 2, 1)
    const turnoverRate = averageHeadcount > 0 ? round((exits.length / averageHeadcount) * 100, 2) : 0

    return {
        totalExits: exits.length,
        startHeadcount,
        endHeadcount,
        averageHeadcount,
        turnoverRate,
        reasons: groupSimple(exits, (employee) => employee.resignReason || "Unknown"),
        servicePeriods: groupSimple(exits, (employee) => serviceBucket(employee.joinDate, toDate)),
    }
}

function buildVacancyResult({ plans, employees, selectedMonthEnd }) {
    const rows = new Map()

    for (const plan of plans) {
        const positionId = idString(plan.positionId) || "OVERALL"
        const org = simpleOrg(plan.positionId)
        const label = positionId === "OVERALL" ? "Overall" : getOrgLabel(plan.positionId)

        if (!rows.has(positionId)) {
            rows.set(positionId, {
                id: positionId,
                code: org?.code || "",
                label,
                targetRoadmap: 0,
                actual: 0,
                vacancy: 0,
            })
        }

        rows.get(positionId).targetRoadmap += moneyNumber(plan.targetRoadmap)
    }

    for (const employee of employees) {
        if (!isActiveOn(employee, selectedMonthEnd)) continue
        const positionId = idString(employee.positionId) || "OVERALL"
        const org = simpleOrg(employee.positionId)
        const label = getOrgLabel(employee.positionId)

        if (!rows.has(positionId)) {
            rows.set(positionId, {
                id: positionId,
                code: org?.code || "",
                label,
                targetRoadmap: 0,
                actual: 0,
                vacancy: 0,
            })
        }

        rows.get(positionId).actual += 1
    }

    const items = [...rows.values()]
        .map((row) => ({
            ...row,
            vacancy: Math.max(0, row.targetRoadmap - row.actual),
        }))
        .filter((row) => row.targetRoadmap > 0 || row.actual > 0)
        .sort((a, b) => b.vacancy - a.vacancy || a.label.localeCompare(b.label))

    return {
        totalVacancy: items.reduce((sum, row) => sum + row.vacancy, 0),
        items: items.slice(0, 15),
    }
}

export async function getHrManagementDashboard({ query, user }) {
    const dateContext = resolveDateContext(query)
    const cacheKey = `report:hr-management-dashboard:${user?.accountId || "anonymous"}:${JSON.stringify({
        ...query,
        asOfDate: toIsoDate(dateContext.asOfDate),
        fromDate: toIsoDate(dateContext.fromDate),
        toDate: toIsoDate(dateContext.toDate),
        year: dateContext.year,
        month: dateContext.month,
    })}`

    const cached = getCache(cacheKey)
    if (cached) return cached

    const { asOfDate, fromDate, toDate, year, month } = dateContext
    const selectedMonthEnd = monthEndDate(year, month)

    const [totalEmployees, selectedEmployees, annualEmployees, plans, selectedMonthPlans, movements, hires, exits, startEmployees, endEmployees] = await Promise.all([
        employeePopulate(Employee.find(buildActiveAsOfFilter({ query, user, asOfDate, baseOnly: true }))).lean(),
        employeePopulate(Employee.find(buildActiveAsOfFilter({ query, user, asOfDate }))).lean(),
        employeePopulate(Employee.find(buildAnnualEmployeeFilter({ query, user, year }))).lean(),
        ManpowerPlan.find(buildPlanFilter({ query, user, year })).lean(),
        planPopulate(ManpowerPlan.find(buildPlanFilter({ query, user, year, month }))).lean(),
        EmployeeMovement.find({
            ...getMovementScopeFilter(user),
            status: "ACTIVE",
            effectiveDate: { $gte: fromDate, $lte: toDate },
        }).lean(),
        employeePopulate(Employee.find(buildEmployeePeriodFilter({ query, user, fromDate, toDate, dateField: "joinDate" }))).lean(),
        employeePopulate(Employee.find(buildEmployeePeriodFilter({ query, user, fromDate, toDate, dateField: "resignDate" }))).lean(),
        Employee.countDocuments(buildActiveAsOfFilter({ query, user, asOfDate: startOfDay(fromDate) })),
        Employee.countDocuments(buildActiveAsOfFilter({ query, user, asOfDate: toDate })),
    ])

    const manpowerMonths = buildManpowerPlanMonths({ plans, annualEmployees, year })
    const selectedMonth = manpowerMonths.find((item) => item.month === month) || manpowerMonths[0]

    const result = {
        meta: {
            generatedAt: new Date().toISOString(),
            asOfDate: toIsoDate(asOfDate),
            fromDate: toIsoDate(fromDate),
            toDate: toIsoDate(toDate),
            year,
            month,
            monthLabel: MONTH_LABELS[month - 1],
            note: "V1 uses Employee, Manpower Plan, and Employee Movement source data. Absence, labor cost, and OT expense can connect after those modules are ready.",
        },

        summary: {
            total: buildSummary(totalEmployees, asOfDate),
            selected: buildSummary(selectedEmployees, asOfDate),
            selectedMonth: {
                actual: selectedMonth?.actual || 0,
                targetBudget: selectedMonth?.targetBudget || 0,
                targetRoadmap: selectedMonth?.targetRoadmap || 0,
                gapBudget: selectedMonth?.gapBudget || 0,
                gapRoadmap: selectedMonth?.gapRoadmap || 0,
                fillRate: selectedMonth?.fillRate || 0,
            },
        },

        breakdowns: buildBreakdowns(selectedEmployees),

        manpowerPlan: {
            selectedMonth,
            months: manpowerMonths,
        },

        movement: buildMovementResult({ movements, query, year }),
        recruitment: buildRecruitmentResult(hires),
        turnover: buildTurnoverResult({ exits, startHeadcount: startEmployees, endHeadcount: endEmployees, toDate }),
        vacancy: buildVacancyResult({ plans: selectedMonthPlans, employees: annualEmployees, selectedMonthEnd }),
    }

    return setCache(cacheKey, result, 60_000)
}
