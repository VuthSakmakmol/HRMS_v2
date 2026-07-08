import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

import { env } from "../../../config/env.js"
import { AppError } from "../../../shared/errors/AppError.js"

import Account from "../models/Account.js"
import Permission from "../models/Permission.js"
import Role from "../models/Role.js"

function normalizeLoginId(value) {
    return String(value || "").trim().toLowerCase()
}

function createAccessToken(account) {
    return jwt.sign(
        {
            accountId: account._id.toString(),
        },
        env.JWT_ACCESS_SECRET,
        {
            expiresIn: env.JWT_ACCESS_EXPIRES_IN || "8h",
            algorithm: "HS256",
        },
    )
}

export async function buildAuthUser(account) {
    const assignments = account.roleAssignments || []

    const roleIds = [
        ...new Set(
            assignments
                .map((assignment) => assignment.roleId?.toString())
                .filter(Boolean),
        ),
    ]

    const roles =
        roleIds.length > 0
            ? await Role.find({
                  _id: { $in: roleIds },
                  isActive: true,
              }).lean()
            : []

    const roleById = new Map(
        roles.map((role) => [role._id.toString(), role]),
    )

    const permissionIds = new Set()

    for (const role of roles) {
        for (const permissionId of role.permissionIds || []) {
            permissionIds.add(permissionId.toString())
        }
    }

    const permissionQuery = account.isRootAdmin
        ? { isActive: true }
        : {
              _id: { $in: [...permissionIds] },
              isActive: true,
          }

    const permissions = await Permission.find(permissionQuery)
        .select("code")
        .lean()

    return {
        accountId: account._id.toString(),
        loginId: account.loginId,
        displayName: account.displayName,
        isRootAdmin: Boolean(account.isRootAdmin),
        roleCodes: roles.map((role) => role.code).sort(),
        effectivePermissionCodes: permissions
            .map((permission) => permission.code)
            .sort(),
        roleAssignments: assignments
            .map((assignment) => {
                const role = roleById.get(assignment.roleId?.toString())

                if (!role) {
                    return null
                }

                return {
                    roleId: assignment.roleId.toString(),
                    roleCode: role.code,
                    roleName: role.name,
                    companyId: assignment.companyId
                        ? assignment.companyId.toString()
                        : null,
                    allBranches: Boolean(assignment.allBranches),
                    branchIds: (assignment.branchIds || []).map((branchId) =>
                        branchId.toString(),
                    ),
                }
            })
            .filter(Boolean),
    }
}

export async function loginWithPassword({ loginId, password }) {
    const account = await Account.findOne({
        loginId: normalizeLoginId(loginId),
    }).select("+passwordHash")

    if (!account || account.status !== "ACTIVE") {
        throw new AppError({
            statusCode: 401,
            code: "AUTH_INVALID_CREDENTIALS",
            messageKey: "errors.authInvalidCredentials",
        })
    }

    const isPasswordCorrect = await bcrypt.compare(
        password,
        account.passwordHash,
    )

    if (!isPasswordCorrect) {
        throw new AppError({
            statusCode: 401,
            code: "AUTH_INVALID_CREDENTIALS",
            messageKey: "errors.authInvalidCredentials",
        })
    }

    account.lastLoginAt = new Date()
    await account.save()

    return {
        accessToken: createAccessToken(account),
        tokenType: "Bearer",
        user: await buildAuthUser(account),
    }
}

export async function getAuthenticatedAccount(tokenPayload) {
    const accountId = tokenPayload?.accountId

    if (!accountId || typeof accountId !== "string") {
        throw new AppError({
            statusCode: 401,
            code: "AUTH_TOKEN_INVALID",
            messageKey: "errors.authTokenInvalid",
        })
    }

    const account = await Account.findById(accountId)

    if (!account || account.status !== "ACTIVE") {
        throw new AppError({
            statusCode: 401,
            code: "AUTH_ACCOUNT_UNAVAILABLE",
            messageKey: "errors.authAccountUnavailable",
        })
    }

    return account
}