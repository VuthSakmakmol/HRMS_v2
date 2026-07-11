import mongoose from "mongoose"

import {
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"
import AttendanceRecord from "../../attendance/models/AttendanceRecord.js"
import Employee from "../../employee/models/Employee.js"
import EmployeeType from "../../employeeType/models/EmployeeType.js"
import Department from "../../organization/models/Department.js"
import Position from "../../organization/models/Position.js"
import Line from "../../line/models/Line.js"
import Shift from "../../shift/models/Shift.js"

export const ATTENDANCE_DASHBOARD_CACHE_PREFIX = "attendance:dashboard:"

const ATTENDANCE_DASHBOARD_CACHE_TTL_MS = 30_000

const PRESENT_STATUSES = [
    "PRESENT",
    "LATE",
    "EARLY_LEAVE",
    "LATE_AND_EARLY_LEAVE",
]

const LATE_STATUSES = ["LATE", "LATE_AND_EARLY_LEAVE"]
const EARLY_STATUSES = ["EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"]

function dateKeyToStartDate(dateKey) {
    return new Date(`${dateKey}T00:00:00.000Z`)
}

function dateKeyToEndDate(dateKey) {
    return new Date(`${dateKey}T23:59:59.999Z`)
}

function normalizeObjectId(id) {
    if (!id) {
        return undefined
    }

    return new mongoose.Types.ObjectId(id)
}

function toIdString(value) {
    return value?._id?.toString?.() || value?.toString?.() || String(value || "")
}

function normalizeQueryForCache(query) {
    return JSON.stringify(
        Object.keys(query)
            .sort()
            .reduce((result, key) => {
                result[key] = query[key]
                return result
            }, {}),
    )
}

function emptyStatusMap() {
    return {
        PRESENT: 0,
        LATE: 0,
        EARLY_LEAVE: 0,
        LATE_AND_EARLY_LEAVE: 0,
        MISSING_IN: 0,
        MISSING_OUT: 0,
        ABSENT: 0,
        REST_DAY: 0,
        HOLIDAY: 0,
    }
}

function buildAssignmentFilter(query) {
    const filter = {}

    for (const field of [
        "companyId",
        "branchId",
        "departmentId",
        "positionId",
        "lineId",
        "shiftId",
        "employeeTypeId",
    ]) {
        if (query[field]) {
            filter[field] = normalizeObjectId(query[field])
        }
    }

    return filter
}

function buildAttendanceFilter(query, employeeIds = null) {
    const filter = {
        attendanceDate: {
            $gte: dateKeyToStartDate(query.dateFrom),
            $lte: dateKeyToEndDate(query.dateTo),
        },
    }

    for (const field of [
        "companyId",
        "branchId",
        "departmentId",
        "positionId",
        "lineId",
        "shiftId",
    ]) {
        if (query[field]) {
            filter[field] = normalizeObjectId(query[field])
        }
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    if (employeeIds) {
        filter.employeeId = {
            $in: employeeIds,
        }
    }

    return filter
}

function buildEmployeeSearchFilter(search) {
    const value = String(search || "").trim()

    if (!value) {
        return {}
    }

    const regex = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")

    return {
        $or: [
            { employeeCode: regex },
            { displayName: regex },
            { englishFirstName: regex },
            { englishLastName: regex },
            { khmerFirstName: regex },
            { khmerLastName: regex },
            { phoneNumber: regex },
        ],
    }
}

async function resolveEmployeeIdsForFilter(query) {
    const employeeFilter = {
        recordStatus: "ACTIVE",
        ...buildAssignmentFilter(query),
        ...buildEmployeeSearchFilter(query.search),
    }

    const needsEmployeeFilter = Boolean(
        query.employeeTypeId || query.search,
    )

    if (!needsEmployeeFilter) {
        return null
    }

    const employees = await Employee.find(employeeFilter).select("_id").lean()

    return employees.map((employee) => employee._id)
}

async function countExpectedEmployees(query) {
    const filter = {
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
        joinDate: {
            $lte: dateKeyToEndDate(query.dateTo),
        },
        $or: [
            { resignDate: null },
            { resignDate: { $gte: dateKeyToStartDate(query.dateFrom) } },
        ],
        ...buildAssignmentFilter(query),
        ...buildEmployeeSearchFilter(query.search),
    }

    return Employee.countDocuments(filter)
}

async function aggregateStatusBreakdown(filter) {
    const rows = await AttendanceRecord.aggregate([
        { $match: filter },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
                workedMinutes: { $sum: "$workedMinutes" },
                lateMinutes: { $sum: "$lateMinutes" },
                earlyLeaveMinutes: { $sum: "$earlyLeaveMinutes" },
            },
        },
    ])

    const map = emptyStatusMap()
    let totalWorkedMinutes = 0
    let totalLateMinutes = 0
    let totalEarlyLeaveMinutes = 0

    for (const row of rows) {
        map[row._id] = row.count
        totalWorkedMinutes += row.workedMinutes || 0
        totalLateMinutes += row.lateMinutes || 0
        totalEarlyLeaveMinutes += row.earlyLeaveMinutes || 0
    }

    return {
        map,
        items: Object.entries(map).map(([status, count]) => ({
            status,
            count,
        })),
        totalWorkedMinutes,
        totalLateMinutes,
        totalEarlyLeaveMinutes,
    }
}

async function aggregateVerificationBreakdown(filter) {
    const rows = await AttendanceRecord.aggregate([
        { $match: filter },
        {
            $group: {
                _id: "$verificationStatus",
                count: { $sum: 1 },
            },
        },
    ])

    return rows.map((row) => ({
        verificationStatus: row._id || "UNKNOWN",
        count: row.count,
    }))
}

async function aggregateTrend(filter) {
    const rows = await AttendanceRecord.aggregate([
        { $match: filter },
        {
            $group: {
                _id: {
                    date: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$attendanceDate",
                        },
                    },
                    status: "$status",
                },
                count: { $sum: 1 },
            },
        },
        { $sort: { "_id.date": 1 } },
    ])

    const trendMap = new Map()

    for (const row of rows) {
        const dateKey = row._id.date
        const status = row._id.status
        const item = trendMap.get(dateKey) || {
            date: dateKey,
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            earlyLeave: 0,
            missing: 0,
            restDay: 0,
            holiday: 0,
        }

        item.total += row.count

        if (PRESENT_STATUSES.includes(status)) {
            item.present += row.count
        }

        if (status === "ABSENT") {
            item.absent += row.count
        }

        if (LATE_STATUSES.includes(status)) {
            item.late += row.count
        }

        if (EARLY_STATUSES.includes(status)) {
            item.earlyLeave += row.count
        }

        if (["MISSING_IN", "MISSING_OUT"].includes(status)) {
            item.missing += row.count
        }

        if (status === "REST_DAY") {
            item.restDay += row.count
        }

        if (status === "HOLIDAY") {
            item.holiday += row.count
        }

        trendMap.set(dateKey, item)
    }

    return [...trendMap.values()]
}

async function attachDepartmentLabels(items) {
    const ids = items.map((item) => item.departmentId).filter(Boolean)
    const rows = await Department.find({ _id: { $in: ids } })
        .select("code name")
        .lean()
    const map = new Map(rows.map((row) => [toIdString(row._id), row]))

    return items.map((item) => {
        const row = map.get(toIdString(item.departmentId))

        return {
            ...item,
            code: row?.code || "-",
            name: row?.name || "-",
        }
    })
}

async function attachPositionLabels(items) {
    const ids = items.map((item) => item.positionId).filter(Boolean)
    const rows = await Position.find({ _id: { $in: ids } })
        .select("code title name")
        .lean()
    const map = new Map(rows.map((row) => [toIdString(row._id), row]))

    return items.map((item) => {
        const row = map.get(toIdString(item.positionId))

        return {
            ...item,
            code: row?.code || "-",
            name: row?.title || row?.name || "-",
        }
    })
}

async function attachLineLabels(items) {
    const ids = items.map((item) => item.lineId).filter(Boolean)
    const rows = await Line.find({ _id: { $in: ids } })
        .select("code name")
        .lean()
    const map = new Map(rows.map((row) => [toIdString(row._id), row]))

    return items.map((item) => {
        const row = map.get(toIdString(item.lineId))

        return {
            ...item,
            code: row?.code || "-",
            name: row?.name || "-",
        }
    })
}

async function attachShiftLabels(items) {
    const ids = items.map((item) => item.shiftId).filter(Boolean)
    const rows = await Shift.find({ _id: { $in: ids } })
        .select("code name startTime endTime")
        .lean()
    const map = new Map(rows.map((row) => [toIdString(row._id), row]))

    return items.map((item) => {
        const row = map.get(toIdString(item.shiftId))

        return {
            ...item,
            code: row?.code || "-",
            name: row?.name || "-",
            startTime: row?.startTime || "",
            endTime: row?.endTime || "",
        }
    })
}

async function aggregateGroupSummary(filter, groupField, outputField, attachLabels) {
    const rows = await AttendanceRecord.aggregate([
        { $match: filter },
        {
            $group: {
                _id: `$${groupField}`,
                total: { $sum: 1 },
                present: {
                    $sum: {
                        $cond: [{ $in: ["$status", PRESENT_STATUSES] }, 1, 0],
                    },
                },
                absent: {
                    $sum: {
                        $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0],
                    },
                },
                late: {
                    $sum: {
                        $cond: [{ $in: ["$status", LATE_STATUSES] }, 1, 0],
                    },
                },
                earlyLeave: {
                    $sum: {
                        $cond: [{ $in: ["$status", EARLY_STATUSES] }, 1, 0],
                    },
                },
                needsReview: {
                    $sum: {
                        $cond: [
                            { $eq: ["$verificationStatus", "NEEDS_REVIEW"] },
                            1,
                            0,
                        ],
                    },
                },
                workedMinutes: { $sum: "$workedMinutes" },
                lateMinutes: { $sum: "$lateMinutes" },
                earlyLeaveMinutes: { $sum: "$earlyLeaveMinutes" },
            },
        },
        { $sort: { total: -1 } },
        { $limit: 20 },
    ])

    const items = rows.map((row) => ({
        [outputField]: row._id,
        total: row.total,
        present: row.present,
        absent: row.absent,
        late: row.late,
        earlyLeave: row.earlyLeave,
        needsReview: row.needsReview,
        workedMinutes: row.workedMinutes,
        lateMinutes: row.lateMinutes,
        earlyLeaveMinutes: row.earlyLeaveMinutes,
    }))

    return attachLabels(items)
}

async function getNeedsReviewRecords(filter, limit) {
    const rows = await AttendanceRecord.find({
        ...filter,
        verificationStatus: "NEEDS_REVIEW",
    })
        .populate("employeeId", "employeeCode displayName englishFirstName englishLastName")
        .populate("departmentId", "code name")
        .populate("positionId", "code title name")
        .populate("lineId", "code name")
        .populate("shiftId", "code name startTime endTime")
        .sort({ attendanceDate: -1, employeeCode: 1 })
        .limit(limit)
        .lean()

    return rows.map((row) => ({
        id: row._id.toString(),
        attendanceDate: row.attendanceDate,
        employeeCode: row.employeeCode,
        employeeName:
            row.employeeId?.displayName ||
            [row.employeeId?.englishFirstName, row.employeeId?.englishLastName]
                .filter(Boolean)
                .join(" ") ||
            "-",
        department: row.departmentId
            ? {
                  code: row.departmentId.code,
                  name: row.departmentId.name,
              }
            : null,
        position: row.positionId
            ? {
                  code: row.positionId.code,
                  name: row.positionId.title || row.positionId.name,
              }
            : null,
        line: row.lineId
            ? {
                  code: row.lineId.code,
                  name: row.lineId.name,
              }
            : null,
        shift: row.shiftId
            ? {
                  code: row.shiftId.code,
                  name: row.shiftId.name,
              }
            : null,
        firstInAt: row.firstInAt,
        lastOutAt: row.lastOutAt,
        workedMinutes: row.workedMinutes,
        lateMinutes: row.lateMinutes,
        earlyLeaveMinutes: row.earlyLeaveMinutes,
        status: row.status,
        verificationStatus: row.verificationStatus,
        note: row.note,
    }))
}

async function getTopLateEmployees(filter, limit) {
    const rows = await AttendanceRecord.aggregate([
        {
            $match: {
                ...filter,
                lateMinutes: { $gt: 0 },
            },
        },
        {
            $group: {
                _id: "$employeeId",
                employeeCode: { $first: "$employeeCode" },
                lateDays: { $sum: 1 },
                totalLateMinutes: { $sum: "$lateMinutes" },
                maxLateMinutes: { $max: "$lateMinutes" },
            },
        },
        { $sort: { totalLateMinutes: -1, lateDays: -1 } },
        { $limit: limit },
    ])

    const employeeIds = rows.map((row) => row._id)
    const employees = await Employee.find({ _id: { $in: employeeIds } })
        .select("employeeCode displayName englishFirstName englishLastName")
        .lean()
    const employeeMap = new Map(
        employees.map((employee) => [toIdString(employee._id), employee]),
    )

    return rows.map((row) => {
        const employee = employeeMap.get(toIdString(row._id))

        return {
            employeeId: row._id,
            employeeCode: row.employeeCode,
            employeeName:
                employee?.displayName ||
                [employee?.englishFirstName, employee?.englishLastName]
                    .filter(Boolean)
                    .join(" ") ||
                "-",
            lateDays: row.lateDays,
            totalLateMinutes: row.totalLateMinutes,
            maxLateMinutes: row.maxLateMinutes,
        }
    })
}

async function getEmployeeTypeSummary(query) {
    const employeeMatch = {
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
        joinDate: {
            $lte: dateKeyToEndDate(query.dateTo),
        },
        $or: [
            { resignDate: null },
            { resignDate: { $gte: dateKeyToStartDate(query.dateFrom) } },
        ],
        ...buildAssignmentFilter(query),
        ...buildEmployeeSearchFilter(query.search),
    }

    const rows = await Employee.aggregate([
        { $match: employeeMatch },
        {
            $group: {
                _id: "$employeeTypeId",
                employeeCount: { $sum: 1 },
            },
        },
        { $sort: { employeeCount: -1 } },
        { $limit: 20 },
    ])

    const ids = rows.map((row) => row._id).filter(Boolean)
    const types = await EmployeeType.find({ _id: { $in: ids } })
        .select("code name")
        .lean()
    const typeMap = new Map(types.map((type) => [toIdString(type._id), type]))

    return rows.map((row) => {
        const type = typeMap.get(toIdString(row._id))

        return {
            employeeTypeId: row._id,
            code: type?.code || (row._id ? "-" : "NO_TYPE"),
            name: type?.name || (row._id ? "-" : "No Type"),
            employeeCount: row.employeeCount,
        }
    })
}

export async function getAttendanceDashboard({ query, user }) {
    const cacheKey = `${ATTENDANCE_DASHBOARD_CACHE_PREFIX}${user?.accountId || "anonymous"}:${normalizeQueryForCache(query)}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const employeeIds = await resolveEmployeeIdsForFilter(query)
    const attendanceFilter = buildAttendanceFilter(query, employeeIds)
    const [expectedEmployees, statusResult, verificationBreakdown, trend] = await Promise.all([
        countExpectedEmployees(query),
        aggregateStatusBreakdown(attendanceFilter),
        aggregateVerificationBreakdown(attendanceFilter),
        aggregateTrend(attendanceFilter),
    ])

    const statusMap = statusResult.map
    const presentTotal = PRESENT_STATUSES.reduce(
        (sum, status) => sum + (statusMap[status] || 0),
        0,
    )
    const lateTotal = LATE_STATUSES.reduce(
        (sum, status) => sum + (statusMap[status] || 0),
        0,
    )
    const earlyLeaveTotal = EARLY_STATUSES.reduce(
        (sum, status) => sum + (statusMap[status] || 0),
        0,
    )
    const missingTotal = (statusMap.MISSING_IN || 0) + (statusMap.MISSING_OUT || 0)
    const processedRecords = Object.values(statusMap).reduce(
        (sum, count) => sum + count,
        0,
    )

    const verificationMap = Object.fromEntries(
        verificationBreakdown.map((item) => [item.verificationStatus, item.count]),
    )

    const [
        departmentSummary,
        positionSummary,
        lineSummary,
        shiftSummary,
        needsReviewRecords,
        topLateEmployees,
        employeeTypeSummary,
    ] = await Promise.all([
        aggregateGroupSummary(
            attendanceFilter,
            "departmentId",
            "departmentId",
            attachDepartmentLabels,
        ),
        aggregateGroupSummary(
            attendanceFilter,
            "positionId",
            "positionId",
            attachPositionLabels,
        ),
        aggregateGroupSummary(attendanceFilter, "lineId", "lineId", attachLineLabels),
        aggregateGroupSummary(attendanceFilter, "shiftId", "shiftId", attachShiftLabels),
        getNeedsReviewRecords(attendanceFilter, query.reviewLimit),
        getTopLateEmployees(attendanceFilter, query.topLimit),
        getEmployeeTypeSummary(query),
    ])

    const result = {
        filters: query,
        summary: {
            expectedEmployees,
            processedRecords,
            present: presentTotal,
            onTime: statusMap.PRESENT || 0,
            late: lateTotal,
            earlyLeave: earlyLeaveTotal,
            lateAndEarlyLeave: statusMap.LATE_AND_EARLY_LEAVE || 0,
            missingIn: statusMap.MISSING_IN || 0,
            missingOut: statusMap.MISSING_OUT || 0,
            missingTotal,
            absent: statusMap.ABSENT || 0,
            restDay: statusMap.REST_DAY || 0,
            holiday: statusMap.HOLIDAY || 0,
            needsReview: verificationMap.NEEDS_REVIEW || 0,
            verified: verificationMap.VERIFIED || 0,
            corrected: verificationMap.CORRECTED || 0,
            totalWorkedMinutes: statusResult.totalWorkedMinutes,
            totalLateMinutes: statusResult.totalLateMinutes,
            totalEarlyLeaveMinutes: statusResult.totalEarlyLeaveMinutes,
            presentRate:
                expectedEmployees > 0
                    ? Math.round((presentTotal / expectedEmployees) * 10000) / 100
                    : 0,
            absenceRate:
                expectedEmployees > 0
                    ? Math.round(((statusMap.ABSENT || 0) / expectedEmployees) * 10000) / 100
                    : 0,
        },
        statusBreakdown: statusResult.items,
        verificationBreakdown,
        trend,
        departmentSummary,
        positionSummary,
        lineSummary,
        shiftSummary,
        employeeTypeSummary,
        needsReviewRecords,
        topLateEmployees,
        generatedAt: new Date().toISOString(),
    }

    return setCache(cacheKey, result, ATTENDANCE_DASHBOARD_CACHE_TTL_MS)
}
