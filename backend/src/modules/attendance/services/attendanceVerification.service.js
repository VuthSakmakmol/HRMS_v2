import AttendanceRecord from "../models/AttendanceRecord.js"
import AttendanceRawScan from "../models/AttendanceRawScan.js"
import Employee from "../../employee/models/Employee.js"
import Shift from "../../shift/models/Shift.js"
import { resolveCalendarDay } from "../../calendar/services/calendar.service.js"
import { resolveAttendancePolicy } from "./attendancePolicy.service.js"
import { invalidateAttendanceCaches } from "./attendance.service.js"

function dateKey(date) {
    return new Date(date).toISOString().slice(0, 10)
}

function startOfDate(value) {
    return new Date(`${value}T00:00:00.000`)
}

function endOfDate(value) {
    return new Date(`${value}T23:59:59.999`)
}

function addDays(value, amount) {
    const date = startOfDate(value)
    date.setDate(date.getDate() + amount)
    return date
}

function combineDateAndTime(day, time, addOneDay = false) {
    const result = startOfDate(day)
    const [hour, minute] = time.split(":").map(Number)
    result.setHours(hour, minute, 0, 0)

    if (addOneDay) {
        result.setDate(result.getDate() + 1)
    }

    return result
}

function roundMinutes(value, unit, method) {
    if (value <= 0) {
        return 0
    }

    const ratio = value / Math.max(1, unit)

    if (method === "FLOOR") {
        return Math.floor(ratio) * unit
    }

    if (method === "NEAREST") {
        return Math.round(ratio) * unit
    }

    return Math.ceil(ratio) * unit
}

function calculateWorkingResult({ workDate, scans, shift, policy }) {
    if (scans.length === 0) {
        return {
            firstInAt: null,
            lastOutAt: null,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            status: "ABSENT",
            verificationStatus: "VERIFIED",
        }
    }

    const ordered = [...scans].sort(
        (left, right) => new Date(left.scannedAt) - new Date(right.scannedAt),
    )
    const explicitIn = ordered.find((scan) => scan.direction === "IN")
    const explicitOut = [...ordered]
        .reverse()
        .find((scan) => scan.direction === "OUT")

    const firstInAt = explicitIn?.scannedAt || ordered[0]?.scannedAt || null
    const lastOutAt =
        explicitOut?.scannedAt ||
        (ordered.length > 1 ? ordered[ordered.length - 1].scannedAt : null)

    if (!firstInAt) {
        return {
            firstInAt: null,
            lastOutAt,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            status: "MISSING_IN",
            verificationStatus: "NEEDS_REVIEW",
        }
    }

    if (!lastOutAt || new Date(lastOutAt).getTime() === new Date(firstInAt).getTime()) {
        return {
            firstInAt,
            lastOutAt: null,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            status: "MISSING_OUT",
            verificationStatus: "NEEDS_REVIEW",
        }
    }

    const scheduledStart = combineDateAndTime(workDate, shift.startTime)
    const scheduledEnd = combineDateAndTime(
        workDate,
        shift.endTime,
        Boolean(shift.isOvernight),
    )
    const effectiveGraceIn = policy?.graceInMinutes ?? shift.graceInMinutes ?? 0
    const effectiveGraceOut = policy?.graceOutMinutes ?? shift.graceOutMinutes ?? 0
    const lateThreshold = new Date(
        scheduledStart.getTime() + effectiveGraceIn * 60_000,
    )
    const earlyThreshold = new Date(
        scheduledEnd.getTime() - effectiveGraceOut * 60_000,
    )

    const rawLate =
        new Date(firstInAt) > lateThreshold
            ? Math.round((new Date(firstInAt) - scheduledStart) / 60_000)
            : 0
    const rawEarly =
        new Date(lastOutAt) < earlyThreshold
            ? Math.round((scheduledEnd - new Date(lastOutAt)) / 60_000)
            : 0

    const lateMinutes = roundMinutes(
        rawLate,
        policy?.lateRoundUnitMinutes || 1,
        policy?.lateRoundMethod || "CEIL",
    )
    const earlyLeaveMinutes = roundMinutes(
        rawEarly,
        policy?.earlyLeaveRoundUnitMinutes || 1,
        policy?.earlyLeaveRoundMethod || "CEIL",
    )
    const workedMinutes = Math.max(
        0,
        Math.round((new Date(lastOutAt) - new Date(firstInAt)) / 60_000),
    )

    let status = "PRESENT"

    if (lateMinutes > 0 && earlyLeaveMinutes > 0) {
        status = "LATE_AND_EARLY_LEAVE"
    } else if (lateMinutes > 0) {
        status = "LATE"
    } else if (earlyLeaveMinutes > 0) {
        status = "EARLY_LEAVE"
    }

    if (
        policy?.minimumWorkedMinutes > 0 &&
        workedMinutes < policy.minimumWorkedMinutes
    ) {
        status = "PRESENT"
    }

    return {
        firstInAt,
        lastOutAt,
        workedMinutes,
        lateMinutes,
        earlyLeaveMinutes,
        status,
        verificationStatus:
            policy?.minimumWorkedMinutes > 0 &&
            workedMinutes < policy.minimumWorkedMinutes
                ? "NEEDS_REVIEW"
                : "VERIFIED",
    }
}

async function resolveDayType({ workDate, employee, policy, user, calendarCache }) {
    const key = `${dateKey(workDate)}:${employee.companyId}:${employee.branchId}`
    const cached = calendarCache.get(key)

    if (cached) {
        return cached
    }

    const calendarDay = await resolveCalendarDay({
        query: {
            date: dateKey(workDate),
            companyId: employee.companyId?.toString?.() || employee.companyId,
            branchId: employee.branchId?.toString?.() || employee.branchId,
        },
        user,
    })

    let dayType = "WORKING_DAY"

    if (["HOLIDAY", "CLOSED_DAY"].includes(calendarDay.dayType)) {
        dayType = "HOLIDAY"
    } else if (calendarDay.dayType === "WEEKEND" || calendarDay.isWorkingDay === false) {
        dayType = "REST_DAY"
    } else if (policy?.treatSundayAsRestDay && new Date(workDate).getDay() === 0) {
        dayType = "REST_DAY"
    }

    calendarCache.set(key, dayType)

    return dayType
}

function buildEmployeeFilter(payload) {
    const filter = {
        recordStatus: "ACTIVE",
        employmentStatus: "WORKING",
        joinDate: { $lte: endOfDate(payload.dateTo) },
        $or: [
            { resignDate: null },
            { resignDate: { $gte: startOfDate(payload.dateFrom) } },
        ],
    }

    for (const field of [
        "companyId",
        "branchId",
        "departmentId",
        "positionId",
        "lineId",
        "employeeTypeId",
    ]) {
        if (payload[field]) {
            filter[field] = payload[field]
        }
    }

    return filter
}

export async function verifyAttendanceRange({ payload, user }) {
    const employees = await Employee.find(buildEmployeeFilter(payload)).lean()
    const shiftIds = [...new Set(employees.map((employee) => String(employee.shiftId)))]
    const shifts = await Shift.find({ _id: { $in: shiftIds } }).lean()
    const shiftMap = new Map(shifts.map((shift) => [String(shift._id), shift]))

    const scanStart = addDays(payload.dateFrom, -1)
    const scanEnd = endOfDate(dateKey(addDays(payload.dateTo, 1)))
    const employeeCodes = employees.map((employee) => employee.employeeCode)
    const scans = await AttendanceRawScan.find({
        employeeCode: { $in: employeeCodes },
        scannedAt: {
            $gte: scanStart,
            $lte: scanEnd,
        },
    })
        .sort({ scannedAt: 1 })
        .lean()

    const scansByEmployee = new Map()

    for (const scan of scans) {
        const list = scansByEmployee.get(scan.employeeCode) || []
        list.push(scan)
        scansByEmployee.set(scan.employeeCode, list)
    }

    const policyCache = new Map()
    const calendarCache = new Map()
    const operations = []
    const summary = {
        employeeCount: employees.length,
        processedCount: 0,
        presentCount: 0,
        absentCount: 0,
        restDayCount: 0,
        holidayCount: 0,
        reviewCount: 0,
        skippedCount: 0,
    }

    for (
        let cursor = startOfDate(payload.dateFrom);
        cursor <= endOfDate(payload.dateTo);
        cursor = addDays(dateKey(cursor), 1)
    ) {
        const workDate = new Date(cursor)
        const dayStart = startOfDate(dateKey(workDate))
        const dayEnd = endOfDate(dateKey(addDays(dateKey(workDate), 1)))

        for (const employee of employees) {
            if (employee.joinDate && new Date(employee.joinDate) > dayEnd) {
                summary.skippedCount += 1
                continue
            }

            if (employee.resignDate && new Date(employee.resignDate) < dayStart) {
                summary.skippedCount += 1
                continue
            }

            const shift = shiftMap.get(String(employee.shiftId))

            if (!shift) {
                summary.skippedCount += 1
                continue
            }

            const policyKey = `${employee.companyId}:${employee.branchId}`
            let policy = policyCache.get(policyKey)

            if (policy === undefined) {
                policy = await resolveAttendancePolicy({
                    companyId: employee.companyId,
                    branchId: employee.branchId,
                })
                policyCache.set(policyKey, policy || null)
            }

            const dayType = await resolveDayType({
                workDate,
                employee,
                policy,
                user,
                calendarCache,
            })
            const employeeScans = (scansByEmployee.get(employee.employeeCode) || []).filter(
                (scan) => scan.scannedAt >= dayStart && scan.scannedAt <= dayEnd,
            )

            let calculated

            if (dayType === "HOLIDAY") {
                calculated = {
                    firstInAt: employeeScans[0]?.scannedAt || null,
                    lastOutAt:
                        employeeScans.length > 1
                            ? employeeScans[employeeScans.length - 1].scannedAt
                            : null,
                    workedMinutes: 0,
                    lateMinutes: 0,
                    earlyLeaveMinutes: 0,
                    status: "HOLIDAY",
                    verificationStatus: "VERIFIED",
                }
                summary.holidayCount += 1
            } else if (dayType === "REST_DAY") {
                calculated = {
                    firstInAt: employeeScans[0]?.scannedAt || null,
                    lastOutAt:
                        employeeScans.length > 1
                            ? employeeScans[employeeScans.length - 1].scannedAt
                            : null,
                    workedMinutes: 0,
                    lateMinutes: 0,
                    earlyLeaveMinutes: 0,
                    status: "REST_DAY",
                    verificationStatus: "VERIFIED",
                }
                summary.restDayCount += 1
            } else {
                calculated = calculateWorkingResult({
                    workDate,
                    scans: employeeScans,
                    shift,
                    policy,
                })

                if (calculated.status === "ABSENT") {
                    summary.absentCount += 1
                } else if (calculated.verificationStatus === "NEEDS_REVIEW") {
                    summary.reviewCount += 1
                } else {
                    summary.presentCount += 1
                }
            }

            const filter = {
                employeeId: employee._id,
                attendanceDate: dayStart,
            }

            if (!payload.overwriteCorrected) {
                filter.verificationStatus = { $ne: "CORRECTED" }
            }

            operations.push({
                updateOne: {
                    filter,
                    update: {
                        $set: {
                            employeeCode: employee.employeeCode,
                            companyId: employee.companyId,
                            branchId: employee.branchId,
                            departmentId: employee.departmentId,
                            positionId: employee.positionId,
                            lineId: employee.lineId,
                            shiftId: employee.shiftId,
                            attendanceDate: dayStart,
                            source: "MACHINE_SYNC",
                            updatedByAccountId: user.accountId,
                            ...calculated,
                        },
                        $setOnInsert: {
                            employeeId: employee._id,
                            createdByAccountId: user.accountId,
                        },
                    },
                    upsert: true,
                },
            })
            summary.processedCount += 1
        }
    }

    for (let index = 0; index < operations.length; index += 1000) {
        await AttendanceRecord.bulkWrite(operations.slice(index, index + 1000), {
            ordered: false,
        })
    }

    invalidateAttendanceCaches()

    return summary
}
