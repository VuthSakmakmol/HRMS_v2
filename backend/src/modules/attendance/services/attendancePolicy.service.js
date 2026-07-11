import AttendancePolicy from "../models/AttendancePolicy.js"
import { AppError } from "../../../shared/errors/AppError.js"
import {
    clearCacheByPrefix,
    getCache,
    setCache,
} from "../../../shared/cache/memoryCache.js"

const ATTENDANCE_POLICY_CACHE_PREFIX = "attendance:policies:"
const ATTENDANCE_POLICY_CACHE_TTL_MS = 60_000

function invalidateAttendancePolicyCache() {
    clearCacheByPrefix(ATTENDANCE_POLICY_CACHE_PREFIX)
}

function normalizePayload(payload) {
    return {
        ...payload,
        code: payload.code.trim().toUpperCase(),
        branchId: payload.branchId || null,
    }
}

export async function listAttendancePolicies({ query }) {
    const cacheKey = `${ATTENDANCE_POLICY_CACHE_PREFIX}list:${JSON.stringify(query)}`
    const cached = getCache(cacheKey)

    if (cached) {
        return cached
    }

    const filter = {}

    if (query.companyId) {
        filter.companyId = query.companyId
    }

    if (query.branchId) {
        filter.branchId = query.branchId
    }

    if (query.status !== "ALL") {
        filter.status = query.status
    }

    const items = await AttendancePolicy.find(filter)
        .populate("companyId", "code displayName")
        .populate("branchId", "code name")
        .sort({ companyId: 1, branchId: 1, name: 1 })
        .lean()

    const result = items.map((item) => ({
        ...item,
        id: item._id.toString(),
        _id: undefined,
    }))

    return setCache(cacheKey, result, ATTENDANCE_POLICY_CACHE_TTL_MS)
}

export async function createAttendancePolicy({ payload, user }) {
    const policy = await AttendancePolicy.create({
        ...normalizePayload(payload),
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })

    invalidateAttendancePolicyCache()

    return policy.toJSON()
}

export async function updateAttendancePolicy({ policyId, payload, user }) {
    const policy = await AttendancePolicy.findByIdAndUpdate(
        policyId,
        {
            $set: {
                ...normalizePayload(payload),
                updatedByAccountId: user.accountId,
            },
        },
        {
            returnDocument: "after",
            runValidators: true,
        },
    )

    if (!policy) {
        throw new AppError({
            statusCode: 404,
            code: "ATTENDANCE_POLICY_NOT_FOUND",
            messageKey: "errors.attendance.policyNotFound",
        })
    }

    invalidateAttendancePolicyCache()

    return policy.toJSON()
}

export async function resolveAttendancePolicy({ companyId, branchId }) {
    const branchPolicy = branchId
        ? await AttendancePolicy.findOne({
              companyId,
              branchId,
              status: "ACTIVE",
          })
              .sort({ updatedAt: -1 })
              .lean()
        : null

    if (branchPolicy) {
        return branchPolicy
    }

    return AttendancePolicy.findOne({
        companyId,
        branchId: null,
        status: "ACTIVE",
    })
        .sort({ updatedAt: -1 })
        .lean()
}
