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

import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchDepartmentsLookup } from "@/modules/organization/services/department.api.js"
import { fetchPositionsLookup } from "@/modules/organization/services/position.api.js"

import { useLineStore } from "../stores/line.store.js"

const { t } = useI18n()
const toast = useToast()

const authStore = useAuthStore()
const uiStore = useUiStore()
const lineStore = useLineStore()

const LINE_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.LINE.VIEW",
    CREATE: "ORGANIZATION.LINE.CREATE",
    UPDATE: "ORGANIZATION.LINE.UPDATE",
    ARCHIVE: "ORGANIZATION.LINE.ARCHIVE",
    IMPORT: "ORGANIZATION.LINE.IMPORT",
    EXPORT: "ORGANIZATION.LINE.EXPORT",
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
const selectedLineId = ref(null)

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

const canCreate = computed(() => authStore.hasPermission(LINE_PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(LINE_PERMISSIONS.UPDATE))
const canArchive = computed(() =>
    authStore.hasPermission(LINE_PERMISSIONS.ARCHIVE),
)
const canImport = computed(() => authStore.hasPermission(LINE_PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(LINE_PERMISSIONS.EXPORT))

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.line.createTitle")
        : t("organization.line.editTitle")
})

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: t("organization.line.allCompanies"),
        value: "",
    },
    ...companyOptions.value,
])

const branchOptions = computed(() =>
    branches.value
        .filter((branch) => {
            if (!form.companyId) {
                return true
            }

            return branch.companyId === form.companyId
        })
        .map((branch) => ({
            label: `${branch.code} - ${branch.name}`,
            value: branch.id,
        })),
)

const branchFilterOptions = computed(() => [
    {
        label: t("organization.line.allBranches"),
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

const departmentOptions = computed(() =>
    departments.value
        .filter((department) => {
            if (form.companyId && department.companyId !== form.companyId) {
                return false
            }

            if (form.branchId && department.branchId !== form.branchId) {
                return false
            }

            return true
        })
        .map((department) => ({
            label: `${department.code} - ${department.name}`,
            value: department.id,
        })),
)

const departmentFilterOptions = computed(() => [
    {
        label: t("organization.line.allDepartments"),
        value: "",
    },
    ...departments.value
        .filter((department) => {
            if (
                filters.companyId &&
                department.companyId !== filters.companyId
            ) {
                return false
            }

            if (filters.branchId && department.branchId !== filters.branchId) {
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
    positions.value
        .filter((position) => {
            if (form.companyId && position.companyId !== form.companyId) {
                return false
            }

            if (form.branchId && position.branchId !== form.branchId) {
                return false
            }

            if (
                form.departmentId &&
                position.departmentId !== form.departmentId
            ) {
                return false
            }

            return true
        })
        .map((position) => ({
            label: `${position.code} - ${position.title}`,
            value: position.id,
        })),
)

const positionFilterOptions = computed(() => [
    {
        label: t("organization.line.allPositions"),
        value: "",
    },
    ...positions.value
        .filter((position) => {
            if (
                filters.companyId &&
                position.companyId !== filters.companyId
            ) {
                return false
            }

            if (filters.branchId && position.branchId !== filters.branchId) {
                return false
            }

            if (
                filters.departmentId &&
                position.departmentId !== filters.departmentId
            ) {
                return false
            }

            return true
        })
        .map((position) => ({
            label: `${position.code} - ${position.title}`,
            value: position.id,
        })),
])

const leaderPositionOptions = computed(() => {
    const selectedAllowedIds = form.allowedPositionIds || []

    return [
        {
            label: t("organization.line.noLeaderPosition"),
            value: "",
        },
        ...positionOptions.value.filter((option) => {
            if (selectedAllowedIds.length === 0) {
                return true
            }

            return selectedAllowedIds.includes(option.value)
        }),
    ]
})

const statusOptions = computed(() => [
    {
        label: t("organization.line.statusAll"),
        value: "ALL",
    },
    {
        label: t("organization.line.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.line.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.line.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.line.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.line.statusInactive"),
        value: "INACTIVE",
    },
])

function createEmptyForm() {
    return {
        companyId: "",
        branchId: "",
        departmentId: "",
        code: "",
        name: "",
        shortName: "",
        allowedPositionIds: [],
        leaderPositionId: "",
        description: "",
        status: "ACTIVE",
    }
}

function assignForm(source) {
    const nextForm = source || createEmptyForm()

    form.companyId = nextForm.companyId || ""
    form.branchId = nextForm.branchId || ""
    form.departmentId = nextForm.departmentId || ""
    form.code = nextForm.code || ""
    form.name = nextForm.name || ""
    form.shortName = nextForm.shortName || ""
    form.allowedPositionIds = Array.isArray(nextForm.allowedPositionIds)
        ? [...nextForm.allowedPositionIds]
        : []
    form.leaderPositionId = nextForm.leaderPositionId || ""
    form.description = nextForm.description || ""
    form.status = nextForm.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
}

function buildCreatePayload() {
    return {
        companyId: form.companyId,
        branchId: form.branchId,
        departmentId: form.departmentId,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        allowedPositionIds: form.allowedPositionIds,
        leaderPositionId: form.leaderPositionId || null,
        description: form.description,
        status: form.status,
    }
}

function buildUpdatePayload() {
    return {
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        allowedPositionIds: form.allowedPositionIds,
        leaderPositionId: form.leaderPositionId || null,
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
        return t("organization.line.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.line.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.line.statusArchived")
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

async function loadCompanies() {
    companyLoading.value = true

    try {
        const result = await fetchCompaniesLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            search: "",
        })

        companies.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.companyLoadFailed"),
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
        const result = await fetchBranchesLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            search: "",
        })

        branches.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.branchLoadFailed"),
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
        const result = await fetchDepartmentsLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            branchId: branchId || undefined,
            search: "",
        })

        departments.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.departmentLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        departmentLoading.value = false
    }
}

async function loadPositions(companyId = "", branchId = "", departmentId = "") {
    positionLoading.value = true

    try {
        const result = await fetchPositionsLookup({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            companyId: companyId || undefined,
            branchId: branchId || undefined,
            departmentId: departmentId || undefined,
            search: "",
        })

        positions.value = result || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.positionLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        positionLoading.value = false
    }
}

async function loadLines(params = {}) {
    try {
        await lineStore.loadLines(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadLines({
        page: 1,
        limit: lineStore.filters.limit,
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

    loadLines({
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
    loadLines({
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
        loadPositions(filters.companyId, "", ""),
    ])

    applyFilters()
}

async function onFilterBranchChange() {
    filters.departmentId = ""
    filters.positionId = ""

    await Promise.all([
        loadDepartments(filters.companyId, filters.branchId),
        loadPositions(filters.companyId, filters.branchId, ""),
    ])

    applyFilters()
}

async function onFilterDepartmentChange() {
    filters.positionId = ""

    await loadPositions(
        filters.companyId,
        filters.branchId,
        filters.departmentId,
    )

    applyFilters()
}

async function onFormCompanyChange() {
    form.branchId = ""
    form.departmentId = ""
    form.allowedPositionIds = []
    form.leaderPositionId = ""

    clearFieldError("companyId")

    await Promise.all([
        loadBranches(form.companyId),
        loadDepartments(form.companyId, ""),
        loadPositions(form.companyId, "", ""),
    ])
}

async function onFormBranchChange() {
    form.departmentId = ""
    form.allowedPositionIds = []
    form.leaderPositionId = ""

    clearFieldError("branchId")

    await Promise.all([
        loadDepartments(form.companyId, form.branchId),
        loadPositions(form.companyId, form.branchId, ""),
    ])
}

async function onFormDepartmentChange() {
    form.allowedPositionIds = []
    form.leaderPositionId = ""

    clearFieldError("departmentId")

    await loadPositions(form.companyId, form.branchId, form.departmentId)
}

function onAllowedPositionsChange() {
    clearFieldError("allowedPositionIds")

    if (
        form.leaderPositionId &&
        form.allowedPositionIds.length > 0 &&
        !form.allowedPositionIds.includes(form.leaderPositionId)
    ) {
        form.leaderPositionId = ""
    }
}

async function openCreateDialog() {
    if (companies.value.length === 0) {
        await loadCompanies()
    }

    if (branches.value.length === 0) {
        await loadBranches()
    }

    if (departments.value.length === 0) {
        await loadDepartments()
    }

    if (positions.value.length === 0) {
        await loadPositions()
    }

    dialogMode.value = "create"
    selectedLineId.value = null
    formErrors.value = {}

    assignForm(createEmptyForm())

    if (companies.value.length === 1) {
        form.companyId = companies.value[0].id
        await loadBranches(form.companyId)
        await loadDepartments(form.companyId, "")
        await loadPositions(form.companyId, "", "")
    }

    if (branchOptions.value.length === 1) {
        form.branchId = branchOptions.value[0].value
        await loadDepartments(form.companyId, form.branchId)
        await loadPositions(form.companyId, form.branchId, "")
    }

    if (departmentOptions.value.length === 1) {
        form.departmentId = departmentOptions.value[0].value
        await loadPositions(form.companyId, form.branchId, form.departmentId)
    }

    dialogVisible.value = true
}

async function openEditDialog(line) {
    dialogMode.value = "edit"
    selectedLineId.value = line.id
    formErrors.value = {}

    assignForm(line)

    await Promise.all([
        loadBranches(form.companyId),
        loadDepartments(form.companyId, form.branchId),
        loadPositions(form.companyId, form.branchId, form.departmentId),
    ])

    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedLineId.value = null
    formErrors.value = {}
}

async function saveLine() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await lineStore.createLine(buildCreatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.line.created"),
                detail: t("organization.line.createdDetail"),
                life: 3000,
            })
        } else {
            await lineStore.updateLine(selectedLineId.value, buildUpdatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.line.updated"),
                detail: t("organization.line.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadLines()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.line.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(line) {
    archiveCandidate.value = line
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveLine() {
    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await lineStore.archiveLine(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.line.archived"),
            detail: t("organization.line.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadLines()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function downloadSample() {
    try {
        await lineStore.downloadImportTemplate()

        toast.add({
            severity: "success",
            summary: t("organization.line.sampleDownloaded"),
            detail: t("organization.line.sampleDownloadedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.sampleDownloadFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function exportExcel() {
    try {
        await lineStore.exportLines()

        toast.add({
            severity: "success",
            summary: t("organization.line.exported"),
            detail: t("organization.line.exportedDetail"),
            life: 3000,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.exportFailed"),
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
    if (lineStore.importing) {
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
            summary: t("organization.line.importFileRequired"),
            detail: t("organization.line.importFileRequiredDetail"),
            life: 3500,
        })

        return
    }

    try {
        await lineStore.importLines(selectedImportFile.value)

        importDialogVisible.value = false
        importResultDialogVisible.value = true

        await loadLines()

        toast.add({
            severity:
                lineStore.importSummary?.errors?.length > 0
                    ? "warn"
                    : "success",
            summary: t("organization.line.importFinished"),
            detail:
                lineStore.importSummary?.errors?.length > 0
                    ? t("organization.line.importFinishedWithErrors")
                    : t("organization.line.importFinishedSuccess"),
            life: 4500,
        })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.line.importFailed"),
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

function getAllowedPositionsText(line) {
    if (!line.allowedPositions?.length) {
        return t("organization.line.allDepartmentPositions")
    }

    return line.allowedPositions.map((position) => position.code).join(", ")
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

        if (
            filters.positionId &&
            !positionFilterOptions.value.some(
                (option) => option.value === filters.positionId,
            )
        ) {
            filters.positionId = ""
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

        if (
            filters.positionId &&
            !positionFilterOptions.value.some(
                (option) => option.value === filters.positionId,
            )
        ) {
            filters.positionId = ""
        }
    },
)

watch(
    () => filters.departmentId,
    () => {
        if (
            filters.positionId &&
            !positionFilterOptions.value.some(
                (option) => option.value === filters.positionId,
            )
        ) {
            filters.positionId = ""
        }
    },
)

onMounted(async () => {
    await Promise.all([
        loadCompanies(),
        loadBranches(),
        loadDepartments(),
        loadPositions(),
        loadLines(),
    ])
})
</script>

<template>
    <section class="line-page">
        <div class="line-page__header">
            <div>
                <span class="line-page__eyebrow">
                    {{ t("organization.line.eyebrow") }}
                </span>

                <h2>{{ t("organization.line.title") }}</h2>

                <p>
                    {{ t("organization.line.description") }}
                </p>
            </div>

            <div class="line-page__header-actions">
                <Button
                    v-if="canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-download"
                    :loading="lineStore.downloadingTemplate"
                    :label="t('organization.line.downloadSample')"
                    @click="downloadSample"
                />

                <Button
                    v-if="canImport"
                    severity="secondary"
                    outlined
                    icon="pi pi-upload"
                    :label="t('organization.line.importExcel')"
                    @click="openImportDialog"
                />

                <Button
                    v-if="canExport"
                    severity="secondary"
                    outlined
                    icon="pi pi-file-export"
                    :loading="lineStore.exporting"
                    :label="t('organization.line.exportExcel')"
                    @click="exportExcel"
                />

                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('organization.line.newLine')"
                    @click="openCreateDialog"
                />
            </div>
        </div>

        <Card class="line-card">
            <template #content>
                <div class="line-toolbar">
                    <div class="line-toolbar__filters">
                        <span class="line-search">
                            <i class="pi pi-search" />

                            <InputText
                                v-model="filters.search"
                                class="line-search__input"
                                :placeholder="
                                    t('organization.line.searchPlaceholder')
                                "
                                @keyup.enter="applyFilters"
                            />
                        </span>

                        <Select
                            v-model="filters.companyId"
                            class="line-filter"
                            :options="companyFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="companyLoading"
                            @change="onFilterCompanyChange"
                        />

                        <Select
                            v-model="filters.branchId"
                            class="line-filter"
                            :options="branchFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="branchLoading"
                            @change="onFilterBranchChange"
                        />

                        <Select
                            v-model="filters.departmentId"
                            class="line-filter"
                            :options="departmentFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="departmentLoading"
                            @change="onFilterDepartmentChange"
                        />

                        <Select
                            v-model="filters.positionId"
                            class="line-filter"
                            :options="positionFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="positionLoading"
                            @change="applyFilters"
                        />

                        <Select
                            v-model="filters.status"
                            class="line-status-filter"
                            :options="statusOptions"
                            option-label="label"
                            option-value="value"
                            @change="applyFilters"
                        />
                    </div>

                    <div class="line-toolbar__actions">
                        <Button
                            size="small"
                            icon="pi pi-filter"
                            :label="t('common.apply')"
                            @click="applyFilters"
                        />

                        <Button
                            size="small"
                            severity="secondary"
                            outlined
                            icon="pi pi-times"
                            :label="t('common.clear')"
                            @click="clearFilters"
                        />

                        <Button
                            size="small"
                            severity="secondary"
                            outlined
                            icon="pi pi-refresh"
                            :label="t('common.refresh')"
                            @click="loadLines"
                        />
                    </div>
                </div>

                <div class="line-table-wrap">
                    <DataTable
                        lazy
                        paginator
                        striped-rows
                        data-key="id"
                        size="small"
                        scrollable
                        scroll-height="flex"
                        :value="lineStore.items"
                        :loading="lineStore.loading"
                        :rows="lineStore.pagination.limit"
                        :first="
                            (lineStore.pagination.page - 1) *
                            lineStore.pagination.limit
                        "
                        :total-records="lineStore.pagination.total"
                        :rows-per-page-options="[10, 20, 50, 100]"
                        :empty-message="t('organization.line.empty')"
                        @page="onPage"
                    >
                        <Column
                            field="code"
                            :header="t('organization.line.code')"
                            frozen
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <strong class="line-code">
                                    {{ data.code }}
                                </strong>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.line.lineName')"
                            style="min-width: 15rem"
                        >
                            <template #body="{ data }">
                                <div class="line-name-cell">
                                    <strong>{{ data.name }}</strong>
                                    <span>{{ data.shortName || "-" }}</span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.line.department')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <div class="line-muted-cell">
                                    <strong>
                                        {{ data.department?.name || "-" }}
                                    </strong>
                                    <span>
                                        {{ data.department?.code || "-" }}
                                    </span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.line.branch')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <div class="line-muted-cell">
                                    <strong>
                                        {{ data.branch?.name || "-" }}
                                    </strong>
                                    <span>
                                        {{ data.branch?.code || "-" }}
                                    </span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.line.allowedPositions')"
                            style="min-width: 18rem"
                        >
                            <template #body="{ data }">
                                <span class="line-positions-text">
                                    {{ getAllowedPositionsText(data) }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.line.leaderPosition')"
                            style="min-width: 14rem"
                        >
                            <template #body="{ data }">
                                <div
                                    v-if="data.leaderPosition"
                                    class="line-muted-cell"
                                >
                                    <strong>
                                        {{ data.leaderPosition.title }}
                                    </strong>
                                    <span>
                                        {{ data.leaderPosition.code }}
                                    </span>
                                </div>

                                <span v-else class="line-muted-text">
                                    {{
                                        t(
                                            "organization.line.noLeaderPosition",
                                        )
                                    }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            field="status"
                            :header="t('organization.line.status')"
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
                            :header="t('organization.line.updatedAt')"
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <span class="line-date">
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
                                <div class="line-actions">
                                    <Button
                                        v-if="
                                            canUpdate &&
                                            data.status !== 'ARCHIVED'
                                        "
                                        size="small"
                                        text
                                        rounded
                                        icon="pi pi-pencil"
                                        :aria-label="t('common.edit')"
                                        @click="openEditDialog(data)"
                                    />

                                    <Button
                                        v-if="
                                            canArchive &&
                                            data.status !== 'ARCHIVED'
                                        "
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
                                        class="line-archived-text"
                                    >
                                        {{ t("organization.line.readOnly") }}
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
            class="line-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="line-form">
                <div class="line-form__section">
                    <h3>{{ t("organization.line.basicInfo") }}</h3>

                    <div class="line-form__grid">
                        <label class="line-field">
                            <span>{{ t("organization.line.company") }}</span>

                            <Select
                                v-model="form.companyId"
                                :disabled="dialogMode === 'edit'"
                                :invalid="Boolean(getFieldError('companyId'))"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.line.selectCompany')
                                "
                                :loading="companyLoading"
                                @change="onFormCompanyChange"
                            />

                            <small v-if="getFieldError('companyId')">
                                {{ getFieldError("companyId") }}
                            </small>
                        </label>

                        <label class="line-field">
                            <span>{{ t("organization.line.branch") }}</span>

                            <Select
                                v-model="form.branchId"
                                :disabled="
                                    dialogMode === 'edit' || !form.companyId
                                "
                                :invalid="Boolean(getFieldError('branchId'))"
                                :options="branchOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.line.selectBranch')
                                "
                                :loading="branchLoading"
                                @change="onFormBranchChange"
                            />

                            <small v-if="getFieldError('branchId')">
                                {{ getFieldError("branchId") }}
                            </small>
                        </label>

                        <label class="line-field">
                            <span>{{ t("organization.line.department") }}</span>

                            <Select
                                v-model="form.departmentId"
                                :disabled="
                                    dialogMode === 'edit' || !form.branchId
                                "
                                :invalid="
                                    Boolean(getFieldError('departmentId'))
                                "
                                :options="departmentOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.line.selectDepartment')
                                "
                                :loading="departmentLoading"
                                @change="onFormDepartmentChange"
                            />

                            <small v-if="getFieldError('departmentId')">
                                {{ getFieldError("departmentId") }}
                            </small>
                        </label>

                        <label class="line-field">
                            <span>{{ t("organization.line.code") }}</span>

                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="LINE_A"
                                @input="normalizeCodeInput"
                            />

                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="line-field">
                            <span>{{ t("organization.line.lineName") }}</span>

                            <InputText
                                v-model="form.name"
                                :invalid="Boolean(getFieldError('name'))"
                                autocomplete="off"
                                placeholder="Sewing Line A"
                                @input="clearFieldError('name')"
                            />

                            <small v-if="getFieldError('name')">
                                {{ getFieldError("name") }}
                            </small>
                        </label>

                        <label class="line-field">
                            <span>{{ t("organization.line.shortName") }}</span>

                            <InputText
                                v-model="form.shortName"
                                autocomplete="off"
                                placeholder="Line A"
                            />
                        </label>

                        <label class="line-field line-field--wide">
                            <span>
                                {{ t("organization.line.allowedPositions") }}
                            </span>

                            <MultiSelect
                                v-model="form.allowedPositionIds"
                                :disabled="!form.departmentId"
                                :options="positionOptions"
                                option-label="label"
                                option-value="value"
                                display="chip"
                                :placeholder="
                                    t(
                                        'organization.line.selectAllowedPositions',
                                    )
                                "
                                :loading="positionLoading"
                                @change="onAllowedPositionsChange"
                            />

                            <small>
                                {{
                                    t(
                                        "organization.line.allowedPositionsHelp",
                                    )
                                }}
                            </small>
                        </label>

                        <label class="line-field">
                            <span>
                                {{ t("organization.line.leaderPosition") }}
                            </span>

                            <Select
                                v-model="form.leaderPositionId"
                                :disabled="!form.departmentId"
                                :options="leaderPositionOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.line.selectLeaderPosition')
                                "
                                :loading="positionLoading"
                            />
                        </label>

                        <label class="line-field">
                            <span>{{ t("organization.line.status") }}</span>

                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label class="line-field line-field--wide">
                            <span>
                                {{ t("organization.line.descriptionLabel") }}
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
                    :loading="lineStore.saving"
                    :label="t('common.save')"
                    @click="saveLine"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="line-archive-dialog"
            :header="t('organization.line.archiveTitle')"
            :draggable="false"
        >
            <p class="line-archive-text">
                {{
                    t("organization.line.archiveMessage", {
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
                    :loading="lineStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchiveLine"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            class="line-import-dialog"
            :header="t('organization.line.importTitle')"
            :draggable="false"
            :closable="!lineStore.importing"
        >
            <div class="line-import">
                <p>
                    {{ t("organization.line.importDescription") }}
                </p>

                <input
                    ref="fileInputRef"
                    type="file"
                    accept=".xlsx"
                    :disabled="lineStore.importing"
                    @change="onImportFileChange"
                />

                <div v-if="selectedImportFile" class="line-import__file">
                    <i class="pi pi-file-excel" />
                    <span>{{ selectedImportFile.name }}</span>
                </div>

                <div v-if="lineStore.importing" class="line-import__progress">
                    <ProgressBar :value="lineStore.importProgress" />

                    <span>
                        {{
                            t("organization.line.importProgress", {
                                percent: lineStore.importProgress,
                            })
                        }}
                    </span>
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :disabled="lineStore.importing"
                    :label="t('common.cancel')"
                    @click="closeImportDialog"
                />

                <Button
                    icon="pi pi-upload"
                    :loading="lineStore.importing"
                    :label="t('organization.line.importExcel')"
                    @click="submitImport"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importResultDialogVisible"
            modal
            class="line-import-result-dialog"
            :header="t('organization.line.importResultTitle')"
            :draggable="false"
        >
            <div v-if="lineStore.importSummary" class="line-import-result">
                <div class="line-import-result__grid">
                    <div>
                        <span>{{ t("organization.line.totalRows") }}</span>
                        <strong>{{ lineStore.importSummary.totalRows }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.line.createdRows") }}</span>
                        <strong>{{ lineStore.importSummary.created }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.line.updatedRows") }}</span>
                        <strong>{{ lineStore.importSummary.updated }}</strong>
                    </div>

                    <div>
                        <span>{{ t("organization.line.skippedRows") }}</span>
                        <strong>{{ lineStore.importSummary.skipped }}</strong>
                    </div>
                </div>

                <div
                    v-if="lineStore.importSummary.errors?.length"
                    class="line-import-result__errors"
                >
                    <h4>{{ t("organization.line.validationErrors") }}</h4>

                    <DataTable
                        size="small"
                        :value="lineStore.importSummary.errors"
                    >
                        <Column
                            field="rowNumber"
                            :header="t('organization.line.rowNumber')"
                            style="width: 7rem"
                        />

                        <Column
                            field="field"
                            :header="t('organization.line.field')"
                            style="width: 12rem"
                        />

                        <Column :header="t('organization.line.issue')">
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
.line-page {
    width: 100%;
    display: grid;
    gap: 1rem;
}

.line-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.line-page__header-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.line-page__eyebrow {
    display: inline-flex;
    margin-bottom: 0.35rem;
    color: var(--hrms-color-primary);
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.line-page__header h2 {
    margin: 0;
    font-size: clamp(1.35rem, 2vw, 1.85rem);
}

.line-page__header p {
    max-width: 54rem;
    margin: 0.45rem 0 0;
    color: var(--hrms-text-muted);
    font-size: 0.9rem;
}

.line-card {
    min-width: 0;
}

.line-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.85rem;
}

.line-toolbar__filters {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    min-width: 0;
}

.line-toolbar__actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.line-search {
    min-width: 16rem;
    flex: 1;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--hrms-border-color);
    border-radius: 0.85rem;
    padding: 0 0.75rem;
    background: var(--hrms-surface-ground);
}

.line-search i {
    color: var(--hrms-text-muted);
}

.line-search__input {
    width: 100%;
    border: 0;
    background: transparent;
    box-shadow: none;
}

.line-filter {
    width: 12rem;
}

.line-status-filter {
    width: 10rem;
}

.line-table-wrap {
    min-height: 34rem;
    height: calc(100vh - 18rem);
}

.line-code {
    color: var(--hrms-color-primary);
    font-size: 0.82rem;
}

.line-name-cell,
.line-muted-cell {
    display: grid;
    gap: 0.15rem;
    line-height: 1.25;
}

.line-name-cell strong,
.line-muted-cell strong {
    font-size: 0.82rem;
}

.line-name-cell span,
.line-muted-cell span,
.line-muted-text,
.line-date,
.line-positions-text {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.line-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.15rem;
    width: 100%;
}

.line-archived-text {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.line-dialog {
    width: min(60rem, calc(100vw - 2rem));
}

.line-form {
    display: grid;
    gap: 1rem;
}

.line-form__section {
    border: 1px solid var(--hrms-border-color);
    border-radius: 1rem;
    padding: 1rem;
    background: var(--hrms-surface-ground);
}

.line-form__section h3 {
    margin: 0 0 0.85rem;
    font-size: 0.95rem;
}

.line-form__grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.85rem;
}

.line-field {
    display: grid;
    gap: 0.35rem;
}

.line-field--wide {
    grid-column: 1 / -1;
}

.line-field > span {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
    font-weight: 700;
}

.line-field small {
    color: var(--hrms-color-danger);
    font-size: 0.72rem;
}

.line-field--wide small {
    color: var(--hrms-text-muted);
}

.line-archive-dialog,
.line-import-dialog,
.line-import-result-dialog {
    width: min(44rem, calc(100vw - 2rem));
}

.line-archive-text {
    margin: 0;
    color: var(--hrms-text-muted);
}

.line-import {
    display: grid;
    gap: 1rem;
}

.line-import p {
    margin: 0;
    color: var(--hrms-text-muted);
}

.line-import__file {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    border: 1px dashed var(--hrms-border-color);
    border-radius: 0.85rem;
    color: var(--hrms-text-muted);
}

.line-import__progress {
    display: grid;
    gap: 0.45rem;
}

.line-import__progress span {
    color: var(--hrms-text-muted);
    font-size: 0.78rem;
}

.line-import-result {
    display: grid;
    gap: 1rem;
}

.line-import-result__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
}

.line-import-result__grid div {
    display: grid;
    gap: 0.25rem;
    padding: 0.85rem;
    border: 1px solid var(--hrms-border-color);
    border-radius: 0.85rem;
    background: var(--hrms-surface-ground);
}

.line-import-result__grid span {
    color: var(--hrms-text-muted);
    font-size: 0.76rem;
}

.line-import-result__grid strong {
    font-size: 1.35rem;
}

.line-import-result__errors {
    display: grid;
    gap: 0.65rem;
}

.line-import-result__errors h4 {
    margin: 0;
}

:deep(.p-datatable-thead > tr > th),
:deep(.p-datatable-tbody > tr > td) {
    text-align: center;
    vertical-align: middle;
    font-size: 0.78rem;
}

@media (max-width: 1100px) {
    .line-page__header,
    .line-toolbar {
        flex-direction: column;
    }

    .line-page__header-actions,
    .line-toolbar__actions {
        justify-content: flex-start;
    }

    .line-filter,
    .line-status-filter {
        width: min(100%, 14rem);
    }

    .line-form__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .line-search,
    .line-filter,
    .line-status-filter {
        width: 100%;
        min-width: 0;
    }

    .line-form__grid,
    .line-import-result__grid {
        grid-template-columns: 1fr;
    }

    .line-table-wrap {
        height: 32rem;
    }
}
</style>