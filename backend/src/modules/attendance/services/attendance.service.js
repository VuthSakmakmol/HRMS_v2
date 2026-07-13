import mongoose from "mongoose"

import Employee from "../../employee/models/Employee.js"
import Shift from "../../shift/models/Shift.js"
import AttendanceRecord from "../models/AttendanceRecord.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"

export const ATTENDANCE_LIST_CACHE_PREFIX = "attendance:records:list:"
export const HR_DASHBOARD_DATA_CACHE_PREFIX = "hr-dashboard:data:"
const ATTENDANCE_LIST_CACHE_TTL_MS = 15_000

export function invalidateAttendanceCaches() {
    clearCacheByPrefix(ATTENDANCE_LIST_CACHE_PREFIX)
    clearCacheByPrefix(HR_DASHBOARD_DATA_CACHE_PREFIX)
}

function startOfDay(value) {
    const date = new Date(value)
    date.setHours(0, 0, 0, 0)
    return date
}

function endOfDay(value) {
    const date = new Date(value)
    date.setHours(23, 59, 59, 999)
    return date
}

function combineDateAndTime(dateValue, timeValue, addDay = false) {
    const date = startOfDay(dateValue)
    const [hours, minutes] = timeValue.split(":").map(Number)

    date.setHours(hours, minutes, 0, 0)

    if (addDay) {
        date.setDate(date.getDate() + 1)
    }

    return date
}

function minutesBetween(start, end) {
    if (!start || !end) {
        return 0
    }

    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
}

function calculateAttendance({ attendanceDate, firstInAt, lastOutAt, shift }) {
    if (!firstInAt && !lastOutAt) {
        return {
            status: "ABSENT",
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            verificationStatus: "VERIFIED",
        }
    }

    if (!firstInAt) {
        return {
            status: "MISSING_IN",
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            verificationStatus: "NEEDS_REVIEW",
        }
    }

    if (!lastOutAt) {
        return {
            status: "MISSING_OUT",
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            verificationStatus: "NEEDS_REVIEW",
        }
    }

    const scheduledStart = combineDateAndTime(attendanceDate, shift.startTime)
    const scheduledEnd = combineDateAndTime(
        attendanceDate,
        shift.endTime,
        Boolean(shift.isOvernight),
    )

    const allowedStart = new Date(
        scheduledStart.getTime() + shift.graceInMinutes * 60000,
    )
    const allowedEnd = new Date(
        scheduledEnd.getTime() - shift.graceOutMinutes * 60000,
    )

    const lateMinutes =
        firstInAt > allowedStart
            ? minutesBetween(scheduledStart, firstInAt)
            : 0

    const earlyLeaveMinutes =
        lastOutAt < allowedEnd
            ? minutesBetween(lastOutAt, scheduledEnd)
            : 0

    let status = "PRESENT"

    if (lateMinutes > 0 && earlyLeaveMinutes > 0) {
        status = "LATE_AND_EARLY_LEAVE"
    } else if (lateMinutes > 0) {
        status = "LATE"
    } else if (earlyLeaveMinutes > 0) {
        status = "EARLY_LEAVE"
    }

    return {
        status,
        workedMinutes: minutesBetween(firstInAt, lastOutAt),
        lateMinutes,
        earlyLeaveMinutes,
        verificationStatus: "VERIFIED",
    }
}

async function resolveEmployeeAndShift(employeeCode) {
    const employee = await Employee.findOne({
        employeeCode: employeeCode.trim().toUpperCase(),
        recordStatus: "ACTIVE",
    }).lean()

    if (!employee) {
        throw new AppError({
            statusCode: 404,
            code: "ATTENDANCE_EMPLOYEE_NOT_FOUND",
            messageKey: "errors.attendance.employeeNotFound",
        })
    }

    const shift = await Shift.findOne({
        _id: employee.shiftId,
        status: "ACTIVE",
    }).lean()

    if (!shift) {
        throw new AppError({
            statusCode: 422,
            code: "ATTENDANCE_SHIFT_NOT_FOUND",
            messageKey: "errors.attendance.shiftNotFound",
        })
    }

    return {
        employee,
        shift,
    }
}

export async function upsertAttendanceRecord({ payload, user, source = "MANUAL" }) {
    const { employee, shift } = await resolveEmployeeAndShift(
        payload.employeeCode,
    )

    const attendanceDate = startOfDay(payload.attendanceDate)
    const firstInAt = payload.firstInAt ? new Date(payload.firstInAt) : null
    const lastOutAt = payload.lastOutAt ? new Date(payload.lastOutAt) : null

    const calculated = calculateAttendance({
        attendanceDate,
        firstInAt,
        lastOutAt,
        shift,
    })

    const record = await AttendanceRecord.findOneAndUpdate(
        {
            employeeId: employee._id,
            attendanceDate,
        },
        {
            $set: {
                employeeCode: employee.employeeCode,
                companyId: employee.companyId,
                branchId: employee.branchId,
                departmentId: employee.departmentId,
                positionId: employee.positionId,
                lineId: employee.lineId,
                shiftId: employee.shiftId,
                firstInAt,
                lastOutAt,
                note: payload.note || "",
                source,
                updatedByAccountId: user.accountId,
                ...calculated,
            },
            $setOnInsert: {
                employeeId: employee._id,
                attendanceDate,
                createdByAccountId: user.accountId,
            },
        },
        {
            upsert: true,
            returnDocument: "after",
            runValidators: true,
        },
    )

    invalidateAttendanceCaches()

    return record.toJSON()
}

export async function updateAttendanceRecord({ attendanceId, payload, user }) {
    if (!mongoose.isValidObjectId(attendanceId)) {
        throw new AppError({
            statusCode: 422,
            code: "VALIDATION_FAILED",
            messageKey: "errors.validationFailed",
        })
    }

    const existing = await AttendanceRecord.findById(attendanceId)

    if (!existing) {
        throw new AppError({
            statusCode: 404,
            code: "ATTENDANCE_RECORD_NOT_FOUND",
            messageKey: "errors.attendance.recordNotFound",
        })
    }

    return upsertAttendanceRecord({
        payload,
        user,
        source: existing.source,
    })
}

export async function listAttendanceRecords({ query }) {
    const cacheKey = `${ATTENDANCE_LIST_CACHE_PREFIX}${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const filter = {
        attendanceDate: {
            $gte: startOfDay(query.dateFrom),
            $lte: endOfDay(query.dateTo),
        },
    }

    for (const field of [
        "companyId",
        "branchId",
        "departmentId",
        "positionId",
        "lineId",
    ]) {
        if (query[field]) {
            filter[field] = query[field]
        }
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    if (query.search) {
        const employees = await Employee.find({
            $or: [
                { employeeCode: { $regex: query.search, $options: "i" } },
                { displayName: { $regex: query.search, $options: "i" } },
                { englishFirstName: { $regex: query.search, $options: "i" } },
                { englishLastName: { $regex: query.search, $options: "i" } },
            ],
        })
            .select("_id")
            .lean()

        filter.employeeId = {
            $in: employees.map((employee) => employee._id),
        }
    }

    const skip = (query.page - 1) * query.limit

    const [items, total] = await Promise.all([
        AttendanceRecord.find(filter)
            .populate("employeeId", "employeeCode displayName englishFirstName englishLastName")
            .populate("departmentId", "code name")
            .populate("positionId", "code name")
            .populate("lineId", "code name")
            .populate("shiftId", "code name startTime endTime")
            .sort({ attendanceDate: -1, employeeCode: 1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        AttendanceRecord.countDocuments(filter),
    ])

    const result = {
        items: items.map((item) => ({
            ...item,
            id: item._id.toString(),
            _id: undefined,
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    }

    return setCache(cacheKey, result, ATTENDANCE_LIST_CACHE_TTL_MS)
}
