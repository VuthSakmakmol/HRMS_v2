<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import FileUpload from "primevue/fileupload"
import InputText from "primevue/inputtext"
import MultiSelect from "primevue/multiselect"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchPositionsLookup } from "@/modules/organization/services/position.api.js"

import { useEmployeeTypeStore } from "../stores/employeeType.store.js"

const toast = useToast()
const authStore = useAuthStore()
const employeeTypeStore = useEmployeeTypeStore()

const EMPLOYEE_TYPE_PERMISSIONS = Object.freeze({
    CREATE: "ORGANIZATION.EMPLOYEE_TYPE.CREATE",
    UPDATE: "ORGANIZATION.EMPLOYEE_TYPE.UPDATE",
    ARCHIVE: "ORGANIZATION.EMPLOYEE_TYPE.ARCHIVE",
    IMPORT: "ORGANIZATION.EMPLOYEE_TYPE.IMPORT",
    EXPORT: "ORGANIZATION.EMPLOYEE_TYPE.EXPORT",
})

const DASHBOARD_CATEGORIES = Object.freeze([
    { label: "Blue Collar - Sewer", value: "BLUE_COLLAR_SEWER" },
    { label: "Blue Collar - Non-Sewer", value: "BLUE_COLLAR_NON_SEWER" },
    { label: "White Collar", value: "WHITE_COLLAR" },
    { label: "Custom", value: "CUSTOM" },
])

const POSITION_ASSIGNMENT_MODES = Object.freeze([
    { label: "All positions", value: "ALL_POSITIONS" },
    { label: "Specific positions", value: "SPECIFIC_POSITIONS" },
])

const STATUS_OPTIONS = Object.freeze([
    { label: "All statuses", value: "ALL" },
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
    { label: "Archived", value: "ARCHIVED" },
])

const FORM_STATUS_OPTIONS = Object.freeze([
    { label: "Active", value: "ACTIVE" },
    { label: "Inactive", value: "INACTIVE" },
])

const companies = ref([])
const positions = ref([])
const companyLoading = ref(false)
const positionLoading = ref(false)
const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedEmployeeTypeId = ref(null)
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: "",
    dashboardCategory: "ALL",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() => authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.ARCHIVE))
const canImport = computed(() => authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.EXPORT))

const companyOptions = computed(() => companies.value.map((company) => ({
    label: `${company.code || ""} - ${company.displayName || company.name || ""}`,
    value: company.id,
})))

const companyFilterOptions = computed(() => [
    { label: "All companies", value: "" },
    ...companyOptions.value,
])

const dashboardCategoryFilterOptions = computed(() => [
    { label: "All dashboard groups", value: "ALL" },
    ...DASHBOARD_CATEGORIES,
])

const positionOptions = computed(() =>
    positions.value.map((position) => ({
        label: `${position.code || ""} - ${position.title || position.name || ""}`,
        value: position.id,
        companyId: position.companyId,
        branchId: position.branchId,
        departmentId: position.departmentId,
    })),
)

const dialogTitle = computed(() =>
    dialogMode.value === "create" ? "Create Employee Type" : "Edit Employee Type",
)

function createEmptyForm() {
    return {
        companyId: "",
        code: "",
        name: "",
        shortName: "",
        structureMode: "DIRECT",
        dashboardCategory: "CUSTOM",
        positionAssignmentMode: "SPECIFIC_POSITIONS",
        positionIds: [],
        children: [],
        status: "ACTIVE",
        description: "",
    }
}

function normalizeCode(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "")
}

function resetForm() {
    Object.assign(form, createEmptyForm())
    selectedEmployeeTypeId.value = null
}

function categoryLabel(value) {
    return DASHBOARD_CATEGORIES.find((item) => item.value === value)?.label || value || "Custom"
}

function assignmentModeLabel(value) {
    return POSITION_ASSIGNMENT_MODES.find((item) => item.value === value)?.label || value || "Specific positions"
}

function categorySeverity(value) {
    if (value === "BLUE_COLLAR_SEWER") return "info"
    if (value === "BLUE_COLLAR_NON_SEWER") return "warning"
    if (value === "WHITE_COLLAR") return "success"
    return "secondary"
}

function hasChildren(item) {
    return (item.children || []).length > 0
}

function positionCountLabel(item) {
    if (item.positionCount === "ALL") return "All"
    return String(item.positionCount || 0)
}

function buildPayload() {
    const payload = {
        companyId: form.companyId,
        code: normalizeCode(form.code),
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        dashboardCategory: form.dashboardCategory,
        positionAssignmentMode: form.positionAssignmentMode,
        positionIds:
            form.structureMode === "DIRECT" &&
            form.positionAssignmentMode === "SPECIFIC_POSITIONS"
                ? [...form.positionIds]
                : [],
        children:
            form.structureMode === "CHILD"
                ? form.children.map((child) => ({
                      code: normalizeCode(child.code || child.name),
                      name: child.name.trim(),
                      dashboardCategory: child.dashboardCategory || "CUSTOM",
                      positionAssignmentMode:
                          child.positionAssignmentMode || "SPECIFIC_POSITIONS",
                      positionIds:
                          child.positionAssignmentMode === "SPECIFIC_POSITIONS"
                              ? [...(child.positionIds || [])]
                              : [],
                  }))
                : [],
        status: form.status,
        description: form.description.trim(),
    }

    if (!payload.shortName) delete payload.shortName
    if (!payload.description) delete payload.description

    return payload
}

function fillForm(item) {
    resetForm()
    selectedEmployeeTypeId.value = item.id
    form.companyId = item.companyId || ""
    form.code = item.code || ""
    form.name = item.name || ""
    form.shortName = item.shortName || ""
    form.dashboardCategory = item.dashboardCategory || "CUSTOM"
    form.positionAssignmentMode = item.positionAssignmentMode || "SPECIFIC_POSITIONS"
    form.positionIds = [...(item.positionIds || [])]
    form.structureMode = hasChildren(item) ? "CHILD" : "DIRECT"
    form.children = (item.children || []).map((child) => ({
        id: child.id,
        code: child.code || "",
        name: child.name || "",
        dashboardCategory: child.dashboardCategory || "CUSTOM",
        positionAssignmentMode: child.positionAssignmentMode || "SPECIFIC_POSITIONS",
        positionIds: [...(child.positionIds || [])],
    }))
    form.status = item.status === "ARCHIVED" ? "INACTIVE" : item.status || "ACTIVE"
    form.description = item.description || ""
}

async function loadCompanies() {
    companyLoading.value = true
    try {
        companies.value = await fetchCompaniesLookup({ status: "ACTIVE" })
    } finally {
        companyLoading.value = false
    }
}

async function loadPositions() {
    positionLoading.value = true
    try {
        positions.value = await fetchPositionsLookup({
            companyId: form.companyId || filters.companyId || undefined,
            status: "ACTIVE",
        })
    } finally {
        positionLoading.value = false
    }
}

async function loadEmployeeTypes(extra = {}) {
    await employeeTypeStore.loadEmployeeTypes({
        page: extra.page || 1,
        search: filters.search,
        status: filters.status,
        dashboardCategory: filters.dashboardCategory,
        companyId: filters.companyId || undefined,
    })
}

function openCreateDialog() {
    resetForm()
    form.companyId = filters.companyId || ""
    dialogMode.value = "create"
    dialogVisible.value = true
    loadPositions()
}

function openEditDialog(item) {
    fillForm(item)
    dialogMode.value = "edit"
    dialogVisible.value = true
    loadPositions()
}

function addChild() {
    form.structureMode = "CHILD"
    form.positionIds = []
    form.children.push({
        code: "",
        name: "",
        dashboardCategory: "CUSTOM",
        positionAssignmentMode: "SPECIFIC_POSITIONS",
        positionIds: [],
    })
}

function removeChild(index) {
    form.children.splice(index, 1)
}

async function saveEmployeeType() {
    const payload = buildPayload()

    if (dialogMode.value === "create") {
        await employeeTypeStore.createEmployeeType(payload)
        toast.add({ severity: "success", summary: "Created", detail: "Employee type created.", life: 2500 })
    } else {
        await employeeTypeStore.updateEmployeeType(selectedEmployeeTypeId.value, payload)
        toast.add({ severity: "success", summary: "Updated", detail: "Employee type updated.", life: 2500 })
    }

    dialogVisible.value = false
    await loadEmployeeTypes({ page: employeeTypeStore.pagination.page })
}

function confirmArchive(item) {
    archiveCandidate.value = item
    archiveDialogVisible.value = true
}

async function archiveSelected() {
    await employeeTypeStore.archiveEmployeeType(archiveCandidate.value.id)
    archiveDialogVisible.value = false
    archiveCandidate.value = null
    toast.add({ severity: "success", summary: "Archived", detail: "Employee type archived.", life: 2500 })
    await loadEmployeeTypes({ page: employeeTypeStore.pagination.page })
}

async function downloadTemplate() {
    await employeeTypeStore.downloadImportTemplate()
}

async function exportData() {
    await employeeTypeStore.exportEmployeeTypes()
}

function handleFileSelect(event) {
    selectedImportFile.value = event.files?.[0] || null
}

async function importData() {
    if (!selectedImportFile.value) return

    await employeeTypeStore.importEmployeeTypes(selectedImportFile.value)
    importDialogVisible.value = false
    importResultDialogVisible.value = true
    selectedImportFile.value = null
    await loadEmployeeTypes({ page: 1 })
}

watch(
    () => form.companyId,
    () => {
        form.positionIds = []
        form.children = form.children.map((child) => ({ ...child, positionIds: [] }))
        loadPositions()
    },
)

onMounted(async () => {
    await Promise.all([loadCompanies(), loadEmployeeTypes()])
})
</script>

<template>
    <section class="employee-type-page hrms-compact">
        <div class="employee-type-toolbar">
            <InputText
                v-model="filters.search"
                class="employee-type-search"
                placeholder="Search code, name, or child group"
                @keyup.enter="loadEmployeeTypes()"
            />

            <Select
                v-model="filters.companyId"
                :options="companyFilterOptions"
                option-label="label"
                option-value="value"
                class="employee-type-filter"
                :loading="companyLoading"
                @update:model-value="loadEmployeeTypes()"
            />

            <Select
                v-model="filters.dashboardCategory"
                :options="dashboardCategoryFilterOptions"
                option-label="label"
                option-value="value"
                class="employee-type-filter"
                @update:model-value="loadEmployeeTypes()"
            />

            <Select
                v-model="filters.status"
                :options="STATUS_OPTIONS"
                option-label="label"
                option-value="value"
                class="employee-type-filter"
                @update:model-value="loadEmployeeTypes()"
            />

            <Button
                icon="pi pi-filter"
                label="Apply"
                :loading="employeeTypeStore.loading"
                @click="loadEmployeeTypes()"
            />

            <Button
                v-if="canImport"
                icon="pi pi-download"
                label="Sample"
                severity="secondary"
                outlined
                :loading="employeeTypeStore.downloadingTemplate"
                @click="downloadTemplate"
            />

            <Button
                v-if="canImport"
                icon="pi pi-upload"
                label="Import"
                severity="secondary"
                outlined
                @click="importDialogVisible = true"
            />

            <Button
                v-if="canExport"
                icon="pi pi-file-export"
                label="Export"
                severity="secondary"
                outlined
                :loading="employeeTypeStore.exporting"
                @click="exportData"
            />

            <Button
                v-if="canCreate"
                icon="pi pi-plus"
                label="Create"
                @click="openCreateDialog"
            />
        </div>

        <DataTable
            :value="employeeTypeStore.items"
            :loading="employeeTypeStore.loading"
            data-key="id"
            size="small"
            striped-rows
            paginator
            lazy
            :rows="employeeTypeStore.pagination.limit"
            :total-records="employeeTypeStore.pagination.total"
            :first="(employeeTypeStore.pagination.page - 1) * employeeTypeStore.pagination.limit"
            @page="loadEmployeeTypes({ page: $event.page + 1 })"
        >
            <Column
                field="code"
                header="Code"
                style="width: 9rem"
            />

            <Column
                field="name"
                header="Name"
                style="min-width: 12rem"
            />

            <Column header="Dashboard group">
                <template #body="{ data }">
                    <Tag
                        :value="categoryLabel(data.dashboardCategory)"
                        :severity="categorySeverity(data.dashboardCategory)"
                    />
                </template>
            </Column>

            <Column header="Assignment">
                <template #body="{ data }">
                    <span v-if="hasChildren(data)">
                        Child groups
                    </span>
                    <span v-else>
                        {{ assignmentModeLabel(data.positionAssignmentMode) }}
                    </span>
                </template>
            </Column>

            <Column header="Positions">
                <template #body="{ data }">
                    {{ positionCountLabel(data) }}
                </template>
            </Column>

            <Column header="Children">
                <template #body="{ data }">
                    <div
                        v-if="hasChildren(data)"
                        class="child-chip-list"
                    >
                        <Tag
                            v-for="child in data.children"
                            :key="child.id || child.code"
                            :value="`${child.code} (${categoryLabel(child.dashboardCategory)})`"
                            :severity="categorySeverity(child.dashboardCategory)"
                        />
                    </div>
                    <span v-else>-</span>
                </template>
            </Column>

            <Column header="Status" style="width: 7rem">
                <template #body="{ data }">
                    <Tag
                        :value="data.status"
                        :severity="data.status === 'ACTIVE' ? 'success' : data.status === 'ARCHIVED' ? 'danger' : 'warning'"
                    />
                </template>
            </Column>

            <Column header="Actions" style="width: 8rem">
                <template #body="{ data }">
                    <div class="row-actions">
                        <Button
                            v-if="canUpdate && data.status !== 'ARCHIVED'"
                            icon="pi pi-pencil"
                            text
                            rounded
                            @click="openEditDialog(data)"
                        />
                        <Button
                            v-if="canArchive && data.status !== 'ARCHIVED'"
                            icon="pi pi-trash"
                            text
                            rounded
                            severity="danger"
                            @click="confirmArchive(data)"
                        />
                    </div>
                </template>
            </Column>
        </DataTable>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="dialogTitle"
            class="employee-type-dialog"
            :style="{ width: 'min(980px, 96vw)' }"
        >
            <div class="employee-type-form">
                <div class="form-grid">
                    <label>
                        Company
                        <Select
                            v-model="form.companyId"
                            :options="companyOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            class="w-full"
                            :loading="companyLoading"
                        />
                    </label>

                    <label>
                        Code
                        <InputText
                            v-model="form.code"
                            class="w-full"
                            placeholder="BLUE_COLLAR"
                        />
                    </label>

                    <label>
                        Name
                        <InputText
                            v-model="form.name"
                            class="w-full"
                            placeholder="Blue Collar"
                        />
                    </label>

                    <label>
                        Short name
                        <InputText
                            v-model="form.shortName"
                            class="w-full"
                        />
                    </label>

                    <label>
                        Structure
                        <Select
                            v-model="form.structureMode"
                            :options="[
                                { label: 'Direct positions', value: 'DIRECT' },
                                { label: 'Child groups', value: 'CHILD' },
                            ]"
                            option-label="label"
                            option-value="value"
                            class="w-full"
                        />
                    </label>

                    <label>
                        Dashboard group
                        <Select
                            v-model="form.dashboardCategory"
                            :options="DASHBOARD_CATEGORIES"
                            option-label="label"
                            option-value="value"
                            class="w-full"
                            :disabled="form.structureMode === 'CHILD'"
                        />
                    </label>

                    <label>
                        Position assignment
                        <Select
                            v-model="form.positionAssignmentMode"
                            :options="POSITION_ASSIGNMENT_MODES"
                            option-label="label"
                            option-value="value"
                            class="w-full"
                            :disabled="form.structureMode === 'CHILD'"
                        />
                    </label>

                    <label>
                        Status
                        <Select
                            v-model="form.status"
                            :options="FORM_STATUS_OPTIONS"
                            option-label="label"
                            option-value="value"
                            class="w-full"
                        />
                    </label>
                </div>

                <div
                    v-if="form.structureMode === 'DIRECT'"
                    class="assignment-box"
                >
                    <div class="assignment-box__title">
                        Direct position assignment
                    </div>

                    <p class="assignment-help">
                        Use <b>All positions</b> for flexible groups like White Collar, or choose specific positions for strict groups.
                    </p>

                    <MultiSelect
                        v-if="form.positionAssignmentMode === 'SPECIFIC_POSITIONS'"
                        v-model="form.positionIds"
                        :options="positionOptions"
                        option-label="label"
                        option-value="value"
                        filter
                        display="chip"
                        class="w-full"
                        :loading="positionLoading"
                        placeholder="Select allowed positions"
                    />
                </div>

                <div
                    v-else
                    class="assignment-box"
                >
                    <div class="assignment-box__header">
                        <div>
                            <div class="assignment-box__title">
                                Child groups
                            </div>
                            <p class="assignment-help">
                                Example: BLUE_COLLAR has child groups SEWER and NON_SEWER. The dashboard filter reads these children automatically.
                            </p>
                        </div>

                        <Button
                            icon="pi pi-plus"
                            label="Add child"
                            size="small"
                            @click="addChild"
                        />
                    </div>

                    <div
                        v-for="(child, index) in form.children"
                        :key="index"
                        class="child-editor"
                    >
                        <div class="child-editor__grid">
                            <label>
                                Child code
                                <InputText
                                    v-model="child.code"
                                    class="w-full"
                                    placeholder="SEWER"
                                />
                            </label>

                            <label>
                                Child name
                                <InputText
                                    v-model="child.name"
                                    class="w-full"
                                    placeholder="Sewer"
                                />
                            </label>

                            <label>
                                Dashboard group
                                <Select
                                    v-model="child.dashboardCategory"
                                    :options="DASHBOARD_CATEGORIES"
                                    option-label="label"
                                    option-value="value"
                                    class="w-full"
                                />
                            </label>

                            <label>
                                Assignment
                                <Select
                                    v-model="child.positionAssignmentMode"
                                    :options="POSITION_ASSIGNMENT_MODES"
                                    option-label="label"
                                    option-value="value"
                                    class="w-full"
                                />
                            </label>
                        </div>

                        <MultiSelect
                            v-if="child.positionAssignmentMode === 'SPECIFIC_POSITIONS'"
                            v-model="child.positionIds"
                            :options="positionOptions"
                            option-label="label"
                            option-value="value"
                            filter
                            display="chip"
                            class="w-full"
                            :loading="positionLoading"
                            placeholder="Select allowed positions for this child"
                        />

                        <Button
                            icon="pi pi-trash"
                            label="Remove child"
                            severity="danger"
                            outlined
                            size="small"
                            @click="removeChild(index)"
                        />
                    </div>
                </div>

                <label>
                    Description
                    <Textarea
                        v-model="form.description"
                        class="w-full"
                        rows="3"
                    />
                </label>
            </div>

            <template #footer>
                <Button
                    label="Cancel"
                    severity="secondary"
                    outlined
                    @click="dialogVisible = false"
                />
                <Button
                    label="Save"
                    :loading="employeeTypeStore.saving"
                    @click="saveEmployeeType"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            header="Archive Employee Type"
            :style="{ width: 'min(420px, 94vw)' }"
        >
            <p>
                Archive {{ archiveCandidate?.code }} - {{ archiveCandidate?.name }}?
            </p>
            <template #footer>
                <Button
                    label="Cancel"
                    severity="secondary"
                    outlined
                    @click="archiveDialogVisible = false"
                />
                <Button
                    label="Archive"
                    severity="danger"
                    :loading="employeeTypeStore.archiving"
                    @click="archiveSelected"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            header="Import Employee Types"
            :style="{ width: 'min(520px, 94vw)' }"
        >
            <FileUpload
                mode="basic"
                accept=".xlsx,.xls"
                choose-label="Choose Excel"
                custom-upload
                @select="handleFileSelect"
            />

            <ProgressBar
                v-if="employeeTypeStore.importing"
                :value="employeeTypeStore.importProgress"
                class="mt-3"
            />

            <template #footer>
                <Button
                    label="Cancel"
                    severity="secondary"
                    outlined
                    @click="importDialogVisible = false"
                />
                <Button
                    label="Import"
                    :disabled="!selectedImportFile"
                    :loading="employeeTypeStore.importing"
                    @click="importData"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            header="Import Result"
            :style="{ width: 'min(760px, 96vw)' }"
        >
            <div v-if="employeeTypeStore.importSummary" class="import-summary">
                <strong>Total: {{ employeeTypeStore.importSummary.totalRows }}</strong>
                <strong>Created: {{ employeeTypeStore.importSummary.created }}</strong>
                <strong>Updated: {{ employeeTypeStore.importSummary.updated }}</strong>
                <strong>Skipped: {{ employeeTypeStore.importSummary.skipped }}</strong>
            </div>

            <DataTable
                v-if="employeeTypeStore.importSummary?.errors?.length"
                :value="employeeTypeStore.importSummary.errors"
                size="small"
            >
                <Column field="rowNumber" header="Row" />
                <Column field="field" header="Field" />
                <Column field="messageKey" header="Issue" />
            </DataTable>
        </Dialog>
    </section>
</template>

<style scoped>
.employee-type-page {
    display: grid;
    gap: 0.75rem;
    min-width: 0;
}

.employee-type-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.45rem;
}

.employee-type-search {
    flex: 1 1 16rem;
    min-width: 12rem;
}

.employee-type-filter {
    flex: 0 1 14rem;
    min-width: 11rem;
}

.row-actions {
    display: inline-flex;
    gap: 0.2rem;
}

.child-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.employee-type-form {
    display: grid;
    gap: 0.8rem;
}

.form-grid,
.child-editor__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.65rem;
}

.employee-type-form label,
.child-editor label {
    display: grid;
    gap: 0.28rem;
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
}

.assignment-box {
    display: grid;
    gap: 0.6rem;
    padding: 0.75rem;
    border: 1px solid var(--hrms-border);
    border-radius: 0.85rem;
    background: var(--hrms-surface-muted);
}

.assignment-box__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}

.assignment-box__title {
    color: var(--hrms-text);
    font-size: 0.85rem;
    font-weight: 900;
}

.assignment-help {
    margin: 0.2rem 0 0;
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
}

.child-editor {
    display: grid;
    gap: 0.55rem;
    padding: 0.65rem;
    border: 1px solid var(--hrms-border);
    border-radius: 0.7rem;
    background: var(--hrms-surface);
}

.import-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
    margin-bottom: 0.75rem;
}

.w-full {
    width: 100%;
}

.mt-3 {
    margin-top: 0.75rem;
}

@media (max-width: 860px) {
    .form-grid,
    .child-editor__grid,
    .import-summary {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 560px) {
    .form-grid,
    .child-editor__grid,
    .import-summary {
        grid-template-columns: 1fr;
    }
}
</style>
