<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { apiClient } from "@/shared/services/apiClient.js"
import { useAuthStore } from "@/app/stores/auth.store.js"
import InternalCalendarDatePicker from "@/modules/calendar/components/InternalCalendarDatePicker.vue"
import { useEmployeeStore } from "../stores/employee.store.js"

const toast = useToast()
const authStore = useAuthStore()
const employeeStore = useEmployeeStore()

const PERMISSIONS = Object.freeze({
    CREATE: "EMPLOYEE.PROFILE.CREATE",
    UPDATE: "EMPLOYEE.PROFILE.UPDATE",
    ARCHIVE: "EMPLOYEE.PROFILE.ARCHIVE",
    IMPORT: "EMPLOYEE.PROFILE.IMPORT",
    EXPORT: "EMPLOYEE.PROFILE.EXPORT",
})

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))
const canImport = computed(() => authStore.hasPermission(PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(PERMISSIONS.EXPORT))

const options = reactive({
    companies: [], branches: [], departments: [], positions: [], lines: [], shifts: [], employeeTypes: [], recruitmentChannels: [],
    provinces: [], districts: [], communes: [], villages: [],
})

const loadingOptions = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedEmployeeId = ref(null)
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)
const formErrors = ref({})

const filters = reactive({
    search: "",
    employmentStatus: "ALL",
    recordStatus: "ACTIVE",
    companyId: "",
    branchId: "",
    departmentId: "",
    positionId: "",
    lineId: "",
    shiftId: "",
})

const form = reactive(createEmptyForm())

const employmentStatusOptions = [
    { label: "All employment statuses", value: "ALL" },
    { label: "Working", value: "WORKING" },
    { label: "Resigned", value: "RESIGNED" },
    { label: "Terminated", value: "TERMINATED" },
    { label: "Abandoned", value: "ABANDONED" },
    { label: "Passed Away", value: "PASSED_AWAY" },
    { label: "Retired", value: "RETIRED" },
]

const recordStatusOptions = [
    { label: "Active records", value: "ACTIVE" },
    { label: "Inactive records", value: "INACTIVE" },
    { label: "Archived records", value: "ARCHIVED" },
    { label: "All records", value: "ALL" },
]

const genderOptions = [
    { label: "Male", value: "MALE" },
    { label: "Female", value: "FEMALE" },
    { label: "Other", value: "OTHER" },
    { label: "Unknown", value: "UNKNOWN" },
]

const maritalOptions = [
    { label: "Single", value: "SINGLE" },
    { label: "Married", value: "MARRIED" },
    { label: "Divorced", value: "DIVORCED" },
    { label: "Widowed", value: "WIDOWED" },
    { label: "Unknown", value: "UNKNOWN" },
]

const statusEditOptions = employmentStatusOptions.filter((item) => item.value !== "ALL")
const recordEditOptions = recordStatusOptions.filter((item) => item.value !== "ALL" && item.value !== "ARCHIVED")

const dialogTitle = computed(() => dialogMode.value === "create" ? "Create Employee" : "Edit Employee")

function createEmptyForm() {
    return {
        employeeCode: "", profileImageUrl: "", createAccount: true, defaultRoleId: null,
        khmerFirstName: "", khmerLastName: "", englishFirstName: "", englishLastName: "", displayName: "",
        gender: "UNKNOWN", dateOfBirth: "",
        email: "", phoneNumber: "", agentPhoneNumber: "", agentPerson: "", note: "",
        maritalStatus: "UNKNOWN", spouseName: "", spouseContactNumber: "",
        education: "", religion: "", nationality: "Khmer",
        birthAddress: { provinceId: "", districtId: "", communeId: "", villageId: "", detail: "" },
        livingAddress: { provinceId: "", districtId: "", communeId: "", villageId: "", detail: "" },
        companyId: "", branchId: "", departmentId: "", positionId: "", lineId: "", shiftId: "",
        joinDate: "", employmentStatus: "WORKING", resignDate: "", resignReason: "", remark: "",
        documents: { idCardNo: "", idCardExpireDate: "", nssfNo: "", passportNo: "", passportExpireDate: "", visaExpireDate: "", medicalCheckNo: "", medicalCheckDate: "", workingBookNo: "" },
        sourceOfHiring: "", recruitmentChannelId: "", introducerEmployeeId: "", employeeTypeId: "",
        machineSkills: { singleNeedle: 0, overlock: 0, coverstitch: 0, totalMachines: 0 },
        recordStatus: "ACTIVE",
    }
}

function assignForm(source = createEmptyForm()) {
    const next = createEmptyForm()
    Object.assign(next, source)
    next.birthAddress = { ...createEmptyForm().birthAddress, ...(source.birthAddress || {}) }
    next.livingAddress = { ...createEmptyForm().livingAddress, ...(source.livingAddress || {}) }
    next.documents = { ...createEmptyForm().documents, ...(source.documents || {}) }
    next.machineSkills = { ...createEmptyForm().machineSkills, ...(source.machineSkills || {}) }
    Object.assign(form, next)
}

function optionLabel(item, primary = "name") {
    const code = item.code || item.employeeCode || ""
    const label = item[primary] || item.title || item.displayName || item.name || code
    return code ? `${code} - ${label}` : label
}

function mapOptions(items, primary) {
    return (items || []).map((item) => ({ label: optionLabel(item, primary), value: item.id }))
}

const companyOptions = computed(() => mapOptions(options.companies, "displayName"))
const branchOptions = computed(() => mapOptions(options.branches.filter((item) => !form.companyId || item.companyId === form.companyId), "name"))
const departmentOptions = computed(() => mapOptions(options.departments.filter((item) => (!form.companyId || item.companyId === form.companyId) && (!form.branchId || item.branchId === form.branchId)), "name"))
const positionOptions = computed(() => mapOptions(options.positions.filter((item) => (!form.departmentId || item.departmentId === form.departmentId)), "title"))
const lineOptions = computed(() => mapOptions(options.lines.filter((item) => (!form.departmentId || item.departmentId === form.departmentId)), "name"))
const shiftOptions = computed(() => mapOptions(options.shifts.filter((item) => (!form.branchId || item.branchId === form.branchId)), "name"))
const employeeTypeOptions = computed(() => mapOptions(options.employeeTypes, "name"))
const recruitmentChannelOptions = computed(() =>
    mapOptions(
        options.recruitmentChannels.filter((item) => {
            if (item.companyId && form.companyId && item.companyId !== form.companyId) {
                return false
            }

            if (item.branchId && form.branchId && item.branchId !== form.branchId) {
                return false
            }

            return true
        }),
        "name",
    ),
)
const provinceOptions = computed(() => mapOptions(options.provinces, "name"))
const districtOptions = computed(() => mapOptions(options.districts, "name"))
const communeOptions = computed(() => mapOptions(options.communes, "name"))
const villageOptions = computed(() => mapOptions(options.villages, "name"))

function formatDate(value) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toISOString().slice(0, 10)
}

function toDateOrNull(value) {
    return value || null
}

function buildPayload() {
    return {
        ...form,
        dateOfBirth: toDateOrNull(form.dateOfBirth),
        joinDate: toDateOrNull(form.joinDate),
        resignDate: toDateOrNull(form.resignDate),
        documents: {
            ...form.documents,
            idCardExpireDate: toDateOrNull(form.documents.idCardExpireDate),
            passportExpireDate: toDateOrNull(form.documents.passportExpireDate),
            visaExpireDate: toDateOrNull(form.documents.visaExpireDate),
            medicalCheckDate: toDateOrNull(form.documents.medicalCheckDate),
        },
        introducerEmployeeId: form.introducerEmployeeId || null,
        employeeTypeId: form.employeeTypeId || null,
        recruitmentChannelId: form.recruitmentChannelId || null,
    }
}

function buildUpdatePayload() {
    const payload = buildPayload()
    delete payload.companyId
    delete payload.branchId
    delete payload.createAccount
    delete payload.defaultRoleId
    return payload
}

function getErrorMessage(error) {
    return error?.response?.data?.error?.messageKey || error?.message || "Something went wrong."
}

function applyBackendFieldErrors(error) {
    formErrors.value = error?.response?.data?.error?.fields || {}
}

function fieldError(field) {
    const value = formErrors.value[field]
    return Array.isArray(value) ? value[0] : ""
}

function normalizeCode() {
    form.employeeCode = form.employeeCode.toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_-]/g, "")
}

function statusSeverity(status) {
    if (status === "WORKING" || status === "ACTIVE") return "success"
    if (status === "RESIGNED" || status === "RETIRED" || status === "INACTIVE") return "warn"
    if (status === "TERMINATED" || status === "ABANDONED" || status === "PASSED_AWAY" || status === "ARCHIVED") return "danger"
    return "secondary"
}

function cleanLookupParams(params = {}) {
    const clean = {}

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") {
            continue
        }

        clean[key] = value
    }

    return clean
}

async function fetchListPage(endpoint, params = {}) {
    const response = await apiClient.get(endpoint, {
        params: cleanLookupParams(params),
    })

    return response.data.data || {
        items: [],
        pagination: {
            page: params.page || 1,
            limit: params.limit || 100,
            total: 0,
            totalPages: 1,
        },
    }
}

async function fetchList(endpoint, params = {}) {
    const items = []
    const limit = 100
    let page = 1
    let totalPages = 1

    do {
        const data = await fetchListPage(endpoint, {
            page,
            limit,
            status: "ACTIVE",
            ...params,
        })

        const pageItems = data.items || []
        const pagination = data.pagination || {}

        items.push(...pageItems)

        totalPages = Number(pagination.totalPages || 1)
        page += 1
    } while (page <= totalPages)

    return items
}

async function fetchOptionalList(endpoints, params = {}) {
    for (const endpoint of endpoints) {
        try {
            return await fetchList(endpoint, params)
        } catch (error) {
            if (![404, 422].includes(error?.response?.status)) {
                throw error
            }
        }
    }

    return []
}

async function loadOptions() {
    loadingOptions.value = true
    try {
        const [companies, branches, departments, positions, lines, shifts, employeeTypes, recruitmentChannels, provinces, districts, communes, villages] = await Promise.all([
            fetchList("/organization/companies"),
            fetchList("/organization/branches"),
            fetchList("/organization/departments"),
            fetchList("/organization/positions"),
            fetchList("/organization/lines"),
            fetchList("/organization/shifts"),
            fetchOptionalList([
                "/organization/employee-types",
                "/employee-types",
                "/setup/employee-types",
            ]),
            fetchOptionalList([
                "/organization/recruitment-channels",
                "/recruitment-channels",
                "/setup/recruitment-channels",
            ]),
            fetchList("/organization/locations/provinces"),
            fetchList("/organization/locations/districts"),
            fetchList("/organization/locations/communes"),
            fetchList("/organization/locations/villages"),
        ])
        Object.assign(options, { companies, branches, departments, positions, lines, shifts, employeeTypes, recruitmentChannels, provinces, districts, communes, villages })
    } catch (error) {
        toast.add({ severity: "warn", summary: "Some dropdowns failed", detail: getErrorMessage(error), life: 5000 })
    } finally {
        loadingOptions.value = false
    }
}

async function loadEmployees(params = {}) {
    try { await employeeStore.loadEmployees(params) }
    catch (error) { toast.add({ severity: "error", summary: "Unable to load employees", detail: getErrorMessage(error), life: 5000 }) }
}

function applyFilters() {
    loadEmployees({ page: 1, ...filters })
}

function clearFilters() {
    Object.assign(filters, { search: "", employmentStatus: "ALL", recordStatus: "ACTIVE", companyId: "", branchId: "", departmentId: "", positionId: "", lineId: "", shiftId: "" })
    applyFilters()
}

function onPage(event) {
    loadEmployees({ page: event.page + 1, limit: event.rows })
}

async function openCreateDialog() {
    formErrors.value = {}
    dialogMode.value = "create"
    selectedEmployeeId.value = null
    assignForm(createEmptyForm())
    dialogVisible.value = true
}

async function openEditDialog(employee) {
    formErrors.value = {}
    dialogMode.value = "edit"
    selectedEmployeeId.value = employee.id
    assignForm({
        ...employee,
        dateOfBirth: formatDate(employee.dateOfBirth),
        joinDate: formatDate(employee.joinDate),
        resignDate: formatDate(employee.resignDate),
        documents: {
            ...employee.documents,
            idCardExpireDate: formatDate(employee.documents?.idCardExpireDate),
            passportExpireDate: formatDate(employee.documents?.passportExpireDate),
            visaExpireDate: formatDate(employee.documents?.visaExpireDate),
            medicalCheckDate: formatDate(employee.documents?.medicalCheckDate),
        },
    })
    await previewApproval()
    dialogVisible.value = true
}

async function saveEmployee() {
    formErrors.value = {}
    try {
        if (dialogMode.value === "create") await employeeStore.createEmployee(buildPayload())
        else await employeeStore.updateEmployee(selectedEmployeeId.value, buildUpdatePayload())
        toast.add({ severity: "success", summary: "Employee saved", life: 3000 })
        dialogVisible.value = false
        await loadEmployees()
    } catch (error) {
        applyBackendFieldErrors(error)
        toast.add({ severity: "error", summary: "Unable to save employee", detail: getErrorMessage(error), life: 6000 })
    }
}

function openArchiveDialog(employee) {
    archiveCandidate.value = employee
    archiveDialogVisible.value = true
}

async function confirmArchive() {
    try {
        await employeeStore.archiveEmployee(archiveCandidate.value.id)
        archiveDialogVisible.value = false
        archiveCandidate.value = null
        toast.add({ severity: "success", summary: "Employee archived", life: 3000 })
        await loadEmployees()
    } catch (error) {
        toast.add({ severity: "error", summary: "Unable to archive", detail: getErrorMessage(error), life: 5000 })
    }
}

function resetRecruitmentChannelIfInvalid() {
    const selected = options.recruitmentChannels.find((item) => item.id === form.recruitmentChannelId)

    if (!selected) return

    if (selected.companyId && form.companyId && selected.companyId !== form.companyId) {
        form.recruitmentChannelId = ""
        return
    }

    if (selected.branchId && form.branchId && selected.branchId !== form.branchId) {
        form.recruitmentChannelId = ""
    }
}

async function previewApproval() {
    resetRecruitmentChannelIfInvalid()
    if (!form.companyId || !form.branchId) return
    try {
        await employeeStore.loadApprovalPreview({ moduleKey: "EMPLOYEE_CHANGE", companyId: form.companyId, branchId: form.branchId, departmentId: form.departmentId || undefined, positionId: form.positionId || undefined, lineId: form.lineId || undefined })
    } catch (error) {
        toast.add({ severity: "warn", summary: "Approval preview unavailable", detail: getErrorMessage(error), life: 4000 })
    }
}

async function downloadSample() {
    try { await employeeStore.downloadImportTemplate() }
    catch (error) { toast.add({ severity: "error", summary: "Unable to download sample", detail: getErrorMessage(error), life: 5000 }) }
}

async function exportExcel() {
    try { await employeeStore.exportEmployees() }
    catch (error) { toast.add({ severity: "error", summary: "Unable to export", detail: getErrorMessage(error), life: 5000 }) }
}

function onImportFileChange(event) {
    selectedImportFile.value = event.target.files?.[0] || null
}

async function submitImport() {
    if (!selectedImportFile.value) return toast.add({ severity: "warn", summary: "Please select an Excel file", life: 3000 })
    try {
        await employeeStore.importEmployees(selectedImportFile.value, { companyId: filters.companyId || undefined, branchId: filters.branchId || undefined })
        importDialogVisible.value = false
        importResultDialogVisible.value = true
        await loadEmployees()
    } catch (error) {
        toast.add({ severity: "error", summary: "Import failed", detail: getErrorMessage(error), life: 6000 })
    }
}

onMounted(async () => {
    await Promise.all([loadOptions(), loadEmployees()])
})
</script>

<template>
    <section class="employee-page">
        <div class="employee-header">
            <div>
                <span class="eyebrow">Employee Master</span>
                <h2>Employees</h2>
                <p>Manage employee profile, organization assignment, addresses, documents, machine skills, and approval chain preview.</p>
            </div>
            <div class="header-actions">
                <Button v-if="canImport" outlined severity="secondary" icon="pi pi-download" label="Download Sample" :loading="employeeStore.downloadingTemplate" @click="downloadSample" />
                <Button v-if="canImport" outlined severity="secondary" icon="pi pi-upload" label="Import Excel" @click="importDialogVisible = true" />
                <Button v-if="canExport" outlined severity="secondary" icon="pi pi-file-export" label="Export Excel" :loading="employeeStore.exporting" @click="exportExcel" />
                <Button v-if="canCreate" icon="pi pi-plus" label="New Employee" @click="openCreateDialog" />
            </div>
        </div>

        <Card>
            <template #content>
                <div class="toolbar">
                    <span class="search"><i class="pi pi-search" /><InputText v-model="filters.search" placeholder="Search employee ID, name, phone..." @keyup.enter="applyFilters" /></span>
                    <Select v-model="filters.companyId" :options="[{ label: 'All Companies', value: '' }, ...companyOptions]" option-label="label" option-value="value" placeholder="Company" @change="applyFilters" />
                    <Select v-model="filters.branchId" :options="[{ label: 'All Branches', value: '' }, ...mapOptions(options.branches, 'name')]" option-label="label" option-value="value" placeholder="Branch" @change="applyFilters" />
                    <Select v-model="filters.employmentStatus" :options="employmentStatusOptions" option-label="label" option-value="value" @change="applyFilters" />
                    <Select v-model="filters.recordStatus" :options="recordStatusOptions" option-label="label" option-value="value" @change="applyFilters" />
                    <Button icon="pi pi-filter" label="Apply" @click="applyFilters" />
                    <Button outlined severity="secondary" icon="pi pi-times" label="Clear" @click="clearFilters" />
                </div>

                <div class="table-wrap">
                    <DataTable lazy paginator striped-rows size="small" scrollable scroll-height="flex" data-key="id"
                        :value="employeeStore.items" :loading="employeeStore.loading" :rows="employeeStore.pagination.limit"
                        :first="(employeeStore.pagination.page - 1) * employeeStore.pagination.limit"
                        :total-records="employeeStore.pagination.total" :rows-per-page-options="[10, 20, 50, 100]" @page="onPage">
                        <Column field="employeeCode" header="Employee ID" frozen style="min-width: 9rem"><template #body="{ data }"><strong class="code">{{ data.employeeCode }}</strong></template></Column>
                        <Column header="Name" style="min-width: 16rem"><template #body="{ data }"><div class="cell"><strong>{{ data.displayName }}</strong><span>{{ data.khmerFirstName }} {{ data.khmerLastName }}</span></div></template></Column>
                        <Column header="Department" style="min-width: 12rem"><template #body="{ data }">{{ data.department?.name || '-' }}</template></Column>
                        <Column header="Position" style="min-width: 12rem"><template #body="{ data }">{{ data.position?.title || data.position?.name || '-' }}</template></Column>
                        <Column header="Line" style="min-width: 10rem"><template #body="{ data }">{{ data.line?.name || '-' }}</template></Column>
                        <Column header="Shift" style="min-width: 10rem"><template #body="{ data }">{{ data.shift?.name || '-' }}</template></Column>
                        <Column header="Employee Type" style="min-width: 11rem"><template #body="{ data }">{{ data.employeeType?.name || data.employeeType?.code || '-' }}</template></Column>
                        <Column header="Recruitment Channel" style="min-width: 13rem"><template #body="{ data }">{{ data.recruitmentChannel?.name || data.sourceOfHiring || '-' }}</template></Column>
                        <Column header="Phone" style="min-width: 10rem"><template #body="{ data }">{{ data.phoneNumber || '-' }}</template></Column>
                        <Column header="Employment" style="min-width: 10rem"><template #body="{ data }"><Tag :severity="statusSeverity(data.employmentStatus)" :value="data.employmentStatus" /></template></Column>
                        <Column header="Record" style="min-width: 9rem"><template #body="{ data }"><Tag :severity="statusSeverity(data.recordStatus)" :value="data.recordStatus" /></template></Column>
                        <Column header="Actions" frozen align-frozen="right" style="min-width: 9rem"><template #body="{ data }"><div class="actions"><Button v-if="canUpdate && data.recordStatus !== 'ARCHIVED'" text rounded icon="pi pi-pencil" @click="openEditDialog(data)" /><Button v-if="canArchive && data.recordStatus !== 'ARCHIVED'" text rounded severity="danger" icon="pi pi-archive" @click="openArchiveDialog(data)" /></div></template></Column>
                    </DataTable>
                </div>
            </template>
        </Card>

        <Dialog v-model:visible="dialogVisible" modal :header="dialogTitle" class="employee-dialog" :draggable="false">
            <div class="employee-form">
                <div class="form-section"><h3>1. Identity</h3><div class="grid">
                    <label><span>Employee ID</span><InputText v-model="form.employeeCode" :disabled="dialogMode === 'edit'" @input="normalizeCode" /><small>{{ fieldError('employeeCode') }}</small></label>
                    <label v-if="dialogMode === 'create'" class="account-option">
                        <span>Create Login Account</span>
                        <span class="checkbox-line"><input v-model="form.createAccount" type="checkbox" /> Yes, create account</span>
                        <small>Login ID = Employee ID. Initial password = Employee ID + phone number.</small>
                    </label>
                    <label><span>English First Name</span><InputText v-model="form.englishFirstName" /></label>
                    <label><span>English Last Name</span><InputText v-model="form.englishLastName" /></label>
                    <label><span>Khmer First Name</span><InputText v-model="form.khmerFirstName" /></label>
                    <label><span>Khmer Last Name</span><InputText v-model="form.khmerLastName" /></label>
                    <label><span>Display Name</span><InputText v-model="form.displayName" /></label>
                    <label><span>Gender</span><Select v-model="form.gender" :options="genderOptions" option-label="label" option-value="value" /></label>
                    <label><span>Date of Birth</span><InternalCalendarDatePicker v-model="form.dateOfBirth" :show-status="false" compact /></label>
                    <label><span>Profile Image URL</span><InputText v-model="form.profileImageUrl" /></label>
                </div></div>

                <div class="form-section"><h3>2. Organization Assignment</h3><div class="grid">
                    <label><span>Company</span><Select v-model="form.companyId" :disabled="dialogMode === 'edit'" :loading="loadingOptions" :options="companyOptions" option-label="label" option-value="value" @change="previewApproval" /></label>
                    <label><span>Branch</span><Select v-model="form.branchId" :disabled="dialogMode === 'edit'" :options="branchOptions" option-label="label" option-value="value" @change="previewApproval" /></label>
                    <label><span>Department</span><Select v-model="form.departmentId" :options="departmentOptions" option-label="label" option-value="value" @change="previewApproval" /></label>
                    <label><span>Position</span><Select v-model="form.positionId" :options="positionOptions" option-label="label" option-value="value" @change="previewApproval" /></label>
                    <label><span>Line</span><Select v-model="form.lineId" :options="lineOptions" option-label="label" option-value="value" @change="previewApproval" /></label>
                    <label><span>Shift</span><Select v-model="form.shiftId" :options="shiftOptions" option-label="label" option-value="value" /></label>
                    <label><span>Join Date</span><InternalCalendarDatePicker v-model="form.joinDate" :company-id="form.companyId" :branch-id="form.branchId" compact /><small>{{ fieldError('joinDate') }}</small></label>
                    <label><span>Employment Status</span><Select v-model="form.employmentStatus" :options="statusEditOptions" option-label="label" option-value="value" /></label>
                    <label><span>Record Status</span><Select v-model="form.recordStatus" :options="recordEditOptions" option-label="label" option-value="value" /></label>
                </div></div>

                <div class="form-section"><h3>3. Approval Chain Preview</h3>
                    <div v-if="employeeStore.approvalLoading" class="muted">Loading approval chain...</div>
                    <div v-else-if="employeeStore.approvalPreview?.steps?.length" class="approval-list">
                        <div v-for="step in employeeStore.approvalPreview.steps" :key="step.level" class="approval-step">
                            <strong>Level {{ step.level }}: {{ step.approverType }}</strong>
                            <span>{{ step.resolvedApprover ? `${step.resolvedApprover.employeeCode} - ${step.resolvedApprover.displayName}` : 'No approver resolved' }}</span>
                        </div>
                    </div>
                    <div v-else class="muted">No approval policy matched yet. Employee can still be saved, but create approval policy before using request workflows.</div>
                </div>

                <div class="form-section"><h3>4. Contact, Family & Background</h3><div class="grid">
                    <label><span>Email</span><InputText v-model="form.email" /></label>
                    <label><span>Phone Number</span><InputText v-model="form.phoneNumber" /><small>{{ fieldError('phoneNumber') }}</small></label>
                    <label><span>Agent Person</span><InputText v-model="form.agentPerson" /></label>
                    <label><span>Agent Phone</span><InputText v-model="form.agentPhoneNumber" /></label>
                    <label><span>Marital Status</span><Select v-model="form.maritalStatus" :options="maritalOptions" option-label="label" option-value="value" /></label>
                    <label><span>Spouse Name</span><InputText v-model="form.spouseName" /></label>
                    <label><span>Spouse Contact</span><InputText v-model="form.spouseContactNumber" /></label>
                    <label><span>Education</span><InputText v-model="form.education" /></label>
                    <label><span>Religion</span><InputText v-model="form.religion" /></label>
                    <label><span>Nationality</span><InputText v-model="form.nationality" /></label>
                    <label class="wide"><span>Note</span><Textarea v-model="form.note" rows="2" auto-resize /></label>
                </div></div>

                <div class="form-section"><h3>5. Addresses</h3><div class="grid">
                    <label><span>Birth Province</span><Select v-model="form.birthAddress.provinceId" :options="provinceOptions" option-label="label" option-value="value" /></label>
                    <label><span>Birth District</span><Select v-model="form.birthAddress.districtId" :options="districtOptions" option-label="label" option-value="value" /></label>
                    <label><span>Birth Commune</span><Select v-model="form.birthAddress.communeId" :options="communeOptions" option-label="label" option-value="value" /></label>
                    <label><span>Birth Village</span><Select v-model="form.birthAddress.villageId" :options="villageOptions" option-label="label" option-value="value" /></label>
                    <label><span>Living Province</span><Select v-model="form.livingAddress.provinceId" :options="provinceOptions" option-label="label" option-value="value" /></label>
                    <label><span>Living District</span><Select v-model="form.livingAddress.districtId" :options="districtOptions" option-label="label" option-value="value" /></label>
                    <label><span>Living Commune</span><Select v-model="form.livingAddress.communeId" :options="communeOptions" option-label="label" option-value="value" /></label>
                    <label><span>Living Village</span><Select v-model="form.livingAddress.villageId" :options="villageOptions" option-label="label" option-value="value" /></label>
                </div></div>

                <div class="form-section"><h3>6. Employment Exit, Documents, Hiring & Skills</h3><div class="grid">
                    <label><span>Resign Date</span><InternalCalendarDatePicker v-model="form.resignDate" :company-id="form.companyId" :branch-id="form.branchId" compact /></label>
                    <label><span>Resign Reason</span><InputText v-model="form.resignReason" /></label>
                    <label><span>Recruitment Channel</span><Select v-model="form.recruitmentChannelId" :options="recruitmentChannelOptions" option-label="label" option-value="value" placeholder="Select recruitment channel" show-clear /></label>
                    <label><span>Employee Type</span><Select v-model="form.employeeTypeId" :options="employeeTypeOptions" option-label="label" option-value="value" placeholder="Select employee type" show-clear /></label>
                    <label><span>ID Card</span><InputText v-model="form.documents.idCardNo" /></label>
                    <label><span>ID Expire</span><InternalCalendarDatePicker v-model="form.documents.idCardExpireDate" :show-status="false" compact /></label>
                    <label><span>NSSF</span><InputText v-model="form.documents.nssfNo" /></label>
                    <label><span>Passport</span><InputText v-model="form.documents.passportNo" /></label>
                    <label><span>Passport Expire</span><InternalCalendarDatePicker v-model="form.documents.passportExpireDate" :show-status="false" compact /></label>
                    <label><span>Visa Expire</span><InternalCalendarDatePicker v-model="form.documents.visaExpireDate" :show-status="false" compact /></label>
                    <label><span>Medical Check</span><InputText v-model="form.documents.medicalCheckNo" /></label>
                    <label><span>Medical Check Date</span><InternalCalendarDatePicker v-model="form.documents.medicalCheckDate" :company-id="form.companyId" :branch-id="form.branchId" compact /></label>
                    <label><span>Working Book</span><InputText v-model="form.documents.workingBookNo" /></label>
                    <label><span>Single Needle</span><InputNumber v-model="form.machineSkills.singleNeedle" :min="0" :max="999" /></label>
                    <label><span>Overlock</span><InputNumber v-model="form.machineSkills.overlock" :min="0" :max="999" /></label>
                    <label><span>Coverstitch</span><InputNumber v-model="form.machineSkills.coverstitch" :min="0" :max="999" /></label>
                    <label><span>Total Machines</span><InputNumber v-model="form.machineSkills.totalMachines" :min="0" :max="999" /></label>
                    <label class="wide"><span>Remark</span><Textarea v-model="form.remark" rows="2" auto-resize /></label>
                </div></div>
            </div>

            <template #footer><Button outlined severity="secondary" label="Cancel" @click="dialogVisible = false" /><Button icon="pi pi-save" label="Save" :loading="employeeStore.saving" @click="saveEmployee" /></template>
        </Dialog>

        <Dialog v-model:visible="archiveDialogVisible" modal header="Archive Employee" :draggable="false" class="small-dialog">
            <p>Archive {{ archiveCandidate?.displayName || archiveCandidate?.employeeCode }}? The record will stay for history.</p>
            <template #footer><Button outlined severity="secondary" label="Cancel" @click="archiveDialogVisible = false" /><Button severity="danger" icon="pi pi-archive" label="Archive" :loading="employeeStore.archiving" @click="confirmArchive" /></template>
        </Dialog>

        <Dialog v-model:visible="importDialogVisible" modal header="Import Employees" :draggable="false" class="small-dialog" :closable="!employeeStore.importing">
            <div class="import-box"><p>Upload completed Employee Excel template. If your file has no company/branch columns, choose company and branch filters first before import.</p><p class="muted">Account import rule: createAccount = YES creates login. Login ID = Employee ID. Initial password = Employee ID + phone number.</p><input ref="fileInputRef" type="file" accept=".xlsx" :disabled="employeeStore.importing" @change="onImportFileChange" /><div v-if="selectedImportFile" class="muted">{{ selectedImportFile.name }}</div><div v-if="employeeStore.importing"><ProgressBar :value="employeeStore.importProgress" /><span class="muted">Processing {{ employeeStore.importProgress }}%</span></div></div>
            <template #footer><Button outlined severity="secondary" label="Cancel" :disabled="employeeStore.importing" @click="importDialogVisible = false" /><Button icon="pi pi-upload" label="Import" :loading="employeeStore.importing" @click="submitImport" /></template>
        </Dialog>

        <Dialog v-model:visible="importResultDialogVisible" modal header="Employee Import Result" :draggable="false" class="result-dialog">
            <div v-if="employeeStore.importSummary" class="result-grid"><div><span>Total</span><strong>{{ employeeStore.importSummary.totalRows }}</strong></div><div><span>Created</span><strong>{{ employeeStore.importSummary.created }}</strong></div><div><span>Updated</span><strong>{{ employeeStore.importSummary.updated }}</strong></div><div><span>Skipped</span><strong>{{ employeeStore.importSummary.skipped }}</strong></div><div><span>Accounts Created</span><strong>{{ employeeStore.importSummary.accountsCreated || 0 }}</strong></div><div><span>Accounts Existing</span><strong>{{ employeeStore.importSummary.accountsExisting || 0 }}</strong></div><div><span>Accounts Skipped</span><strong>{{ employeeStore.importSummary.accountsSkipped || 0 }}</strong></div></div>
            <DataTable v-if="employeeStore.importSummary?.errors?.length" size="small" :value="employeeStore.importSummary.errors"><Column field="rowNumber" header="Row" /><Column field="field" header="Field" /><Column field="messageKey" header="Issue" /></DataTable>
            <template #footer><Button label="Close" @click="importResultDialogVisible = false" /></template>
        </Dialog>
    </section>
</template>

<style scoped>
.employee-page { width: 100%; display: grid; gap: 1rem; }
.employee-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
.employee-header h2 { margin: 0; font-size: clamp(1.35rem, 2vw, 1.85rem); }
.employee-header p { margin: 0.45rem 0 0; color: var(--hrms-text-muted); max-width: 58rem; }
.eyebrow { display: inline-block; margin-bottom: 0.35rem; color: var(--hrms-color-primary); font-size: 0.76rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
.header-actions, .toolbar, .actions { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.toolbar { margin-bottom: 0.85rem; }
.search { min-width: 18rem; flex: 1; display: inline-flex; align-items: center; gap: 0.5rem; padding: 0 0.75rem; border: 1px solid var(--hrms-border-color); border-radius: 0.85rem; background: var(--hrms-surface-ground); }
.search :deep(.p-inputtext) { width: 100%; border: 0; background: transparent; box-shadow: none; }
.table-wrap { min-height: 34rem; height: calc(100vh - 18rem); }
.code { color: var(--hrms-color-primary); }
.cell { display: grid; gap: 0.15rem; }
.cell span, .muted { color: var(--hrms-text-muted); font-size: 0.76rem; }
.employee-dialog { width: min(78rem, calc(100vw - 2rem)); }
.employee-form { display: grid; gap: 1rem; max-height: calc(100vh - 14rem); overflow: auto; padding-right: 0.25rem; }
.form-section { border: 1px solid var(--hrms-border-color); border-radius: 1rem; padding: 1rem; background: var(--hrms-surface-ground); }
.form-section h3 { margin: 0 0 0.85rem; font-size: 0.95rem; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.85rem; }
label { display: grid; gap: 0.35rem; }
label > span { color: var(--hrms-text-muted); font-size: 0.76rem; font-weight: 700; }
label small { color: var(--hrms-color-danger); font-size: 0.72rem; }
.wide { grid-column: 1 / -1; }
.approval-list { display: grid; gap: 0.5rem; }
.approval-step { display: grid; gap: 0.15rem; padding: 0.65rem 0.75rem; border: 1px solid var(--hrms-border-color); border-radius: 0.75rem; background: var(--hrms-surface-card); }
.small-dialog { width: min(42rem, calc(100vw - 2rem)); }
.result-dialog { width: min(58rem, calc(100vw - 2rem)); }
.import-box { display: grid; gap: 1rem; }
.result-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.account-option { align-content: start; }
.checkbox-line { display: inline-flex; align-items: center; gap: 0.45rem; min-height: 2.45rem; color: var(--hrms-text-strong); font-size: 0.82rem; font-weight: 700; }
.result-grid div { display: grid; gap: 0.25rem; padding: 0.85rem; border: 1px solid var(--hrms-border-color); border-radius: 0.85rem; background: var(--hrms-surface-ground); }
.result-grid span { color: var(--hrms-text-muted); font-size: 0.76rem; }
.result-grid strong { font-size: 1.35rem; }
:deep(.p-datatable-thead > tr > th), :deep(.p-datatable-tbody > tr > td) { text-align: center; vertical-align: middle; font-size: 0.78rem; }
@media (max-width: 1100px) { .employee-header { flex-direction: column; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) { .search { min-width: 0; width: 100%; } .grid, .result-grid { grid-template-columns: 1fr; } .table-wrap { height: 32rem; } }
</style>
