
<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"
import ProgressBar from "primevue/progressbar"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchDepartmentsLookup } from "@/modules/organization/services/department.api.js"
import { fetchPositionsLookup } from "@/modules/organization/services/position.api.js"
import { fetchLines } from "@/modules/line/services/line.api.js"
import { fetchShifts } from "@/modules/shift/services/shift.api.js"
import { fetchEmployeeTypes } from "@/modules/employeeType/services/employeeType.api.js"

import { useManpowerPlanStore } from "../stores/manpowerPlan.store.js"

const toast = useToast()
const { t } = useI18n()
const authStore = useAuthStore()
const manpowerPlanStore = useManpowerPlanStore()

const PERMISSIONS = Object.freeze({
    CREATE: "REPORT.MANPOWER_PLAN.CREATE",
    UPDATE: "REPORT.MANPOWER_PLAN.UPDATE",
    ARCHIVE: "REPORT.MANPOWER_PLAN.ARCHIVE",
    IMPORT: "REPORT.MANPOWER_PLAN.IMPORT",
    EXPORT: "REPORT.MANPOWER_PLAN.EXPORT",
})

const companies = ref([])
const branches = ref([])
const departments = ref([])
const positions = ref([])
const lines = ref([])
const shifts = ref([])
const employeeTypes = ref([])

const loadingOptions = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedId = ref(null)
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)

const filters = reactive({
    search: "",
    status: "ACTIVE",
    companyId: "",
    branchId: "",
    year: new Date().getFullYear(),
    month: "",
    employeeTypeId: "",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))
const canImport = computed(() => authStore.hasPermission(PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(PERMISSIONS.EXPORT))

const statusOptions = computed(() => [
    { label: t("manpowerPlan.all"), value: "ALL" },
    { label: t("manpowerPlan.active"), value: "ACTIVE" },
    { label: t("manpowerPlan.inactive"), value: "INACTIVE" },
    { label: t("manpowerPlan.archived"), value: "ARCHIVED" },
])
const editableStatusOptions = computed(() => [
    { label: t("manpowerPlan.active"), value: "ACTIVE" },
    { label: t("manpowerPlan.inactive"), value: "INACTIVE" },
])
const monthOptions = [
    { label: t("manpowerPlan.allMonths"), value: "" },
    ...Array.from({ length: 12 }, (_, index) => ({ label: `${index + 1}`, value: index + 1 })),
]
const formMonthOptions = Array.from({ length: 12 }, (_, index) => ({ label: `${index + 1}`, value: index + 1 }))

const companyOptions = computed(() => companies.value.map((item) => ({ label: `${item.code} - ${item.displayName}`, value: item.id })))
const companyFilterOptions = computed(() => [{ label: "All Companies", value: "" }, ...companyOptions.value])
const branchOptions = computed(() => branches.value.filter((item) => !form.companyId || item.companyId === form.companyId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })))
const branchFilterOptions = computed(() => [{ label: "All Branches", value: "" }, ...branches.value.filter((item) => !filters.companyId || item.companyId === filters.companyId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))])
const departmentOptions = computed(() => departments.value.filter((item) => !form.branchId || item.branchId === form.branchId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })))
const positionOptions = computed(() => positions.value.filter((item) => !form.departmentId || item.departmentId === form.departmentId).map((item) => ({ label: `${item.code} - ${item.title}`, value: item.id })))
const lineOptions = computed(() => lines.value.filter((item) => !form.departmentId || item.departmentId === form.departmentId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })))
const shiftOptions = computed(() => shifts.value.filter((item) => !form.branchId || item.branchId === form.branchId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })))
const employeeTypeOptions = computed(() => employeeTypes.value.filter((item) => !form.companyId || item.companyId === form.companyId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })))
const employeeTypeFilterOptions = computed(() => [{ label: "All Employee Types", value: "" }, ...employeeTypes.value.filter((item) => !filters.companyId || item.companyId === filters.companyId).map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id }))])
const childOptions = computed(() => {
    const employeeType = employeeTypes.value.find((item) => item.id === form.employeeTypeId)
    return [
        { label: "Directly under type", value: "" },
        ...(employeeType?.children || []).map((child) => ({ label: `${child.code} - ${child.name}`, value: child.id })),
    ]
})

const dialogTitle = computed(() =>
    dialogMode.value === "create"
        ? t("manpowerPlan.createTitle")
        : t("manpowerPlan.editTitle"),
)

function getErrorMessage(error) {
    return error?.response?.data?.error?.messageKey || error?.response?.data?.message || error?.message || "Something went wrong"
}

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        departmentId: "",
        positionId: "",
        lineId: "",
        shiftId: "",
        employeeTypeId: "",
        employeeTypeChildId: "",
        targetBudget: 0,
        targetRoadmap: 0,
        remark: "",
        status: "ACTIVE",
    }
}

function assignForm(source = createEmptyForm()) {
    Object.assign(form, createEmptyForm(), {
        ...source,
        companyId: source.companyId || "",
        branchId: source.branchId || "",
        departmentId: source.departmentId || "",
        positionId: source.positionId || "",
        lineId: source.lineId || "",
        shiftId: source.shiftId || "",
        employeeTypeId: source.employeeTypeId || "",
        employeeTypeChildId: source.employeeTypeChildId || "",
        targetBudget: Number(source.targetBudget || 0),
        targetRoadmap: Number(source.targetRoadmap || 0),
        status: source.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    })
}

function buildPayload() {
    return {
        companyId: form.companyId,
        branchId: form.branchId,
        year: form.year,
        month: form.month,
        departmentId: form.departmentId || null,
        positionId: form.positionId || null,
        lineId: form.lineId || null,
        shiftId: form.shiftId || null,
        employeeTypeId: form.employeeTypeId || null,
        employeeTypeChildId: form.employeeTypeChildId || null,
        targetBudget: Number(form.targetBudget || 0),
        targetRoadmap: Number(form.targetRoadmap || 0),
        remark: form.remark || "",
        status: form.status,
    }
}

async function loadOptions() {
    loadingOptions.value = true
    try {
        const [companyResult, branchResult, departmentResult, positionResult, lineResult, shiftResult, employeeTypeResult] = await Promise.all([
            fetchCompaniesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchBranchesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchDepartmentsLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchPositionsLookup({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchLines({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchShifts({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchEmployeeTypes({ page: 1, limit: 100, status: "ACTIVE" }),
        ])
        companies.value = companyResult || []
        branches.value = branchResult || []
        departments.value = departmentResult || []
        positions.value = positionResult || []
        lines.value = lineResult.items || []
        shifts.value = shiftResult.items || []
        employeeTypes.value = employeeTypeResult.items || []
    } catch (error) {
        toast.add({ severity: "error", summary: "Failed to load setup data", detail: getErrorMessage(error), life: 4500 })
    } finally {
        loadingOptions.value = false
    }
}

async function loadPlans(page = 1) {
    try {
        await manpowerPlanStore.loadManpowerPlans({ ...filters, page })
    } catch (error) {
        toast.add({ severity: "error", summary: "Failed to load manpower plans", detail: getErrorMessage(error), life: 4500 })
    }
}

function openCreateDialog() {
    dialogMode.value = "create"
    selectedId.value = null
    assignForm()
    dialogVisible.value = true
}

function openEditDialog(item) {
    dialogMode.value = "edit"
    selectedId.value = item.id
    assignForm(item)
    dialogVisible.value = true
}

async function submitForm() {
    try {
        if (dialogMode.value === "create") {
            await manpowerPlanStore.createManpowerPlan(buildPayload())
            toast.add({ severity: "success", summary: "Created", detail: "Manpower plan created.", life: 2500 })
        } else {
            await manpowerPlanStore.updateManpowerPlan(selectedId.value, buildPayload())
            toast.add({ severity: "success", summary: "Updated", detail: "Manpower plan updated.", life: 2500 })
        }
        dialogVisible.value = false
        await loadPlans(manpowerPlanStore.pagination.page)
    } catch (error) {
        toast.add({ severity: "error", summary: "Save failed", detail: getErrorMessage(error), life: 4500 })
    }
}

function confirmArchive(item) {
    archiveCandidate.value = item
    archiveDialogVisible.value = true
}

async function archiveSelected() {
    try {
        await manpowerPlanStore.archiveManpowerPlan(archiveCandidate.value.id)
        toast.add({ severity: "success", summary: "Archived", detail: "Manpower plan archived.", life: 2500 })
        archiveDialogVisible.value = false
        archiveCandidate.value = null
        await loadPlans(manpowerPlanStore.pagination.page)
    } catch (error) {
        toast.add({ severity: "error", summary: "Archive failed", detail: getErrorMessage(error), life: 4500 })
    }
}

function onImportFileChange(event) {
    selectedImportFile.value = event.target.files?.[0] || null
}

async function submitImport() {
    if (!selectedImportFile.value) return
    try {
        await manpowerPlanStore.importManpowerPlans(selectedImportFile.value)
        importDialogVisible.value = false
        importResultDialogVisible.value = true
        selectedImportFile.value = null
        if (fileInputRef.value) fileInputRef.value.value = ""
        await loadPlans(1)
    } catch (error) {
        toast.add({ severity: "error", summary: "Import failed", detail: getErrorMessage(error), life: 4500 })
    }
}

watch(() => form.companyId, () => {
    form.branchId = ""
    form.departmentId = ""
    form.positionId = ""
    form.lineId = ""
    form.shiftId = ""
    form.employeeTypeId = ""
    form.employeeTypeChildId = ""
})
watch(() => form.departmentId, () => {
    form.positionId = ""
    form.lineId = ""
})
watch(() => form.employeeTypeId, () => {
    form.employeeTypeChildId = ""
})

onMounted(async () => {
    await loadOptions()
    await loadPlans(1)
})
</script>

<template>
    <section class="report-page">
        <Card class="report-card">
            <template #title>
                <div class="report-title-row">
                    <div>
                        <h1>{{ t("manpowerPlan.title") }}</h1>
                        <p>{{ t("manpowerPlan.description") }}</p>
                    </div>
                    <div class="report-actions">
                        <Button v-if="canImport" icon="pi pi-download" :label="t('manpowerPlan.sample')" severity="secondary" :loading="manpowerPlanStore.downloadingTemplate" @click="manpowerPlanStore.downloadImportTemplate()" />
                        <Button v-if="canImport" icon="pi pi-upload" :label="t('manpowerPlan.import')" severity="secondary" @click="importDialogVisible = true" />
                        <Button v-if="canExport" icon="pi pi-file-excel" :label="t('manpowerPlan.export')" severity="secondary" :loading="manpowerPlanStore.exporting" @click="manpowerPlanStore.exportManpowerPlans()" />
                        <Button v-if="canCreate" icon="pi pi-plus" :label="t('manpowerPlan.new')" @click="openCreateDialog" />
                    </div>
                </div>
            </template>

            <template #content>
                <div class="filter-grid">
                    <InputText v-model="filters.search" :placeholder="t('manpowerPlan.search')" @keyup.enter="loadPlans(1)" />
                    <Select v-model="filters.companyId" :options="companyFilterOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.company')" filter show-clear />
                    <Select v-model="filters.branchId" :options="branchFilterOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.branch')" filter show-clear />
                    <InputNumber v-model="filters.year" :placeholder="t('manpowerPlan.year')" :min="2000" :max="2100" :use-grouping="false" />
                    <Select v-model="filters.month" :options="monthOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.month')" />
                    <Select v-model="filters.employeeTypeId" :options="employeeTypeFilterOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.employeeType')" filter show-clear />
                    <Select v-model="filters.status" :options="statusOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.status')" />
                    <Button icon="pi pi-search" :label="t('manpowerPlan.apply')" :loading="manpowerPlanStore.loading" @click="loadPlans(1)" />
                </div>

                <DataTable :value="manpowerPlanStore.items" :loading="manpowerPlanStore.loading || loadingOptions" data-key="id" paginator lazy :first="(manpowerPlanStore.pagination.page - 1) * manpowerPlanStore.pagination.limit" :rows="manpowerPlanStore.pagination.limit" :total-records="manpowerPlanStore.pagination.total" @page="loadPlans($event.page + 1)" scrollable scroll-height="62vh" size="small" class="compact-table">
                    <Column field="year" :header="t('manpowerPlan.year')" style="min-width: 80px" />
                    <Column field="month" :header="t('manpowerPlan.month')" style="min-width: 80px" />
                    <Column :header="t('manpowerPlan.company')" style="min-width: 140px"><template #body="{ data }">{{ data.company?.code || '-' }}</template></Column>
                    <Column :header="t('manpowerPlan.branch')" style="min-width: 140px"><template #body="{ data }">{{ data.branch?.code || '-' }}</template></Column>
                    <Column :header="t('manpowerPlan.department')" style="min-width: 160px"><template #body="{ data }">{{ data.department?.name || '-' }}</template></Column>
                    <Column :header="t('manpowerPlan.position')" style="min-width: 170px"><template #body="{ data }">{{ data.position?.title || '-' }}</template></Column>
                    <Column :header="t('manpowerPlan.line')" style="min-width: 120px"><template #body="{ data }">{{ data.line?.name || '-' }}</template></Column>
                    <Column :header="t('manpowerPlan.type')" style="min-width: 180px"><template #body="{ data }">{{ data.employeeType?.name || '-' }}<span v-if="data.employeeTypeChildName"> / {{ data.employeeTypeChildName }}</span></template></Column>
                    <Column field="targetBudget" :header="t('manpowerPlan.budget')" style="min-width: 100px" />
                    <Column field="targetRoadmap" :header="t('manpowerPlan.roadmap')" style="min-width: 110px" />
                    <Column :header="t('manpowerPlan.status')" style="min-width: 100px"><template #body="{ data }"><Tag :value="data.status" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" /></template></Column>
                    <Column :header="t('manpowerPlan.action')" frozen align-frozen="right" style="min-width: 150px"><template #body="{ data }"><div class="row-actions"><Button v-if="canUpdate" icon="pi pi-pencil" text rounded @click="openEditDialog(data)" /><Button v-if="canArchive && data.status !== 'ARCHIVED'" icon="pi pi-trash" text rounded severity="danger" @click="confirmArchive(data)" /></div></template></Column>
                </DataTable>
            </template>
        </Card>

        <Dialog v-model:visible="dialogVisible" :header="dialogTitle" modal class="report-dialog">
            <div class="form-grid">
                <Select v-model="form.companyId" :options="companyOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.company')" filter />
                <Select v-model="form.branchId" :options="branchOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.branch')" filter />
                <InputNumber v-model="form.year" :placeholder="t('manpowerPlan.year')" :min="2000" :max="2100" :use-grouping="false" />
                <Select v-model="form.month" :options="formMonthOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.month')" />
                <Select v-model="form.departmentId" :options="departmentOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.department')" filter show-clear />
                <Select v-model="form.positionId" :options="positionOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.position')" filter show-clear />
                <Select v-model="form.lineId" :options="lineOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.line')" filter show-clear />
                <Select v-model="form.shiftId" :options="shiftOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.shift')" filter show-clear />
                <Select v-model="form.employeeTypeId" :options="employeeTypeOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.employeeType')" filter show-clear />
                <Select v-model="form.employeeTypeChildId" :options="childOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.childGroup')" :disabled="!form.employeeTypeId" show-clear />
                <InputNumber v-model="form.targetBudget" :placeholder="t('manpowerPlan.targetBudget')" :min="0" />
                <InputNumber v-model="form.targetRoadmap" :placeholder="t('manpowerPlan.targetRoadmap')" :min="0" />
                <Select v-model="form.status" :options="editableStatusOptions" option-label="label" option-value="value" :placeholder="t('manpowerPlan.status')" />
                <Textarea v-model="form.remark" :placeholder="t('manpowerPlan.remark')" rows="3" class="span-2" />
            </div>
            <template #footer><Button :label="t('common.cancel')" severity="secondary" @click="dialogVisible = false" /><Button :label="t('common.save')" :loading="manpowerPlanStore.saving" @click="submitForm" /></template>
        </Dialog>

        <Dialog v-model:visible="archiveDialogVisible" :header="t('manpowerPlan.archiveTitle')" modal><p>{{ t("manpowerPlan.archiveMessage") }}</p><template #footer><Button :label="t('common.cancel')" severity="secondary" @click="archiveDialogVisible = false" /><Button :label="t('manpowerPlan.archive')" severity="danger" :loading="manpowerPlanStore.archiving" @click="archiveSelected" /></template></Dialog>
        <Dialog v-model:visible="importDialogVisible" :header="t('manpowerPlan.importTitle')" modal><input ref="fileInputRef" type="file" accept=".xlsx" @change="onImportFileChange" /><ProgressBar v-if="manpowerPlanStore.importing" :value="manpowerPlanStore.importProgress" /><template #footer><Button :label="t('common.cancel')" severity="secondary" @click="importDialogVisible = false" /><Button :label="t('manpowerPlan.import')" :disabled="!selectedImportFile" :loading="manpowerPlanStore.importing" @click="submitImport" /></template></Dialog>
        <Dialog v-model:visible="importResultDialogVisible" :header="t('manpowerPlan.importResultTitle')" modal><pre>{{ manpowerPlanStore.importSummary }}</pre></Dialog>
    </section>
</template>

<style scoped>
.report-page { display: flex; flex-direction: column; gap: 1rem; }
.report-card { border-radius: 24px; }
.report-title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
.report-title-row h1 { margin: 0; font-size: 1.25rem; }
.report-title-row p { margin: .3rem 0 0; color: var(--text-color-secondary); font-size: .82rem; }
.report-actions, .row-actions { display: flex; gap: .45rem; align-items: center; flex-wrap: wrap; }
.filter-grid, .form-grid { display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: .7rem; margin-bottom: 1rem; }
.form-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
.span-2 { grid-column: span 2; }
.compact-table :deep(.p-datatable-thead > tr > th), .compact-table :deep(.p-datatable-tbody > tr > td) { text-align: center; font-size: .76rem; }
.report-dialog { width: min(920px, 96vw); }
pre { white-space: pre-wrap; font-size: .78rem; }
@media (max-width: 900px) { .filter-grid, .form-grid { grid-template-columns: 1fr; } .span-2 { grid-column: auto; } .report-title-row { flex-direction: column; } }
</style>
