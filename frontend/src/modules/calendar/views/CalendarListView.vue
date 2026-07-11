<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Checkbox from "primevue/checkbox"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"

import InternalCalendarDatePicker from "../components/InternalCalendarDatePicker.vue"
import { useCalendarStore } from "../stores/calendar.store.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const uiStore = useUiStore()
const calendarStore = useCalendarStore()

const PERMISSIONS = Object.freeze({
    CREATE: "CALENDAR.DAY.CREATE",
    UPDATE: "CALENDAR.DAY.UPDATE",
    ARCHIVE: "CALENDAR.DAY.ARCHIVE",
    IMPORT: "CALENDAR.DAY.IMPORT",
    EXPORT: "CALENDAR.DAY.EXPORT",
})

const companies = ref([])
const branches = ref([])
const companyLoading = ref(false)
const branchLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedDayId = ref(null)
const formErrors = ref({})
const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)
const importDialogVisible = ref(false)
const importResultDialogVisible = ref(false)
const selectedImportFile = ref(null)
const fileInputRef = ref(null)

const filters = reactive({
    search: "",
    status: "ALL",
    scopeLevel: "ALL",
    dayType: "ALL",
    startDate: "",
    endDate: "",
    companyId: "",
    branchId: "",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() => authStore.hasPermission(PERMISSIONS.CREATE))
const canUpdate = computed(() => authStore.hasPermission(PERMISSIONS.UPDATE))
const canArchive = computed(() => authStore.hasPermission(PERMISSIONS.ARCHIVE))
const canImport = computed(() => authStore.hasPermission(PERMISSIONS.IMPORT))
const canExport = computed(() => authStore.hasPermission(PERMISSIONS.EXPORT))

const dialogTitle = computed(() =>
    dialogMode.value === "create"
        ? t("organization.calendar.day.createTitle")
        : t("organization.calendar.day.editTitle"),
)

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    { label: t("organization.calendar.day.allCompanies"), value: "" },
    ...companyOptions.value,
])

const branchOptions = computed(() =>
    branches.value
        .filter((branch) => !form.companyId || branch.companyId === form.companyId)
        .map((branch) => ({ label: `${branch.code} - ${branch.name}`, value: branch.id })),
)

const branchFilterOptions = computed(() => [
    { label: t("organization.calendar.day.allBranches"), value: "" },
    ...branches.value
        .filter((branch) => !filters.companyId || branch.companyId === filters.companyId)
        .map((branch) => ({ label: `${branch.code} - ${branch.name}`, value: branch.id })),
])

const scopeOptions = computed(() => [
    { label: t("organization.calendar.scope.ALL"), value: "ALL" },
    { label: t("organization.calendar.scope.GLOBAL"), value: "GLOBAL" },
    { label: t("organization.calendar.scope.COMPANY"), value: "COMPANY" },
    { label: t("organization.calendar.scope.BRANCH"), value: "BRANCH" },
])

const createScopeOptions = computed(() => scopeOptions.value.filter((item) => item.value !== "ALL"))

const dayTypeOptions = computed(() => [
    { label: t("organization.calendar.dayTypes.ALL"), value: "ALL" },
    { label: t("organization.calendar.dayTypes.WORKING_DAY"), value: "WORKING_DAY" },
    { label: t("organization.calendar.dayTypes.WEEKEND"), value: "WEEKEND" },
    { label: t("organization.calendar.dayTypes.HOLIDAY"), value: "HOLIDAY" },
    { label: t("organization.calendar.dayTypes.SPECIAL_WORKING_DAY"), value: "SPECIAL_WORKING_DAY" },
    { label: t("organization.calendar.dayTypes.COMPANY_EVENT"), value: "COMPANY_EVENT" },
    { label: t("organization.calendar.dayTypes.CLOSED_DAY"), value: "CLOSED_DAY" },
])

const createDayTypeOptions = computed(() => dayTypeOptions.value.filter((item) => item.value !== "ALL"))

const statusOptions = computed(() => [
    { label: t("organization.calendar.status.ALL"), value: "ALL" },
    { label: t("organization.calendar.status.ACTIVE"), value: "ACTIVE" },
    { label: t("organization.calendar.status.INACTIVE"), value: "INACTIVE" },
    { label: t("organization.calendar.status.ARCHIVED"), value: "ARCHIVED" },
])

const editableStatusOptions = computed(() => statusOptions.value.filter((item) => ["ACTIVE", "INACTIVE"].includes(item.value)))

function createEmptyForm() {
    return {
        scopeLevel: "GLOBAL",
        companyId: "",
        branchId: "",
        dateKey: "",
        dayType: "HOLIDAY",
        name: "",
        holidayCategory: "",
        isPaidHoliday: false,
        description: "",
        status: "ACTIVE",
    }
}

function assignForm(source) {
    const data = source || createEmptyForm()
    form.scopeLevel = data.scopeLevel || "GLOBAL"
    form.companyId = data.companyId || ""
    form.branchId = data.branchId || ""
    form.dateKey = data.dateKey || ""
    form.dayType = data.dayType || "HOLIDAY"
    form.name = data.name || ""
    form.holidayCategory = data.holidayCategory || ""
    form.isPaidHoliday = Boolean(data.isPaidHoliday)
    form.description = data.description || ""
    form.status = data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
}

function buildCreatePayload() {
    return {
        scopeLevel: form.scopeLevel,
        companyId: form.scopeLevel !== "GLOBAL" ? form.companyId : undefined,
        branchId: form.scopeLevel === "BRANCH" ? form.branchId : undefined,
        dateKey: form.dateKey,
        dayType: form.dayType,
        name: form.name,
        holidayCategory: form.holidayCategory,
        isPaidHoliday: form.isPaidHoliday,
        description: form.description,
        status: form.status,
    }
}

function buildUpdatePayload() {
    return {
        dayType: form.dayType,
        name: form.name,
        holidayCategory: form.holidayCategory,
        isPaidHoliday: form.isPaidHoliday,
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
                  return translated === messageKey ? t("errors.validationFailed") : translated
              })
            : [t("errors.validationFailed")]
    }
    formErrors.value = nextErrors
}

function getFieldError(fieldName) {
    return formErrors.value[fieldName]?.[0] || ""
}

function getStatusSeverity(status) {
    if (status === "ACTIVE") return "success"
    if (status === "INACTIVE") return "warn"
    if (status === "ARCHIVED") return "danger"
    return "secondary"
}

function getDayTypeSeverity(dayType) {
    if (["WORKING_DAY", "SPECIAL_WORKING_DAY", "COMPANY_EVENT"].includes(dayType)) return "success"
    if (dayType === "WEEKEND") return "warn"
    return "danger"
}

function formatDateTime(value) {
    if (!value) return "-"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "-"
    return new Intl.DateTimeFormat(uiStore.locale, { dateStyle: "medium", timeStyle: "short" }).format(date)
}

async function loadCompanies() {
    companyLoading.value = true
    try {
        const result = await fetchCompaniesLookup({ page: 1, limit: 100, status: "ACTIVE", search: "" })
        companies.value = result || []
    } finally {
        companyLoading.value = false
    }
}

async function loadBranches(companyId = "") {
    branchLoading.value = true
    try {
        const result = await fetchBranchesLookup({ page: 1, limit: 100, status: "ACTIVE", companyId: companyId || undefined, search: "" })
        branches.value = result || []
    } finally {
        branchLoading.value = false
    }
}

async function loadCalendarDays(params = {}) {
    try {
        await calendarStore.loadCalendarDays(params)
    } catch (error) {
        toast.add({ severity: "error", summary: t("organization.calendar.day.loadFailed"), detail: getErrorMessage(error), life: 4500 })
    }
}

function applyFilters() {
    loadCalendarDays({
        page: 1,
        limit: calendarStore.filters.limit,
        search: filters.search,
        status: filters.status,
        scopeLevel: filters.scopeLevel,
        dayType: filters.dayType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: filters.companyId || undefined,
        branchId: filters.branchId || undefined,
    })
}

function clearFilters() {
    Object.assign(filters, { search: "", status: "ALL", scopeLevel: "ALL", dayType: "ALL", startDate: "", endDate: "", companyId: "", branchId: "" })
    loadCalendarDays({ page: 1, search: "", status: "ALL", scopeLevel: "ALL", dayType: "ALL", startDate: "", endDate: "", companyId: undefined, branchId: undefined })
}

function onPage(event) {
    loadCalendarDays({ page: event.page + 1, limit: event.rows })
}

async function onFilterCompanyChange() {
    filters.branchId = ""
    await loadBranches(filters.companyId)
    applyFilters()
}

async function onFormCompanyChange() {
    form.branchId = ""
    await loadBranches(form.companyId)
}

function onFormScopeChange() {
    if (form.scopeLevel === "GLOBAL") {
        form.companyId = ""
        form.branchId = ""
    }
    if (form.scopeLevel === "COMPANY") {
        form.branchId = ""
    }
}

async function openCreateDialog() {
    dialogMode.value = "create"
    selectedDayId.value = null
    formErrors.value = {}
    assignForm(createEmptyForm())
    if (!companies.value.length) await loadCompanies()
    if (!branches.value.length) await loadBranches()
    dialogVisible.value = true
}

async function openEditDialog(day) {
    dialogMode.value = "edit"
    selectedDayId.value = day.id
    formErrors.value = {}
    assignForm(day)
    if (day.companyId) await loadBranches(day.companyId)
    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedDayId.value = null
    formErrors.value = {}
}

async function saveCalendarDay() {
    formErrors.value = {}
    try {
        if (dialogMode.value === "create") {
            await calendarStore.createCalendarDay(buildCreatePayload())
            toast.add({ severity: "success", summary: t("organization.calendar.day.created"), life: 3000 })
        } else {
            await calendarStore.updateCalendarDay(selectedDayId.value, buildUpdatePayload())
            toast.add({ severity: "success", summary: t("organization.calendar.day.updated"), life: 3000 })
        }
        closeDialog()
        await loadCalendarDays()
    } catch (error) {
        applyBackendFieldErrors(error)
        toast.add({ severity: "error", summary: t("organization.calendar.day.saveFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

function openArchiveDialog(day) {
    archiveCandidate.value = day
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveDay() {
    if (!archiveCandidate.value?.id) return
    try {
        await calendarStore.archiveCalendarDay(archiveCandidate.value.id)
        toast.add({ severity: "success", summary: t("organization.calendar.day.archived"), life: 3000 })
        closeArchiveDialog()
        await loadCalendarDays()
    } catch (error) {
        toast.add({ severity: "error", summary: t("organization.calendar.day.archiveFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

async function downloadSample() {
    try {
        await calendarStore.downloadImportTemplate()
        toast.add({ severity: "success", summary: t("organization.calendar.day.sampleDownloaded"), life: 3000 })
    } catch (error) {
        toast.add({ severity: "error", summary: t("organization.calendar.day.sampleDownloadFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

async function exportExcel() {
    try {
        await calendarStore.exportCalendarDays()
        toast.add({ severity: "success", summary: t("organization.calendar.day.exported"), life: 3000 })
    } catch (error) {
        toast.add({ severity: "error", summary: t("organization.calendar.day.exportFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

function openImportDialog() {
    selectedImportFile.value = null
    importDialogVisible.value = true
}

function closeImportDialog() {
    if (calendarStore.importing) return
    importDialogVisible.value = false
    selectedImportFile.value = null
    if (fileInputRef.value) fileInputRef.value.value = ""
}

function onImportFileChange(event) {
    selectedImportFile.value = event.target.files?.[0] || null
}

async function submitImport() {
    if (!selectedImportFile.value) {
        toast.add({ severity: "warn", summary: t("organization.calendar.day.importFileRequired"), life: 3500 })
        return
    }
    try {
        await calendarStore.importCalendarDays(selectedImportFile.value)
        importDialogVisible.value = false
        importResultDialogVisible.value = true
        await loadCalendarDays()
    } catch (error) {
        toast.add({ severity: "error", summary: t("organization.calendar.day.importFailed"), detail: getErrorMessage(error), life: 5000 })
    }
}

function translateImportError(error) {
    const translated = t(error.messageKey)
    return translated === error.messageKey ? t("errors.validationFailed") : translated
}

watch(() => filters.companyId, () => {
    if (filters.branchId && !branchFilterOptions.value.some((option) => option.value === filters.branchId)) filters.branchId = ""
})

onMounted(async () => {
    await Promise.all([loadCompanies(), loadBranches(), loadCalendarDays()])
})
</script>

<template>
    <section class="calendar-page">
        <div class="calendar-page__header">
            <div>
                <span class="calendar-page__eyebrow">{{ t("organization.calendar.day.eyebrow") }}</span>
                <h2>{{ t("organization.calendar.day.title") }}</h2>
                <p>{{ t("organization.calendar.day.description") }}</p>
            </div>
            <div class="calendar-page__header-actions">
                <Button v-if="canImport" severity="secondary" outlined icon="pi pi-download" :loading="calendarStore.downloadingTemplate" :label="t('organization.calendar.day.downloadSample')" @click="downloadSample" />
                <Button v-if="canImport" severity="secondary" outlined icon="pi pi-upload" :label="t('organization.calendar.day.importExcel')" @click="openImportDialog" />
                <Button v-if="canExport" severity="secondary" outlined icon="pi pi-file-export" :loading="calendarStore.exporting" :label="t('organization.calendar.day.exportExcel')" @click="exportExcel" />
                <Button v-if="canCreate" icon="pi pi-plus" :label="t('organization.calendar.day.newDay')" @click="openCreateDialog" />
            </div>
        </div>

        <Card class="calendar-card">
            <template #content>
                <div class="calendar-toolbar">
                    <div class="calendar-toolbar__filters">
                        <span class="calendar-search"><i class="pi pi-search" /><InputText v-model="filters.search" class="calendar-search__input" :placeholder="t('organization.calendar.day.searchPlaceholder')" @keyup.enter="applyFilters" /></span>
                        <InternalCalendarDatePicker v-model="filters.startDate" :show-status="false" />
                        <InternalCalendarDatePicker v-model="filters.endDate" :show-status="false" />
                        <Select v-model="filters.companyId" class="calendar-filter" :options="companyFilterOptions" option-label="label" option-value="value" :loading="companyLoading" @change="onFilterCompanyChange" />
                        <Select v-model="filters.branchId" class="calendar-filter" :options="branchFilterOptions" option-label="label" option-value="value" :loading="branchLoading" @change="applyFilters" />
                        <Select v-model="filters.scopeLevel" class="calendar-filter-small" :options="scopeOptions" option-label="label" option-value="value" @change="applyFilters" />
                        <Select v-model="filters.dayType" class="calendar-filter" :options="dayTypeOptions" option-label="label" option-value="value" @change="applyFilters" />
                        <Select v-model="filters.status" class="calendar-filter-small" :options="statusOptions" option-label="label" option-value="value" @change="applyFilters" />
                    </div>
                    <div class="calendar-toolbar__actions">
                        <Button size="small" icon="pi pi-filter" :label="t('common.apply')" @click="applyFilters" />
                        <Button size="small" severity="secondary" outlined icon="pi pi-times" :label="t('common.clear')" @click="clearFilters" />
                        <Button size="small" severity="secondary" outlined icon="pi pi-refresh" :label="t('common.refresh')" @click="loadCalendarDays" />
                    </div>
                </div>

                <div class="calendar-table-wrap">
                    <DataTable lazy paginator striped-rows data-key="id" size="small" scrollable scroll-height="flex" :value="calendarStore.items" :loading="calendarStore.loading" :rows="calendarStore.pagination.limit" :first="(calendarStore.pagination.page - 1) * calendarStore.pagination.limit" :total-records="calendarStore.pagination.total" :rows-per-page-options="[10,20,50,100]" :empty-message="t('organization.calendar.day.empty')" @page="onPage">
                        <Column field="dateKey" :header="t('organization.calendar.day.date')" frozen style="min-width: 9rem"><template #body="{ data }"><strong class="calendar-code">{{ data.dateKey }}</strong></template></Column>
                        <Column :header="t('organization.calendar.day.name')" style="min-width: 16rem"><template #body="{ data }"><div class="calendar-name-cell"><strong>{{ data.name }}</strong><span>{{ data.holidayCategory || '-' }}</span></div></template></Column>
                        <Column :header="t('organization.calendar.day.dayType')" style="min-width: 13rem"><template #body="{ data }"><Tag :severity="getDayTypeSeverity(data.dayType)" :value="t(`organization.calendar.dayTypes.${data.dayType}`)" /></template></Column>
                        <Column :header="t('organization.calendar.day.scope')" style="min-width: 12rem"><template #body="{ data }"><div class="calendar-muted-cell"><strong>{{ t(`organization.calendar.scope.${data.scopeLevel}`) }}</strong><span>{{ data.branch?.code || data.company?.code || '-' }}</span></div></template></Column>
                        <Column :header="t('organization.calendar.day.paidHoliday')" style="min-width: 9rem"><template #body="{ data }"><Tag :severity="data.isPaidHoliday ? 'success' : 'secondary'" :value="data.isPaidHoliday ? t('common.yes') : t('common.no')" /></template></Column>
                        <Column field="status" :header="t('organization.calendar.day.status')" style="min-width: 9rem"><template #body="{ data }"><Tag :severity="getStatusSeverity(data.status)" :value="t(`organization.calendar.status.${data.status}`)" /></template></Column>
                        <Column field="updatedAt" :header="t('organization.calendar.day.updatedAt')" style="min-width: 11rem"><template #body="{ data }"><span class="calendar-date">{{ formatDateTime(data.updatedAt) }}</span></template></Column>
                        <Column :header="t('common.actions')" align-frozen="right" frozen style="min-width: 10rem"><template #body="{ data }"><div class="calendar-actions"><Button v-if="canUpdate && data.status !== 'ARCHIVED'" size="small" text rounded icon="pi pi-pencil" @click="openEditDialog(data)" /><Button v-if="canArchive && data.status !== 'ARCHIVED'" size="small" text rounded severity="danger" icon="pi pi-archive" @click="openArchiveDialog(data)" /><span v-if="data.status === 'ARCHIVED'" class="calendar-archived-text">{{ t('organization.calendar.day.readOnly') }}</span></div></template></Column>
                    </DataTable>
                </div>
            </template>
        </Card>

        <Dialog v-model:visible="dialogVisible" modal class="calendar-dialog" :header="dialogTitle" :draggable="false">
            <div class="calendar-form">
                <label class="calendar-field"><span>{{ t('organization.calendar.day.scope') }}</span><Select v-model="form.scopeLevel" :disabled="dialogMode === 'edit'" :options="createScopeOptions" option-label="label" option-value="value" @change="onFormScopeChange" /></label>
                <label v-if="form.scopeLevel !== 'GLOBAL'" class="calendar-field"><span>{{ t('organization.calendar.day.company') }}</span><Select v-model="form.companyId" :disabled="dialogMode === 'edit'" :options="companyOptions" option-label="label" option-value="value" :loading="companyLoading" @change="onFormCompanyChange" /><small v-if="getFieldError('companyId')">{{ getFieldError('companyId') }}</small></label>
                <label v-if="form.scopeLevel === 'BRANCH'" class="calendar-field"><span>{{ t('organization.calendar.day.branch') }}</span><Select v-model="form.branchId" :disabled="dialogMode === 'edit' || !form.companyId" :options="branchOptions" option-label="label" option-value="value" :loading="branchLoading" /><small v-if="getFieldError('branchId')">{{ getFieldError('branchId') }}</small></label>
                <label class="calendar-field"><span>{{ t('organization.calendar.day.date') }}</span><InternalCalendarDatePicker v-model="form.dateKey" :company-id="form.companyId" :branch-id="form.branchId" :disabled="dialogMode === 'edit'" /><small v-if="getFieldError('dateKey')">{{ getFieldError('dateKey') }}</small></label>
                <label class="calendar-field"><span>{{ t('organization.calendar.day.dayType') }}</span><Select v-model="form.dayType" :options="createDayTypeOptions" option-label="label" option-value="value" /></label>
                <label class="calendar-field"><span>{{ t('organization.calendar.day.name') }}</span><InputText v-model="form.name" /><small v-if="getFieldError('name')">{{ getFieldError('name') }}</small></label>
                <label class="calendar-field"><span>{{ t('organization.calendar.day.category') }}</span><InputText v-model="form.holidayCategory" /></label>
                <label class="calendar-field calendar-field--inline"><Checkbox v-model="form.isPaidHoliday" binary /><span>{{ t('organization.calendar.day.paidHoliday') }}</span></label>
                <label class="calendar-field"><span>{{ t('organization.calendar.day.status') }}</span><Select v-model="form.status" :options="editableStatusOptions" option-label="label" option-value="value" /></label>
                <label class="calendar-field calendar-field--wide"><span>{{ t('organization.calendar.day.descriptionLabel') }}</span><Textarea v-model="form.description" rows="3" auto-resize /></label>
            </div>
            <template #footer><Button severity="secondary" outlined :label="t('common.cancel')" @click="closeDialog" /><Button icon="pi pi-save" :loading="calendarStore.saving" :label="t('common.save')" @click="saveCalendarDay" /></template>
        </Dialog>

        <Dialog v-model:visible="archiveDialogVisible" modal class="calendar-archive-dialog" :header="t('organization.calendar.day.archiveTitle')" :draggable="false"><p class="calendar-archive-text">{{ t('organization.calendar.day.archiveMessage', { name: archiveCandidate?.name || '-' }) }}</p><template #footer><Button severity="secondary" outlined :label="t('common.cancel')" @click="closeArchiveDialog" /><Button severity="danger" icon="pi pi-archive" :loading="calendarStore.archiving" :label="t('common.archive')" @click="confirmArchiveDay" /></template></Dialog>

        <Dialog v-model:visible="importDialogVisible" modal class="calendar-import-dialog" :header="t('organization.calendar.day.importTitle')" :draggable="false" :closable="!calendarStore.importing"><div class="calendar-import"><p>{{ t('organization.calendar.day.importDescription') }}</p><input ref="fileInputRef" type="file" accept=".xlsx" :disabled="calendarStore.importing" @change="onImportFileChange" /><div v-if="selectedImportFile" class="calendar-import__file"><i class="pi pi-file-excel" /><span>{{ selectedImportFile.name }}</span></div><div v-if="calendarStore.importing" class="calendar-import__progress"><ProgressBar :value="calendarStore.importProgress" /><span>{{ t('organization.calendar.day.importProgress', { percent: calendarStore.importProgress }) }}</span></div></div><template #footer><Button severity="secondary" outlined :disabled="calendarStore.importing" :label="t('common.cancel')" @click="closeImportDialog" /><Button icon="pi pi-upload" :loading="calendarStore.importing" :label="t('organization.calendar.day.importExcel')" @click="submitImport" /></template></Dialog>

        <Dialog v-model:visible="importResultDialogVisible" modal class="calendar-import-result-dialog" :header="t('organization.calendar.day.importResultTitle')" :draggable="false"><div v-if="calendarStore.importSummary" class="calendar-import-result"><div class="calendar-import-result__grid"><div><span>{{ t('organization.calendar.day.totalRows') }}</span><strong>{{ calendarStore.importSummary.totalRows }}</strong></div><div><span>{{ t('organization.calendar.day.createdRows') }}</span><strong>{{ calendarStore.importSummary.created }}</strong></div><div><span>{{ t('organization.calendar.day.updatedRows') }}</span><strong>{{ calendarStore.importSummary.updated }}</strong></div><div><span>{{ t('organization.calendar.day.skippedRows') }}</span><strong>{{ calendarStore.importSummary.skipped }}</strong></div></div><div v-if="calendarStore.importSummary.errors?.length" class="calendar-import-result__errors"><h4>{{ t('organization.calendar.day.validationErrors') }}</h4><DataTable size="small" :value="calendarStore.importSummary.errors"><Column field="rowNumber" :header="t('organization.calendar.day.rowNumber')" style="width:7rem" /><Column field="field" :header="t('organization.calendar.day.field')" style="width:12rem" /><Column :header="t('organization.calendar.day.issue')"><template #body="{ data }">{{ translateImportError(data) }}</template></Column></DataTable></div></div><template #footer><Button :label="t('common.close')" @click="importResultDialogVisible = false" /></template></Dialog>
    </section>
</template>

<style scoped>
.calendar-page{width:100%;display:grid;gap:1rem}.calendar-page__header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.calendar-page__header-actions{display:flex;align-items:center;justify-content:flex-end;gap:.5rem;flex-wrap:wrap}.calendar-page__eyebrow{display:inline-flex;margin-bottom:.35rem;color:var(--hrms-color-primary);font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.calendar-page__header h2{margin:0;font-size:clamp(1.35rem,2vw,1.85rem)}.calendar-page__header p{max-width:54rem;margin:.45rem 0 0;color:var(--hrms-text-muted);font-size:.9rem}.calendar-card{min-width:0}.calendar-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:.85rem}.calendar-toolbar__filters{flex:1;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;min-width:0}.calendar-toolbar__actions{display:flex;align-items:center;justify-content:flex-end;gap:.5rem;flex-wrap:wrap}.calendar-search{min-width:16rem;flex:1;display:inline-flex;align-items:center;gap:.5rem;border:1px solid var(--hrms-border-color);border-radius:.85rem;padding:0 .75rem;background:var(--hrms-surface-ground)}.calendar-search i{color:var(--hrms-text-muted)}.calendar-search__input{width:100%;border:0;background:transparent;box-shadow:none}.calendar-filter{width:13rem}.calendar-filter-small{width:10rem}.calendar-table-wrap{min-height:34rem;height:calc(100vh - 18rem)}.calendar-code{color:var(--hrms-color-primary);font-size:.82rem}.calendar-name-cell,.calendar-muted-cell{display:grid;gap:.15rem;line-height:1.25}.calendar-name-cell strong,.calendar-muted-cell strong{font-size:.82rem}.calendar-name-cell span,.calendar-muted-cell span,.calendar-date{color:var(--hrms-text-muted);font-size:.76rem}.calendar-actions{display:inline-flex;align-items:center;justify-content:center;gap:.15rem;width:100%}.calendar-archived-text{color:var(--hrms-text-muted);font-size:.76rem}.calendar-dialog{width:min(58rem,calc(100vw - 2rem))}.calendar-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.85rem}.calendar-field{display:grid;gap:.35rem}.calendar-field--wide{grid-column:1/-1}.calendar-field--inline{display:flex;align-items:center;gap:.5rem;padding-top:1.45rem}.calendar-field>span{color:var(--hrms-text-muted);font-size:.76rem;font-weight:700}.calendar-field small{color:var(--hrms-color-danger);font-size:.72rem}.calendar-archive-dialog,.calendar-import-dialog,.calendar-import-result-dialog{width:min(44rem,calc(100vw - 2rem))}.calendar-archive-text{margin:0;color:var(--hrms-text-muted)}.calendar-import{display:grid;gap:1rem}.calendar-import p{margin:0;color:var(--hrms-text-muted)}.calendar-import__file{display:inline-flex;align-items:center;gap:.5rem;padding:.65rem .75rem;border:1px dashed var(--hrms-border-color);border-radius:.85rem;color:var(--hrms-text-muted)}.calendar-import__progress{display:grid;gap:.45rem}.calendar-import__progress span{color:var(--hrms-text-muted);font-size:.78rem}.calendar-import-result{display:grid;gap:1rem}.calendar-import-result__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.75rem}.calendar-import-result__grid div{display:grid;gap:.25rem;padding:.85rem;border:1px solid var(--hrms-border-color);border-radius:.85rem;background:var(--hrms-surface-ground)}.calendar-import-result__grid span{color:var(--hrms-text-muted);font-size:.76rem}.calendar-import-result__grid strong{font-size:1.35rem}.calendar-import-result__errors{display:grid;gap:.65rem}.calendar-import-result__errors h4{margin:0}:deep(.p-datatable-thead>tr>th),:deep(.p-datatable-tbody>tr>td){text-align:center;vertical-align:middle;font-size:.78rem}@media(max-width:1100px){.calendar-page__header,.calendar-toolbar{flex-direction:column}.calendar-page__header-actions,.calendar-toolbar__actions{justify-content:flex-start}.calendar-filter,.calendar-filter-small{width:min(100%,14rem)}.calendar-form{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.calendar-search,.calendar-filter,.calendar-filter-small{width:100%;min-width:0}.calendar-form,.calendar-import-result__grid{grid-template-columns:1fr}.calendar-table-wrap{height:32rem}}
</style>
