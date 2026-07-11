import AttendancePolicy from "../models/AttendancePolicy.js"
import { AppError } from "../../../shared/errors/AppError.js"

function normalizePayload(payload) {
    return {
        ...payload,
        code: payload.code.trim().toUpperCase(),
        branchId: payload.branchId || null,
    }
}

export async function listAttendancePolicies({ query }) {
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

    return items.map((item) => ({
        ...item,
        id: item._id.toString(),
        _id: undefined,
    }))
}

export async function createAttendancePolicy({ payload, user }) {
    const policy = await AttendancePolicy.create({
        ...normalizePayload(payload),
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
    })

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
