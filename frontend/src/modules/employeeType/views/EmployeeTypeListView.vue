<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import MultiSelect from "primevue/multiselect"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import { fetchCompanies } from "@/modules/organization/services/company.api.js"
import { fetchBranches } from "@/modules/organization/services/branch.api.js"
import { fetchDepartments } from "@/modules/organization/services/department.api.js"
import { fetchPositions } from "@/modules/organization/services/position.api.js"

import { useEmployeeTypeStore } from "../stores/employeeType.store.js"

const { t } = useI18n()
const toast = useToast()

const authStore = useAuthStore()
const uiStore = useUiStore()
const employeeTypeStore = useEmployeeTypeStore()

const EMPLOYEE_TYPE_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.EMPLOYEE_TYPE.VIEW",
    CREATE: "ORGANIZATION.EMPLOYEE_TYPE.CREATE",
    UPDATE: "ORGANIZATION.EMPLOYEE_TYPE.UPDATE",
    ARCHIVE: "ORGANIZATION.EMPLOYEE_TYPE.ARCHIVE",
    IMPORT: "ORGANIZATION.EMPLOYEE_TYPE.IMPORT",
    EXPORT: "ORGANIZATION.EMPLOYEE_TYPE.EXPORT",
})

const companies = ref([])
const branches = ref([])
const departments = ref([])
const positions = ref([])

const companyLoading = ref(false)
const branchLoading = ref(false)
const departmentLoading = ref(false)
const positionLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedEmployeeTypeId = ref(null)

const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)

const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)

const formErrors = ref({})

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: "",
    branchId: "",
    departmentId: "",
    positionId: "",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() =>
    authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.CREATE),
)
const canUpdate = computed(() =>
    authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.UPDATE),
)
const canArchive = computed(() =>
    authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.ARCHIVE),
)
const canImport = computed(() =>
    authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.IMPORT),
)
const canExport = computed(() =>
    authStore.hasPermission(EMPLOYEE_TYPE_PERMISSIONS.EXPORT),
)

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.employeeType.createTitle")
        : t("organization.employeeType.editTitle")
})

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: t("organization.employeeType.allCompanies"),
        value: "",
    },
    ...companyOptions.value,
])

const branchFilterOptions = computed(() => [
    {
        label: t("organization.employeeType.allBranches"),
        value: "",
    },
    ...branches.value
        .filter((branch) => {
            if (!filters.companyId) {
                return true
            }

            return branch.companyId === filters.companyId
        })
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        })),
])

const departmentFilterOptions = computed(() => [
    {
        label: t("organization.employeeType.allDepartments"),
        value: "",
    },
    ...departments.value
        .filter((department) => {
            if (filters.branchId && department.branchId !== filters.branchId) {
                return false
            }

            if (
                filters.companyId &&
                department.companyId !== filters.companyId
            ) {
                return false
            }

            return true
        })
        .map((department) => ({
            label: `${department.code} - ${department.name}`,
            value: department.id,
        })),
])

const positionOptions = computed(() =>
    positions.value.map((position) => ({
        label: `${position.code} - ${position.title}`,
        value: position.id,
        meta: position,
    })),
)

const positionFilterOptions = computed(() => [
    {
        label: t("organization.employeeType.allPositions"),
        value: "",
    },
    ...positionOptions.value,
])

const statusOptions = computed(() => [
    {
        label: t("organization.employeeType.statusAll"),
        value: "ALL",
    },
    {
        label: t("organization.employeeType.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.employeeType.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.employeeType.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.employeeType.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.employeeType.statusInactive"),
        value: "INACTIVE",
    },
])

const assignmentModeOptions = computed(() => [
    {
        label: t("organization.employeeType.directPositions"),
        value: "DIRECT",
    },
    {
        label: t("organization.employeeType.childGroups"),
        value: "CHILD",
    },
])

function createEmptyForm() {
    return {
        companyId: "",
        code: "",
        name: "",
        shortName: "",
        assignmentMode: "DIRECT",
        positionIds: [],
        children: [],
        description: "",
        status: "ACTIVE",
    }
}

function assignForm(source) {
    const nextForm = source || createEmptyForm()
    const children = Array.isArray(nextForm.children)
        ? nextForm.children.map((child) => ({
              id: child.id || crypto.randomUUID(),
              code: child.code || "",
              name: child.name || "",
              positionIds: Array.isArray(child.positionIds)
                  ? [...child.positionIds]
                  : [],
          }))
        : []

    form.companyId = nextForm.companyId || ""
    form.code = nextForm.code || ""
    form.name = nextForm.name || ""
    form.shortName = nextForm.shortName || ""
    form.assignmentMode = children.length > 0 ? "CHILD" : "DIRECT"
    form.positionIds = Array.isArray(nextForm.positionIds)
        ? [...nextForm.positionIds]
        : []
    form.children = children
    form.description = nextForm.description || ""
    form.status = nextForm.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
}

function normalizeChildNameToCode(name) {
    return String(name || "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, "")
}

function buildChildrenPayload() {
    return form.children.map((child) => ({
        code: normalizeChildNameToCode(child.name),
        name: child.name,
        positionIds: child.positionIds || [],
    }))
}

function buildCreatePayload() {
    const useChildren = form.assignmentMode === "CHILD"

    return {
        companyId: form.companyId,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        positionIds: useChildren ? [] : form.positionIds,
        children: useChildren ? buildChildrenPayload() : [],
        description: form.description,
        status: form.status,
    }
}

function buildUpdatePayload() {
    const useChildren = form.assignmentMode === "CHILD"

    return {
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        positionIds: useChildren ? [] : form.positionIds,
        children: useChildren ? buildChildrenPayload() : [],
        description: form.description,
        status: form.status,
    }
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)

        return translated === messageKey ? t("errors.internal") : translated
    }

    return t("errors.internal")
}

function applyBackendFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields || {}
    const nextErrors = {}

    for (const [field, messages] of Object.entries(fields)) {
        nextErrors[field] = Array.isArray(messages)
            ? messages.map((messageKey) => {
                  const translated = t(messageKey)

                  return translated === messageKey
                      ? t("errors.validationFailed")
                      : translated
              })
            : [t("errors.validationFailed")]
    }

    formErrors.value = nextErrors
}

function getFieldError(fieldName) {
    const messages = formErrors.value[fieldName]

    if (!messages?.length) {
        return ""
    }

    return messages[0]
}

function clearFieldError(fieldName) {
    if (!formErrors.value[fieldName]) {
        return
    }

    formErrors.value = {
        ...formErrors.value,
        [fieldName]: undefined,
    }
}

function normalizeCodeInput() {
    form.code = form.code
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_-]/g, "")

    clearFieldError("code")
}

function getStatusSeverity(status) {
    if (status === "ACTIVE") {
        return "success"
    }

    if (status === "INACTIVE") {
        return "warn"
    }

    if (status === "ARCHIVED") {
        return "danger"
    }

    return "secondary"
}

function getStatusLabel(status) {
    if (status === "ACTIVE") {
        return t("organization.employeeType.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.employeeType.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.employeeType.statusArchived")
    }

    return status || "-"
}

function formatDateTime(value) {
    if (!value) {
        return "-"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return "-"
    }

    return new Intl.DateTimeFormat(uiStore.locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

function getPositionPreview(positionsValue = []) {
    if (!Array.isArray(positionsValue) || positionsValue.length === 0) {
        return "-"
    }

    return positionsValue
        .slice(0, 3)
        .map((position) => position.code)
        .join(", ")
}

function getAllPositions(employeeType) {
    if ((employeeType.children || []).length > 0) {
        return employeeType.children.flatMap((child) => child.positions || [])
    }

    return employeeType.positions || []
}

function mergePositions(extraPositions = []) {
    const byId = new Map()

    for (const position of positions.value) {
        byId.set(position.id, position)
    }

    for (const position of extraPositions) {
        if (position?.id && !byId.has(position.id)) {
            byId.set(position.id, position)
        }
    }

    positions.value = [...byId.values()]
}

function getChildPositionError(index) {
    return getFieldError(`children.${index}.positionIds`) || getFieldError("children")
}

function addChildGroup() {
    form.children.push({
        id: crypto.randomUUID(),
        code: "",
        name: "",
        positionIds: [],
    })
    clearFieldError("children")
}

function removeChildGroup(index) {
    form.children.splice(index, 1)
    clearFieldError("children")
}

function onAssignmentModeChange() {
    clearFieldError("positionIds")
    clearFieldError("children")

    if (form.assignmentMode === "DIRECT") {
        form.children = []
        return
    }

    form.positionIds = []

    if (form.children.length === 0) {
        addChildGroup()
    }
}

async function loadCompanies() {
    companyLoading.value = true

    try {
        const result = await fetchCompanies({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            search: "",
        })

        companies.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.companyLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        companyLoading.value = false
    }
}

async function loadBranches(companyId = "") {
    branchLoading.value = true

    try {
        const result = await fetchBranches({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            search: "",
        })

        branches.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.branchLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        branchLoading.value = false
    }
}

async function loadDepartments(companyId = "", branchId = "") {
    departmentLoading.value = true

    try {
        const result = await fetchDepartments({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            branchId: branchId || undefined,
            search: "",
        })

        departments.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.departmentLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        departmentLoading.value = false
    }
}

async function loadPositions(params = {}) {
    positionLoading.value = true

    try {
        const result = await fetchPositions({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: params.companyId || undefined,
            branchId: params.branchId || undefined,
            departmentId: params.departmentId || undefined,
            search: params.search || "",
        })

        positions.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.positionLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        positionLoading.value = false
    }
}

async function loadEmployeeTypes(params = {}) {
    try {
        await employeeTypeStore.loadEmployeeTypes(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadEmployeeTypes({
        page: 1,
        limit: employeeTypeStore.filters.limit,
        search: filters.search,
        status: filters.status,
        companyId: filters.companyId || undefined,
        branchId: filters.branchId || undefined,
        departmentId: filters.departmentId || undefined,
        positionId: filters.positionId || undefined,
    })
}

function clearFilters() {
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = ""
    filters.branchId = ""
    filters.departmentId = ""
    filters.positionId = ""

    loadEmployeeTypes({
        page: 1,
        search: "",
        status: "ALL",
        companyId: undefined,
        branchId: undefined,
        departmentId: undefined,
        positionId: undefined,
    })
}

function onPage(event) {
    loadEmployeeTypes({
        page: event.page + 1,
        limit: event.rows,
    })
}

async function onFilterCompanyChange() {
    filters.branchId = ""
    filters.departmentId = ""
    filters.positionId = ""

    await Promise.all([
        loadBranches(filters.companyId),
        loadDepartments(filters.companyId, ""),
        loadPositions({ companyId: filters.companyId }),
    ])

    applyFilters()
}

async function onFilterBranchChange() {
    filters.departmentId = ""
    filters.positionId = ""

    await Promise.all([
        loadDepartments(filters.companyId, filters.branchId),
        loadPositions({
            companyId: filters.companyId,
            branchId: filters.branchId,
        }),
    ])

    applyFilters()
}

async function onFilterDepartmentChange() {
    filters.positionId = ""

    await loadPositions({
        companyId: filters.companyId,
        branchId: filters.branchId,
        departmentId: filters.departmentId,
    })

    applyFilters()
}

async function onFormCompanyChange() {
    form.positionIds = []
    form.children = []
    clearFieldError("companyId")
    clearFieldError("positionIds")
    clearFieldError("children")

    await loadPositions({
        companyId: form.companyId,
    })

    if (form.assignmentMode === "CHILD") {
        addChildGroup()
    }
}

async function openCreateDialog() {
    if (companies.value.length === 0) {
        await loadCompanies()
    }

    dialogMode.value = "create"
    selectedEmployeeTypeId.value = null
    formErrors.value = {}
    assignForm(createEmptyForm())

    if (companies.value.length === 1) {
        form.companyId = companies.value[0].id
        await loadPositions({ companyId: form.companyId })
    } else {
        positions.value = []
    }

    dialogVisible.value = true
}

async function openEditDialog(employeeType) {
    dialogMode.value = "edit"
    selectedEmployeeTypeId.value = employeeType.id
    formErrors.value = {}

    assignForm(employeeType)

    await loadPositions({ companyId: form.companyId })
    mergePositions([
        ...(employeeType.positions || []),
        ...(employeeType.children || []).flatMap((child) => child.positions || []),
    ])

    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedEmployeeTypeId.value = null
    formErrors.value = {}
}

async function saveEmployeeType() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await employeeTypeStore.createEmployeeType(buildCreatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.employeeType.created"),
                detail: t("organization.employeeType.createdDetail"),
                life: 3000,
            })
        } else {
            await employeeTypeStore.updateEmployeeType(
                selectedEmployeeTypeId.value,
                buildUpdatePayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.employeeType.updated"),
                detail: t("organization.employeeType.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadEmployeeTypes()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.employeeType.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(employeeType) {
    archiveCandidate.value = employeeType
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveEmployeeType() {
    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await employeeTypeStore.archiveEmployeeType(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.employeeType.archived"),
            detail: t("organization.employeeType.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadEmployeeTypes()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function downloadSample() {
    try {
        await employeeTypeStore.downloadImportTemplate()

        toast.add({
            severity: "success",
            summary: t("organization.employeeType.sampleDownloaded"),
            detail: t("organization.employeeType.sampleDownloadedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.sampleDownloadFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function exportExcel() {
    try {
        await employeeTypeStore.exportEmployeeTypes()

        toast.add({
            severity: "success",
            summary: t("organization.employeeType.exported"),
            detail: t("organization.employeeType.exportedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.exportFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openImportDialog() {
    selectedImportFile.value = null
    importDialogVisible.value = true
}

function closeImportDialog() {
    if (employeeTypeStore.importing) {
        return
    }

    importDialogVisible.value = false
    selectedImportFile.value = null

    if (fileInputRef.value) {
        fileInputRef.value.value = ""
    }
}

function onImportFileChange(event) {
    const file = event.target.files?.[0]

    if (!file) {
        selectedImportFile.value = null
        return
    }

    selectedImportFile.value = file
}

async function submitImport() {
    if (!selectedImportFile.value) {
        toast.add({
            severity: "warn",
            summary: t("organization.employeeType.importFileRequired"),
            detail: t("organization.employeeType.importFileRequiredDetail"),
            life: 3500,
        })

        return
    }

    try {
        await employeeTypeStore.importEmployeeTypes(selectedImportFile.value)

        importDialogVisible.value = false
        importResultDialogVisible.value = true

        await loadEmployeeTypes()

        toast.add({
            severity:
                employeeTypeStore.importSummary?.errors?.length > 0
                    ? "warn"
                    : "success",
            summary: t("organization.employeeType.importFinished"),
            detail:
                employeeTypeStore.importSummary?.errors?.length > 0
                    ? t("organization.employeeType.importFinishedWithErrors")
                    : t("organization.employeeType.importFinishedSuccess"),
            life: 4500,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.employeeType.importFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function translateImportError(error) {
    const translated = t(error.messageKey)

    return translated === error.messageKey
        ? t("errors.validationFailed")
        : translated
}

watch(
    () => filters.companyId,
    () => {
        if (
            filters.branchId &&
            !branchFilterOptions.value.some(
                (option) => option.value === filters.branchId,
            )
        ) {
            filters.branchId = ""
        }

        if (
            filters.departmentId &&
            !departmentFilterOptions.value.some(
                (option) => option.value === filters.departmentId,
            )
        ) {
            filters.departmentId = ""
        }
    },
)

watch(
    () => filters.branchId,
    () => {
        if (
            filters.departmentId &&
            !departmentFilterOptions.value.some(
                (option) => option.value === filters.departmentId,
            )
        ) {
            filters.departmentId = ""
        }
    },
)

onMounted(async () => {
    await Promise.all([
        loadCompanies(),
        loadBranches(),
        loadDepartments(),
        loadPositions(),
        loadEmployeeTypes(),
    ])
})
</script>

<template>
    <section class="employee-type-page">
        <div class="employee-type-page__header">
            <div>
                <span class="employee-type-page__eyebrow">
                    {{ t("organization.employeeType.eyebrow") }}
                </span>

                <h2>{{ t("organization.employeeType.title") }}</h2>

                <p>
                    {{ t("organization.employeeType.description") }}
                </p>
            </div>

            <div class="employee-type-page__header-actions">
                <Button
                    v-if="canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    :loading="employeeTypeStore.downloadingTemplate"
                    :label="t('organization.employeeType.downloadSample')"
                    @click="downloadSample"
                />

                <Button
                    v-if="canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    :label="t('organization.employeeType.importExcel')"
                    @click="openImportDialog"
                />

                <Button
                    v-if="canExport"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-export"
                    :loading="employeeTypeStore.exporting"
                    :label="t('organization.employeeType.exportExcel')"
                    @click="exportExcel"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('organization.employeeType.newEmployeeType')"
                    @click="openCreateDialog"
                />
            </div>
        </div>

        <Card class="employee-type-card">
            <template #content>
                <div class="employee-type-toolbar">
                    <div class="employee-type-toolbar__filters">
                        <span class="employee-type-search">
                            <i class="pi pi-search" />

                            <InputText
                                v-model="filters.search"
                                class="employee-type-search__input"
                                :placeholder="t('organization.employeeType.searchPlaceholder')"
                                @keyup.enter="applyFilters"
                            />
                        </span>

                        <Select
                            v-model="filters.companyId"
                            class="employee-type-filter"
                            :options="companyFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="companyLoading"
                            @change="onFilterCompanyChange"
                        />

                        <Select
                            v-model="filters.branchId"
                            class="employee-type-filter"
                            :options="branchFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="branchLoading"
                            @change="onFilterBranchChange"
                        />

                        <Select
                            v-model="filters.departmentId"
                            class="employee-type-filter"
                            :options="departmentFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="departmentLoading"
                            @change="onFilterDepartmentChange"
                        />

                        <Select
                            v-model="filters.positionId"
                            class="employee-type-filter"
                            :options="positionFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="positionLoading"
                            @change="applyFilters"
                        />

                        <Select
                            v-model="filters.status"
                            class="employee-type-filter employee-type-filter--status"
                            :options="statusOptions"
                            option-label="label"
                            option-value="value"
                            @change="applyFilters"
                        />
                    </div>

                    <div class="employee-type-toolbar__actions">
                        <Button
                            icon="pi pi-filter"
                            :label="t('common.apply')"
                            @click="applyFilters"
                        />

                        <Button
                            severity="secondary"
                            outlined
                            icon="pi pi-times"
                            :label="t('common.clear')"
                            @click="clearFilters"
                        />

                        <Button
                            severity="secondary"
                            outlined
                            icon="pi pi-refresh"
                            :label="t('common.refresh')"
                            @click="loadEmployeeTypes"
                        />
                    </div>
                </div>

                <div class="employee-type-table-wrap">
                    <DataTable
                        lazy
                        paginator
                        striped-rows
                        data-key="id"
                        size="small"
                        scrollable
                        scroll-height="flex"
                        :value="employeeTypeStore.items"
                        :loading="employeeTypeStore.loading"
                        :rows="employeeTypeStore.pagination.limit"
                        :first="
                            (employeeTypeStore.pagination.page - 1) *
                            employeeTypeStore.pagination.limit
                        "
                        :total-records="employeeTypeStore.pagination.total"
                        :rows-per-page-options="[10, 20, 50, 100]"
                        :empty-message="t('organization.employeeType.empty')"
                        @page="onPage"
                    >
                        <Column
                            field="code"
                            :header="t('organization.employeeType.code')"
                            frozen
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <strong class="employee-type-code">
                                    {{ data.code }}
                                </strong>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.employeeType.employeeTypeName')"
                            style="min-width: 15rem"
                        >
                            <template #body="{ data }">
                                <div class="employee-type-name-cell">
                                    <strong>{{ data.name }}</strong>
                                    <span>{{ data.shortName || "-" }}</span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.employeeType.company')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <div class="employee-type-muted-cell">
                                    <strong>
                                        {{ data.company?.displayName || "-" }}
                                    </strong>
                                    <span>
                                        {{ data.company?.code || "-" }}
                                    </span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.employeeType.structure')"
                            style="min-width: 24rem"
                        >
                            <template #body="{ data }">
                                <div
                                    v-if="(data.children || []).length > 0"
                                    class="employee-type-structure-cell"
                                >
                                    <div
                                        v-for="child in data.children"
                                        :key="child.id"
                                        class="employee-type-child-preview"
                                    >
                                        <strong>{{ child.name }}</strong>
                                        <div class="employee-type-position-tags">
                                            <Tag
                                                v-for="position in (child.positions || []).slice(0, 4)"
                                                :key="position.id"
                                                severity="info"
                                                :value="position.code"
                                            />
                                            <Tag
                                                v-if="(child.positions || []).length > 4"
                                                severity="secondary"
                                                :value="`+${(child.positions || []).length - 4}`"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div
                                    v-else
                                    class="employee-type-position-cell"
                                >
                                    <div class="employee-type-position-tags">
                                        <Tag
                                            v-for="position in (data.positions || []).slice(0, 4)"
                                            :key="position.id"
                                            severity="info"
                                            :value="position.code"
                                        />
                                        <Tag
                                            v-if="(data.positions || []).length > 4"
                                            severity="secondary"
                                            :value="`+${(data.positions || []).length - 4}`"
                                        />
                                    </div>

                                    <span>
                                        {{ getPositionPreview(data.positions) }}
                                    </span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            field="status"
                            :header="t('organization.employeeType.status')"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    :severity="getStatusSeverity(data.status)"
                                    :value="getStatusLabel(data.status)"
                                />
                            </template>
                        </Column>

                        <Column
                            field="updatedAt"
                            :header="t('organization.employeeType.updatedAt')"
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <span class="employee-type-date">
                                    {{ formatDateTime(data.updatedAt) }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('common.actions')"
                            align-frozen="right"
                            frozen
                            style="min-width: 10rem"
                        >
                            <template #body="{ data }">
                                <div class="employee-type-actions">
                                    <Button
                                        v-if="canUpdate && data.status !== 'ARCHIVED'"
                                        size="small"
                                        text
                                        rounded
                                        icon="pi pi-pencil"
                                        :aria-label="t('common.edit')"
                                        @click="openEditDialog(data)"
                                    />

                                    <Button
                                        v-if="canArchive && data.status !== 'ARCHIVED'"
                                        size="small"
                                        text
                                        rounded
                                        severity="danger"
                                        icon="pi pi-archive"
                                        :aria-label="t('common.archive')"
                                        @click="openArchiveDialog(data)"
                                    />

                                    <span
                                        v-if="data.status === 'ARCHIVED'"
                                        class="employee-type-archived-text"
                                    >
                                        {{ t("organization.employeeType.readOnly") }}
                                    </span>
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </template>
        </Card>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            class="employee-type-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="employee-type-form">
                <div class="employee-type-form__section">
                    <span class="employee-type-form__section-title">
                        {{ t("organization.employeeType.basicInfo") }}
                    </span>

                    <div class="employee-type-form__grid">
                        <label class="employee-type-field employee-type-field--wide">
                            <span>{{ t("organization.employeeType.company") }}</span>

                            <Select
                                v-model="form.companyId"
                                :disabled="dialogMode === 'edit'"
                                :invalid="Boolean(getFieldError('companyId'))"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="t('organization.employeeType.selectCompany')"
                                :loading="companyLoading"
                                @change="onFormCompanyChange"
                            />

                            <small v-if="getFieldError('companyId')">
                                {{ getFieldError("companyId") }}
                            </small>
                        </label>

                        <label class="employee-type-field">
                            <span>{{ t("organization.employeeType.code") }}</span>

                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="BLUE_COLLAR"
                                @input="normalizeCodeInput"
                            />

                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="employee-type-field">
                            <span>{{ t("organization.employeeType.shortName") }}</span>

                            <InputText
                                v-model="form.shortName"
                                autocomplete="off"
                                placeholder="Blue Collar"
                            />
                        </label>

                        <label class="employee-type-field employee-type-field--wide">
                            <span>{{ t("organization.employeeType.nameField") }}</span>

                            <InputText
                                v-model="form.name"
                                :invalid="Boolean(getFieldError('name'))"
                                autocomplete="off"
                                placeholder="Blue Collar"
                                @input="clearFieldError('name')"
                            />

                            <small v-if="getFieldError('name')">
                                {{ getFieldError("name") }}
                            </small>
                        </label>

                        <label class="employee-type-field">
                            <span>{{ t("organization.employeeType.assignmentMode") }}</span>

                            <Select
                                v-model="form.assignmentMode"
                                :options="assignmentModeOptions"
                                option-label="label"
                                option-value="value"
                                @change="onAssignmentModeChange"
                            />
                        </label>

                        <label class="employee-type-field">
                            <span>{{ t("organization.employeeType.status") }}</span>

                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label
                            v-if="form.assignmentMode === 'DIRECT'"
                            class="employee-type-field employee-type-field--wide"
                        >
                            <span>{{ t("organization.employeeType.positions") }}</span>

                            <MultiSelect
                                v-model="form.positionIds"
                                display="chip"
                                filter
                                :disabled="!form.companyId"
                                :invalid="Boolean(getFieldError('positionIds'))"
                                :options="positionOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="t('organization.employeeType.selectPositions')"
                                :loading="positionLoading"
                                @change="clearFieldError('positionIds')"
                            />

                            <small v-if="getFieldError('positionIds')">
                                {{ getFieldError("positionIds") }}
                            </small>

                            <small v-else class="employee-type-help-text">
                                {{ t("organization.employeeType.directPositionsHelp") }}
                            </small>
                        </label>

                        <div
                            v-else
                            class="employee-type-field employee-type-field--wide employee-type-child-section"
                        >
                            <div class="employee-type-child-section__header">
                                <div>
                                    <span>{{ t("organization.employeeType.children") }}</span>
                                    <small class="employee-type-help-text">
                                        {{ t("organization.employeeType.childrenHelp") }}
                                    </small>
                                </div>

                                <Button
                                    size="small"
                                    icon="pi pi-plus"
                                    :label="t('organization.employeeType.addChild')"
                                    @click="addChildGroup"
                                />
                            </div>

                            <small v-if="getFieldError('children')">
                                {{ getFieldError("children") }}
                            </small>

                            <div class="employee-type-child-list">
                                <div
                                    v-for="(child, index) in form.children"
                                    :key="child.id"
                                    class="employee-type-child-card"
                                >
                                    <div class="employee-type-child-card__header">
                                        <strong>
                                            {{ t("organization.employeeType.child") }}
                                            {{ index + 1 }}
                                        </strong>

                                        <Button
                                            size="small"
                                            text
                                            rounded
                                            severity="danger"
                                            icon="pi pi-trash"
                                            :aria-label="t('organization.employeeType.removeChild')"
                                            @click="removeChildGroup(index)"
                                        />
                                    </div>

                                    <label class="employee-type-field">
                                        <span>{{ t("organization.employeeType.childName") }}</span>

                                        <InputText
                                            v-model="child.name"
                                            autocomplete="off"
                                            placeholder="Direct"
                                            @input="clearFieldError('children')"
                                        />
                                    </label>

                                    <label class="employee-type-field">
                                        <span>{{ t("organization.employeeType.positions") }}</span>

                                        <MultiSelect
                                            v-model="child.positionIds"
                                            display="chip"
                                            filter
                                            :disabled="!form.companyId"
                                            :invalid="Boolean(getChildPositionError(index))"
                                            :options="positionOptions"
                                            option-label="label"
                                            option-value="value"
                                            :placeholder="t('organization.employeeType.selectPositions')"
                                            :loading="positionLoading"
                                            @change="clearFieldError('children')"
                                        />

                                        <small v-if="getChildPositionError(index)">
                                            {{ getChildPositionError(index) }}
                                        </small>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <label class="employee-type-field employee-type-field--wide">
                            <span>
                                {{ t("organization.employeeType.descriptionLabel") }}
                            </span>

                            <Textarea
                                v-model="form.description"
                                rows="3"
                                auto-resize
                            />
                        </label>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :label="t('common.cancel')"
                    @click="closeDialog"
                />

                <Button
                    icon="pi pi-save"
                    :loading="employeeTypeStore.saving"
                    :label="t('common.save')"
                    @click="saveEmployeeType"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="employee-type-archive-dialog"
            :header="t('organization.employeeType.archiveTitle')"
            :draggable="false"
        >
            <p class="employee-type-archive-text">
                {{
                    t("organization.employeeType.archiveMessage", {
                        name: archiveCandidate?.name || "-",
                    })
                }}
            </p>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :label="t('common.cancel')"
                    @click="closeArchiveDialog"
                />

                <Button
                    severity="danger"
                    icon="pi pi-archive"
                    :loading="employeeTypeStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchiveEmployeeType"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            class="employee-type-import-dialog"
            :header="t('organization.employeeType.importTitle')"
            :draggable="false"
            :closable="!employeeTypeStore.importing"
        >
            <div class="employee-type-import">
                <p>{{ t("organization.employeeType.importDescription") }}</p>

                <input
                    ref="fileInputRef"
                    type="file"
                    accept=".xlsx"
                    :disabled="employeeTypeStore.importing"
                    @change="onImportFileChange"
                />

                <div
                    v-if="selectedImportFile"
                    class="employee-type-import__file"
                >
                    <i class="pi pi-file-excel" />
                    <span>{{ selectedImportFile.name }}</span>
                </div>

                <div
                    v-if="employeeTypeStore.importing"
                    class="employee-type-import__progress"
                >
                    <ProgressBar :value="employeeTypeStore.importProgress" />
                    <span>
                        {{
                            t("organization.employeeType.importProgress", {
                                percent: employeeTypeStore.importProgress,
                            })
                        }}
                    </span>
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :disabled="employeeTypeStore.importing"
                    :label="t('common.cancel')"
                    @click="closeImportDialog"
                />

                <Button
                    icon="pi pi-upload"
                    :loading="employeeTypeStore.importing"
                    :label="t('organization.employeeType.importExcel')"
                    @click="submitImport"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            class="employee-type-import-result-dialog"
            :header="t('organization.employeeType.importResultTitle')"
            :draggable="false"
        >
            <div
                v-if="employeeTypeStore.importSummary"
                class="employee-type-import-result"
            >
                <div class="employee-type-import-result__stats">
                    <div>
                        <span>{{ t("organization.employeeType.totalRows") }}</span>
                        <strong>{{ employeeTypeStore.importSummary.totalRows }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.employeeType.createdRows") }}</span>
                        <strong>{{ employeeTypeStore.importSummary.created }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.employeeType.updatedRows") }}</span>
                        <strong>{{ employeeTypeStore.importSummary.updated }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.employeeType.skippedRows") }}</span>
                        <strong>{{ employeeTypeStore.importSummary.skipped }}</strong>
                    </div>
                </div>

                <div
                    v-if="employeeTypeStore.importSummary.errors?.length"
                    class="employee-type-import-errors"
                >
                    <h4>
                        {{ t("organization.employeeType.validationErrors") }}
                    </h4>

                    <DataTable
                        size="small"
                        :value="employeeTypeStore.importSummary.errors"
                    >
                        <Column
                            field="rowNumber"
                            :header="t('organization.employeeType.rowNumber')"
                        />
                        <Column
                            field="field"
                            :header="t('organization.employeeType.field')"
                        />
                        <Column :header="t('organization.employeeType.issue')">
                            <template #body="{ data }">
                                {{ translateImportError(data) }}
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </div>

            <template #footer>
                <Button
                    :label="t('common.close')"
                    @click="importResultDialogVisible = false"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.employee-type-page {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.employee-type-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.employee-type-page__eyebrow {
    display: inline-flex;
    margin-bottom: 0.45rem;
    color: var(--p-primary-color);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
}

.employee-type-page__header h2 {
    margin: 0;
    color: var(--text-strong);
    font-size: clamp(1.35rem, 2.2vw, 1.85rem);
}

.employee-type-page__header p {
    max-width: 55rem;
    margin: 0.55rem 0 0;
    color: var(--text-muted);
    line-height: 1.6;
}

.employee-type-page__header-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.6rem;
}

.employee-type-card :deep(.p-card-body),
.employee-type-card :deep(.p-card-content) {
    padding: 0;
}

.employee-type-card :deep(.p-card-content) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.employee-type-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem;
    border-bottom: 1px solid var(--border-soft);
}

.employee-type-toolbar__filters {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    gap: 0.65rem;
    min-width: 0;
}

.employee-type-toolbar__actions {
    display: flex;
    flex: 0 0 auto;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.55rem;
}

.employee-type-search {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    min-width: min(100%, 22rem);
    padding: 0 0.75rem;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    background: var(--surface-card);
    color: var(--text-muted);
}

.employee-type-search__input {
    width: 100%;
    border: none;
    box-shadow: none;
}

.employee-type-filter {
    min-width: 13rem;
}

.employee-type-filter--status {
    min-width: 10rem;
}

.employee-type-table-wrap {
    min-height: 26rem;
    padding: 0 1rem 1rem;
}

.employee-type-table-wrap :deep(.p-datatable) {
    font-size: 0.82rem;
}

.employee-type-table-wrap :deep(.p-datatable-thead > tr > th) {
    background: var(--surface-ground);
    color: var(--text-strong);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}

.employee-type-table-wrap :deep(.p-datatable-tbody > tr > td) {
    vertical-align: middle;
}

.employee-type-code {
    color: var(--text-strong);
    font-size: 0.78rem;
    letter-spacing: 0.02em;
}

.employee-type-name-cell,
.employee-type-muted-cell,
.employee-type-position-cell,
.employee-type-structure-cell {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.employee-type-name-cell strong,
.employee-type-muted-cell strong,
.employee-type-child-preview strong {
    color: var(--text-strong);
}

.employee-type-name-cell span,
.employee-type-muted-cell span,
.employee-type-position-cell span,
.employee-type-date {
    color: var(--text-muted);
    font-size: 0.76rem;
}

.employee-type-position-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.employee-type-child-preview {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.35rem 0;
}

.employee-type-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    width: 100%;
}

.employee-type-archived-text {
    color: var(--text-muted);
    font-size: 0.76rem;
    font-weight: 700;
}

.employee-type-dialog {
    width: min(95vw, 54rem);
}

.employee-type-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.employee-type-form__section {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
}

.employee-type-form__section-title {
    color: var(--text-strong);
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.employee-type-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.9rem;
}

.employee-type-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.employee-type-field--wide {
    grid-column: 1 / -1;
}

.employee-type-field > span,
.employee-type-child-section__header span {
    color: var(--text-strong);
    font-size: 0.78rem;
    font-weight: 700;
}

.employee-type-field small {
    color: var(--p-red-500);
    font-size: 0.72rem;
}

.employee-type-field .employee-type-help-text,
.employee-type-help-text {
    color: var(--text-muted);
}

.employee-type-child-section {
    padding: 0.8rem;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-lg);
    background: var(--surface-ground);
}

.employee-type-child-section__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}

.employee-type-child-section__header > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.employee-type-child-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.employee-type-child-card {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
    gap: 0.75rem;
    padding: 0.75rem;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    background: var(--surface-card);
}

.employee-type-child-card__header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.employee-type-archive-dialog,
.employee-type-import-dialog,
.employee-type-import-result-dialog {
    width: min(95vw, 42rem);
}

.employee-type-archive-text,
.employee-type-import p {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.6;
}

.employee-type-import {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.employee-type-import__file {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    padding: 0.55rem 0.75rem;
    border-radius: var(--radius-md);
    background: var(--surface-ground);
    color: var(--text-strong);
    font-size: 0.82rem;
}

.employee-type-import__progress {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.employee-type-import__progress span {
    color: var(--text-muted);
    font-size: 0.78rem;
}

.employee-type-import-result {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.employee-type-import-result__stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
}

.employee-type-import-result__stats div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.8rem;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-md);
    background: var(--surface-ground);
}

.employee-type-import-result__stats span {
    color: var(--text-muted);
    font-size: 0.72rem;
}

.employee-type-import-result__stats strong {
    color: var(--text-strong);
    font-size: 1.2rem;
}

.employee-type-import-errors h4 {
    margin: 0 0 0.6rem;
    color: var(--text-strong);
}

@media (max-width: 960px) {
    .employee-type-page__header {
        flex-direction: column;
    }

    .employee-type-page__header-actions,
    .employee-type-toolbar,
    .employee-type-toolbar__actions {
        width: 100%;
    }

    .employee-type-toolbar {
        flex-direction: column;
    }

    .employee-type-toolbar__filters,
    .employee-type-toolbar__actions {
        display: grid;
        grid-template-columns: 1fr;
    }

    .employee-type-search,
    .employee-type-filter {
        width: 100%;
        min-width: 0;
    }

    .employee-type-form__grid,
    .employee-type-import-result__stats,
    .employee-type-child-card {
        grid-template-columns: 1fr;
    }
}
</style>
