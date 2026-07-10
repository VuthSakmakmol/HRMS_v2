import bcrypt from "bcryptjs";
import { Types } from "mongoose";
import { AppError } from "../../../shared/errors/AppError.js";
import Account from "../models/Account.js";
import Permission from "../models/Permission.js";
import Role from "../models/Role.js";
import Company from "../../organization/models/Company.js";
import Branch from "../../organization/models/Branch.js";

const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const invalid = (code) =>
  new AppError({
    statusCode: 400,
    code,
    messageKey: "errors.validationFailed",
  });
const notFound = (code) =>
  new AppError({ statusCode: 404, code, messageKey: "errors.notFound" });
function ensureId(id) {
  if (!Types.ObjectId.isValid(id)) throw invalid("ACCESS_INVALID_ID");
}
function serialize(doc) {
  if (!doc) return null;
  const value = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  value.id ||= value._id?.toString();
  delete value._id;
  delete value.passwordHash;
  return value;
}
function duplicate(error, code) {
  if (error?.code === 11000)
    throw new AppError({
      statusCode: 409,
      code,
      messageKey: "errors.duplicate",
    });
  throw error;
}
function searchFilter(search, fields) {
  const q = String(search || "").trim();
  if (!q) return {};
  const rx = new RegExp(esc(q), "i");
  return { $or: fields.map((field) => ({ [field]: rx })) };
}
async function validatePermissions(ids) {
  const unique = [...new Set(ids || [])];
  const count = await Permission.countDocuments({
    _id: { $in: unique },
    isActive: true,
  });
  if (count !== unique.length) throw invalid("ACCESS_PERMISSION_INVALID");
}
async function validateAssignments(assignments) {
  const roleIds = [...new Set((assignments || []).map((x) => x.roleId))];
  const roles = await Role.find({
    _id: { $in: roleIds },
    isActive: true,
  }).lean();
  if (roles.length !== roleIds.length) throw invalid("ACCESS_ROLE_INVALID");
  const companyIds = [
    ...new Set((assignments || []).map((x) => x.companyId).filter(Boolean)),
  ];
  if (
    companyIds.length &&
    (await Company.countDocuments({
      _id: { $in: companyIds },
      status: { $ne: "ARCHIVED" },
    })) !== companyIds.length
  )
    throw invalid("ACCESS_COMPANY_INVALID");
  const branchIds = [
    ...new Set((assignments || []).flatMap((x) => x.branchIds || [])),
  ];
  if (
    branchIds.length &&
    (await Branch.countDocuments({
      _id: { $in: branchIds },
      status: { $ne: "ARCHIVED" },
    })) !== branchIds.length
  )
    throw invalid("ACCESS_BRANCH_INVALID");
}

export async function listPermissions() {
  const items = await Permission.find({ isActive: true })
    .sort({ module: 1, action: 1 })
    .lean();
  return { items: items.map(serialize) };
}
export async function listRoleLookup() {
  const items = await Role.find({ isActive: true })
    .select("code name scope companyId isSystem")
    .sort({ name: 1 })
    .lean();
  return { items: items.map(serialize) };
}
export async function listScopeLookup() {
  const [companies, branches] = await Promise.all([
    Company.find({ status: { $ne: "ARCHIVED" } })
      .select("code displayName")
      .sort({ displayName: 1 })
      .lean(),
    Branch.find({ status: { $ne: "ARCHIVED" } })
      .select("code name companyId")
      .sort({ name: 1 })
      .lean(),
  ]);
  return {
    companies: companies.map(serialize),
    branches: branches.map(serialize),
  };
}
export async function listRoles({ query }) {
  const filter = {
    ...searchFilter(query.search, ["code", "name", "description"]),
  };
  if (query.status !== "ALL") filter.isActive = query.status === "ACTIVE";
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Role.find(filter)
      .populate("companyId", "code displayName")
      .populate("permissionIds", "code module action name")
      .sort({ isSystem: -1, name: 1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Role.countDocuments(filter),
  ]);
  return {
    items: items.map(serialize),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}
export async function createRole({ payload, user }) {
  await validatePermissions(payload.permissionIds);
  if (payload.scope === "GLOBAL") payload.companyId = null;
  try {
    return serialize(
      await Role.create({
        ...payload,
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
      }),
    );
  } catch (e) {
    duplicate(e, "ACCESS_ROLE_DUPLICATE");
  }
}
export async function updateRole({ id, payload, user }) {
  ensureId(id);
  const existing = await Role.findById(id);
  if (!existing) throw notFound("ACCESS_ROLE_NOT_FOUND");
  if (
    existing.isSystem &&
    (payload.code || payload.scope || payload.companyId !== undefined)
  )
    throw new AppError({
      statusCode: 409,
      code: "ACCESS_SYSTEM_ROLE_PROTECTED",
      messageKey: "errors.permissionDenied",
    });
  if (payload.permissionIds) await validatePermissions(payload.permissionIds);
  if (payload.scope === "GLOBAL") payload.companyId = null;
  try {
    return serialize(
      await Role.findByIdAndUpdate(
        id,
        { $set: { ...payload, updatedByAccountId: user.accountId } },
        { returnDocument: "after", runValidators: true },
      ),
    );
  } catch (e) {
    duplicate(e, "ACCESS_ROLE_DUPLICATE");
  }
}
export async function deleteRole({ id }) {
  ensureId(id);
  const role = await Role.findById(id);
  if (!role) throw notFound("ACCESS_ROLE_NOT_FOUND");
  if (role.isSystem)
    throw new AppError({
      statusCode: 409,
      code: "ACCESS_SYSTEM_ROLE_PROTECTED",
      messageKey: "errors.permissionDenied",
    });
  const used = await Account.exists({ "roleAssignments.roleId": role._id });
  if (used)
    throw new AppError({
      statusCode: 409,
      code: "ACCESS_ROLE_IN_USE",
      messageKey: "errors.duplicate",
    });
  await role.deleteOne();
}

export async function listAccounts({ query }) {
  const filter = { ...searchFilter(query.search, ["loginId", "displayName"]) };
  if (query.status !== "ALL") filter.status = query.status;
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Account.find(filter)
      .populate("employeeId", "employeeCode firstName lastName")
      .populate("roleAssignments.roleId", "code name")
      .populate("roleAssignments.companyId", "code displayName")
      .populate("roleAssignments.branchIds", "code name")
      .sort({ isRootAdmin: -1, displayName: 1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Account.countDocuments(filter),
  ]);
  return {
    items: items.map(serialize),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}
export async function createAccount({ payload, user }) {
  await validateAssignments(payload.roleAssignments);
  try {
    const passwordHash = await bcrypt.hash(payload.password, 12);
    const { password, ...data } = payload;
    return serialize(
      await Account.create({
        ...data,
        passwordHash,
        createdByAccountId: user.accountId,
        updatedByAccountId: user.accountId,
      }),
    );
  } catch (e) {
    duplicate(e, "ACCESS_ACCOUNT_DUPLICATE");
  }
}
export async function updateAccount({ id, payload, user }) {
  ensureId(id);
  const current = await Account.findById(id);
  if (!current) throw notFound("ACCESS_ACCOUNT_NOT_FOUND");
  if (current.isRootAdmin && !user.isRootAdmin)
    throw new AppError({
      statusCode: 403,
      code: "ACCESS_ROOT_ACCOUNT_PROTECTED",
      messageKey: "errors.permissionDenied",
    });
  if (payload.roleAssignments)
    await validateAssignments(payload.roleAssignments);
  try {
    return serialize(
      await Account.findByIdAndUpdate(
        id,
        { $set: { ...payload, updatedByAccountId: user.accountId } },
        { returnDocument: "after", runValidators: true },
      ),
    );
  } catch (e) {
    duplicate(e, "ACCESS_ACCOUNT_DUPLICATE");
  }
}
export async function resetAccountPassword({ id, password, user }) {
  ensureId(id);
  const account = await Account.findById(id);
  if (!account) throw notFound("ACCESS_ACCOUNT_NOT_FOUND");
  account.passwordHash = await bcrypt.hash(password, 12);
  account.passwordVersion += 1;
  account.updatedByAccountId = user.accountId;
  await account.save();
}
