<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"

import InternalCalendarDatePicker from "@/modules/calendar/components/InternalCalendarDatePicker.vue"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchDepartmentsLookup } from "@/modules/organization/services/department.api.js"
import { fetchPositionsLookup } from "@/modules/organization/services/position.api.js"
import { fetchLines } from "@/modules/line/services/line.api.js"
import { fetchShiftLookup } from "@/modules/shift/services/shift.api.js"
import { fetchEmployeeTypes } from "@/modules/employeeType/services/employeeType.api.js"
import { useAttendanceDashboardStore } from "../stores/attendanceDashboard.store.js"

const { t } = useI18n()
const toast = useToast()
const dashboardStore = useAttendanceDashboardStore()

const today = new Date().toISOString().slice(0, 10)

const filters = reactive({
    dateFrom: today,
    dateTo: today,
    search: "",
    status: "ALL",
    companyId: "",
    branchId: "",
    departmentId: "",
    positionId: "",
    lineId: "",
    shiftId: "",
    employeeTypeId: "",
})

const companies = ref([])
const branches = ref([])
const departments = ref([])
const positions = ref([])
const lines = ref([])
const shifts = ref([])
const employeeTypes = ref([])

const lookupLoading = ref(false)

const dashboard = computed(() => dashboardStore.data || {})
const summary = computed(() => dashboard.value.summary || {})
const trend = computed(() => dashboard.value.trend || [])
const statusBreakdown = computed(() => dashboard.value.statusBreakdown || [])
const departmentSummary = computed(() => dashboard.value.departmentSummary || [])
const lineSummary = computed(() => dashboard.value.lineSummary || [])
const shiftSummary = computed(() => dashboard.value.shiftSummary || [])
const needsReviewRecords = computed(() => dashboard.value.needsReviewRecords || [])
const topLateEmployees = computed(() => dashboard.value.topLateEmployees || [])

const companyOptions = computed(() => [
    { label: t("attendanceDashboard.filters.allCompanies"), value: "" },
    ...companies.value.map((item) => ({
        label: `${item.code} - ${item.displayName || item.name || item.legalName}`,
        value: item.id,
    })),
])

const branchOptions = computed(() => [
    { label: t("attendanceDashboard.filters.allBranches"), value: "" },
    ...branches.value
        .filter((item) => !filters.companyId || item.companyId === filters.companyId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const departmentOptions = computed(() => [
    { label: t("attendanceDashboard.filters.allDepartments"), value: "" },
    ...departments.value
        .filter((item) => !filters.companyId || item.companyId === filters.companyId)
        .filter((item) => !filters.branchId || item.branchId === filters.branchId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const positionOptions = computed(() => [
    { label: t("attendanceDashboard.filters.allPositions"), value: "" },
    ...positions.value
        .filter((item) => !filters.companyId || item.companyId === filters.companyId)
        .filter((item) => !filters.branchId || item.branchId === filters.branchId)
        .filter((item) => !filters.departmentId || item.departmentId === filters.departmentId)
        .map((item) => ({
            label: `${item.code} - ${item.title || item.name}`,
            value: item.id,
        })),
])

const lineOptions = computed(() => [
    { label: t("attendanceDashboard.filters.allLines"), value: "" },
    ...lines.value
        .filter((item) => !filters.companyId || item.companyId === filters.companyId)
        .filter((item) => !filters.branchId || item.branchId === filters.branchId)
        .filter((item) => !filters.departmentId || item.departmentId === filters.departmentId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const shiftOptions = computed(() => [
    { label: t("attendanceDashboard.filters.allShifts"), value: "" },
    ...shifts.value
        .filter((item) => !filters.companyId || item.companyId === filters.companyId)
        .filter((item) => !filters.branchId || item.branchId === filters.branchId)
        .map((item) => ({
            label: `${item.code} - ${item.name}`,
            value: item.id,
        })),
])

const employeeTypeOptions = computed(() => [
    { label: t("attendanceDashboard.filters.allEmployeeTypes"), value: "" },
    ...employeeTypes.value.map((item) => ({
        label: `${item.code} - ${item.name}`,
        value: item.id,
    })),
])

const statusOptions = computed(() => [
    { label: t("attendance.status.all"), value: "ALL" },
    { label: t("attendance.status.present"), value: "PRESENT" },
    { label: t("attendance.status.late"), value: "LATE" },
    { label: t("attendance.status.earlyLeave"), value: "EARLY_LEAVE" },
    { label: t("attendance.status.missingIn"), value: "MISSING_IN" },
    { label: t("attendance.status.missingOut"), value: "MISSING_OUT" },
    { label: t("attendance.status.absent"), value: "ABSENT" },
    { label: t("attendance.status.restDay"), value: "REST_DAY" },
    { label: t("attendance.status.holiday"), value: "HOLIDAY" },
])

const summaryCards = computed(() => [
    {
        key: "expectedEmployees",
        label: t("attendanceDashboard.cards.expectedEmployees"),
        value: summary.value.expectedEmployees || 0,
        icon: "pi pi-users",
        tone: "primary",
    },
    {
        key: "processedRecords",
        label: t("attendanceDashboard.cards.processedRecords"),
        value: summary.value.processedRecords || 0,
        icon: "pi pi-database",
        tone: "info",
    },
    {
        key: "present",
        label: t("attendanceDashboard.cards.present"),
        value: summary.value.present || 0,
        icon: "pi pi-check-circle",
        tone: "success",
    },
    {
        key: "absent",
        label: t("attendanceDashboard.cards.absent"),
        value: summary.value.absent || 0,
        icon: "pi pi-times-circle",
        tone: "danger",
    },
    {
        key: "late",
        label: t("attendanceDashboard.cards.late"),
        value: summary.value.late || 0,
        icon: "pi pi-clock",
        tone: "warning",
    },
    {
        key: "earlyLeave",
        label: t("attendanceDashboard.cards.earlyLeave"),
        value: summary.value.earlyLeave || 0,
        icon: "pi pi-sign-out",
        tone: "warning",
    },
    {
        key: "needsReview",
        label: t("attendanceDashboard.cards.needsReview"),
        value: summary.value.needsReview || 0,
        icon: "pi pi-exclamation-triangle",
        tone: "danger",
    },
    {
        key: "holiday",
        label: t("attendanceDashboard.cards.holiday"),
        value: summary.value.holiday || 0,
        icon: "pi pi-calendar-times",
        tone: "info",
    },
])

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)
        return translated === messageKey ? t("errors.internal") : translated
    }

    return t("errors.internal")
}

function getStatusLabel(status) {
    const key = String(status || "").toLowerCase()
    const translated = t(`attendance.status.${key}`)

    return translated === `attendance.status.${key}` ? status || "-" : translated
}

function getStatusSeverity(status) {
    if (status === "PRESENT") return "success"
    if (["LATE", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(status)) return "warn"
    if (["MISSING_IN", "MISSING_OUT", "ABSENT"].includes(status)) return "danger"
    if (["REST_DAY", "HOLIDAY"].includes(status)) return "info"
    return "secondary"
}

function formatDate(value) {
    if (!value) return "-"

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat().format(date)
}

function formatTime(value) {
    if (!value) return "-"

    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? "-"
        : new Intl.DateTimeFormat([], {
              hour: "2-digit",
              minute: "2-digit",
          }).format(date)
}

function formatMinutes(value) {
    const minutes = Number(value || 0)
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60

    if (hours && mins) return `${hours}h ${mins}m`
    if (hours) return `${hours}h`
    return `${mins}m`
}

function getBarWidth(value, total) {
    const safeTotal = Number(total || 0)

    if (!safeTotal) return "0%"

    return `${Math.min(100, Math.round((Number(value || 0) / safeTotal) * 100))}%`
}

function cleanFilters() {
    return Object.entries(filters).reduce((result, [key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
            result[key] = value
        }

        return result
    }, {})
}

async function loadDashboard(force = false) {
    try {
        await dashboardStore.loadDashboard(cleanFilters(), { force })
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("attendanceDashboard.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

async function loadLookups() {
    lookupLoading.value = true

    try {
        const [
            companyItems,
            branchItems,
            departmentItems,
            positionItems,
            lineResult,
            shiftResult,
            employeeTypeResult,
        ] = await Promise.all([
            fetchCompaniesLookup({ status: "ACTIVE" }),
            fetchBranchesLookup({ status: "ACTIVE" }),
            fetchDepartmentsLookup({ status: "ACTIVE" }),
            fetchPositionsLookup({ status: "ACTIVE" }),
            fetchLines({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchShiftLookup({ status: "ACTIVE" }),
            fetchEmployeeTypes({ page: 1, limit: 100, status: "ACTIVE" }),
        ])

        companies.value = companyItems || []
        branches.value = branchItems || []
        departments.value = departmentItems || []
        positions.value = positionItems || []
        lines.value = lineResult.items || []
        shifts.value = shiftResult.items || shiftResult || []
        employeeTypes.value = employeeTypeResult.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("attendanceDashboard.lookupLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        lookupLoading.value = false
    }
}

function clearFilters() {
    filters.dateFrom = today
    filters.dateTo = today
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = ""
    filters.branchId = ""
    filters.departmentId = ""
    filters.positionId = ""
    filters.lineId = ""
    filters.shiftId = ""
    filters.employeeTypeId = ""

    loadDashboard(true)
}

function onCompanyChange() {
    filters.branchId = ""
    filters.departmentId = ""
    filters.positionId = ""
    filters.lineId = ""
    filters.shiftId = ""
}

function onBranchChange() {
    filters.departmentId = ""
    filters.positionId = ""
    filters.lineId = ""
    filters.shiftId = ""
}

function onDepartmentChange() {
    filters.positionId = ""
    filters.lineId = ""
}

onMounted(async () => {
    await Promise.all([loadLookups(), loadDashboard()])
})
</script>

<template>
    <section class="attendance-dashboard-page">
        <div class="attendance-dashboard-page__header">
            <div>
                <span class="attendance-dashboard-page__eyebrow">
                    {{ t("attendanceDashboard.eyebrow") }}
                </span>

                <h1>{{ t("attendanceDashboard.title") }}</h1>

                <p>{{ t("attendanceDashboard.description") }}</p>
            </div>

            <div class="attendance-dashboard-page__actions">
                <Button
                    icon="pi pi-refresh"
                    :label="t('common.refresh')"
                    :loading="dashboardStore.loading"
                    @click="loadDashboard(true)"
                />
            </div>
        </div>

        <Card>
            <template #content>
                <div class="attendance-dashboard-filters">
                    <InputText
                        v-model="filters.search"
                        :placeholder="t('attendanceDashboard.filters.search')"
                        @keyup.enter="loadDashboard(true)"
                    />

                    <InternalCalendarDatePicker
                        v-model="filters.dateFrom"
                        compact
                        :company-id="filters.companyId"
                        :branch-id="filters.branchId"
                        :placeholder="t('attendanceDashboard.filters.dateFrom')"
                    />

                    <InternalCalendarDatePicker
                        v-model="filters.dateTo"
                        compact
                        :company-id="filters.companyId"
                        :branch-id="filters.branchId"
                        :placeholder="t('attendanceDashboard.filters.dateTo')"
                    />

                    <Select
                        v-model="filters.companyId"
                        :loading="lookupLoading"
                        :options="companyOptions"
                        option-label="label"
                        option-value="value"
                        @change="onCompanyChange"
                    />

                    <Select
                        v-model="filters.branchId"
                        :loading="lookupLoading"
                        :options="branchOptions"
                        option-label="label"
                        option-value="value"
                        @change="onBranchChange"
                    />

                    <Select
                        v-model="filters.departmentId"
                        :loading="lookupLoading"
                        :options="departmentOptions"
                        option-label="label"
                        option-value="value"
                        @change="onDepartmentChange"
                    />

                    <Select
                        v-model="filters.positionId"
                        :loading="lookupLoading"
                        :options="positionOptions"
                        option-label="label"
                        option-value="value"
                    />

                    <Select
                        v-model="filters.lineId"
                        :loading="lookupLoading"
                        :options="lineOptions"
                        option-label="label"
                        option-value="value"
                    />

                    <Select
                        v-model="filters.shiftId"
                        :loading="lookupLoading"
                        :options="shiftOptions"
                        option-label="label"
                        option-value="value"
                    />

                    <Select
                        v-model="filters.employeeTypeId"
                        :loading="lookupLoading"
                        :options="employeeTypeOptions"
                        option-label="label"
                        option-value="value"
                    />

                    <Select
                        v-model="filters.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                    />

                    <div class="attendance-dashboard-filters__actions">
                        <Button
                            icon="pi pi-filter"
                            :label="t('common.apply')"
                            :loading="dashboardStore.loading"
                            @click="loadDashboard(true)"
                        />

                        <Button
                            severity="secondary"
                            outlined
                            icon="pi pi-times"
                            :label="t('common.clear')"
                            @click="clearFilters"
                        />
                    </div>
                </div>
            </template>
        </Card>

        <div class="attendance-summary-grid">
            <Card
                v-for="card in summaryCards"
                :key="card.key"
                class="attendance-summary-card"
                :class="`attendance-summary-card--${card.tone}`"
            >
                <template #content>
                    <div class="attendance-summary-card__content">
                        <span class="attendance-summary-card__icon">
                            <i :class="card.icon" />
                        </span>

                        <div>
                            <span>{{ card.label }}</span>
                            <strong>{{ card.value }}</strong>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <div class="attendance-dashboard-grid attendance-dashboard-grid--two">
            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.statusBreakdown") }}
                </template>

                <template #content>
                    <div class="status-breakdown-list">
                        <div
                            v-for="item in statusBreakdown"
                            :key="item.status"
                            class="status-breakdown-row"
                        >
                            <div>
                                <Tag
                                    :value="getStatusLabel(item.status)"
                                    :severity="getStatusSeverity(item.status)"
                                />
                                <strong>{{ item.count }}</strong>
                            </div>

                            <div class="status-bar">
                                <span
                                    :style="{
                                        width: getBarWidth(
                                            item.count,
                                            summary.processedRecords,
                                        ),
                                    }"
                                />
                            </div>
                        </div>
                    </div>
                </template>
            </Card>

            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.dailyTrend") }}
                </template>

                <template #content>
                    <DataTable
                        size="small"
                        :value="trend"
                        :loading="dashboardStore.loading"
                        scrollable
                        scroll-height="22rem"
                    >
                        <Column field="date" :header="t('attendance.date')" />
                        <Column field="present" :header="t('attendanceDashboard.cards.present')" />
                        <Column field="late" :header="t('attendanceDashboard.cards.late')" />
                        <Column field="absent" :header="t('attendanceDashboard.cards.absent')" />
                        <Column field="missing" :header="t('attendanceDashboard.cards.missing')" />
                        <Column field="holiday" :header="t('attendanceDashboard.cards.holiday')" />
                    </DataTable>
                </template>
            </Card>
        </div>

        <div class="attendance-dashboard-grid attendance-dashboard-grid--two">
            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.lineSummary") }}
                </template>

                <template #content>
                    <DataTable
                        size="small"
                        :value="lineSummary"
                        :loading="dashboardStore.loading"
                        scrollable
                        scroll-height="24rem"
                    >
                        <Column :header="t('organization.line.code')">
                            <template #body="{ data }">
                                <strong>{{ data.code }}</strong>
                            </template>
                        </Column>
                        <Column field="name" :header="t('organization.line.lineName')" />
                        <Column field="present" :header="t('attendanceDashboard.cards.present')" />
                        <Column field="absent" :header="t('attendanceDashboard.cards.absent')" />
                        <Column field="late" :header="t('attendanceDashboard.cards.late')" />
                        <Column field="needsReview" :header="t('attendanceDashboard.cards.needsReview')" />
                    </DataTable>
                </template>
            </Card>

            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.departmentSummary") }}
                </template>

                <template #content>
                    <DataTable
                        size="small"
                        :value="departmentSummary"
                        :loading="dashboardStore.loading"
                        scrollable
                        scroll-height="24rem"
                    >
                        <Column :header="t('organization.department.code')">
                            <template #body="{ data }">
                                <strong>{{ data.code }}</strong>
                            </template>
                        </Column>
                        <Column field="name" :header="t('organization.department.name')" />
                        <Column field="present" :header="t('attendanceDashboard.cards.present')" />
                        <Column field="absent" :header="t('attendanceDashboard.cards.absent')" />
                        <Column field="late" :header="t('attendanceDashboard.cards.late')" />
                        <Column field="needsReview" :header="t('attendanceDashboard.cards.needsReview')" />
                    </DataTable>
                </template>
            </Card>
        </div>

        <div class="attendance-dashboard-grid attendance-dashboard-grid--two">
            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.needsReview") }}
                </template>

                <template #content>
                    <DataTable
                        size="small"
                        :value="needsReviewRecords"
                        :loading="dashboardStore.loading"
                        scrollable
                        scroll-height="24rem"
                    >
                        <Column :header="t('attendance.date')">
                            <template #body="{ data }">
                                {{ formatDate(data.attendanceDate) }}
                            </template>
                        </Column>
                        <Column field="employeeCode" :header="t('attendance.employeeId')" />
                        <Column field="employeeName" :header="t('attendance.employeeName')" />
                        <Column :header="t('attendance.statusLabel')">
                            <template #body="{ data }">
                                <Tag
                                    :value="getStatusLabel(data.status)"
                                    :severity="getStatusSeverity(data.status)"
                                />
                            </template>
                        </Column>
                        <Column :header="t('attendance.firstIn')">
                            <template #body="{ data }">
                                {{ formatTime(data.firstInAt) }}
                            </template>
                        </Column>
                        <Column :header="t('attendance.lastOut')">
                            <template #body="{ data }">
                                {{ formatTime(data.lastOutAt) }}
                            </template>
                        </Column>
                    </DataTable>
                </template>
            </Card>

            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.topLateEmployees") }}
                </template>

                <template #content>
                    <DataTable
                        size="small"
                        :value="topLateEmployees"
                        :loading="dashboardStore.loading"
                        scrollable
                        scroll-height="24rem"
                    >
                        <Column field="employeeCode" :header="t('attendance.employeeId')" />
                        <Column field="employeeName" :header="t('attendance.employeeName')" />
                        <Column field="lateDays" :header="t('attendanceDashboard.fields.lateDays')" />
                        <Column :header="t('attendanceDashboard.fields.totalLate')">
                            <template #body="{ data }">
                                {{ formatMinutes(data.totalLateMinutes) }}
                            </template>
                        </Column>
                        <Column :header="t('attendanceDashboard.fields.maxLate')">
                            <template #body="{ data }">
                                {{ formatMinutes(data.maxLateMinutes) }}
                            </template>
                        </Column>
                    </DataTable>
                </template>
            </Card>
        </div>

        <div class="attendance-dashboard-grid attendance-dashboard-grid--two">
            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.shiftSummary") }}
                </template>

                <template #content>
                    <DataTable
                        size="small"
                        :value="shiftSummary"
                        :loading="dashboardStore.loading"
                        scrollable
                        scroll-height="20rem"
                    >
                        <Column field="code" :header="t('organization.shift.code')" />
                        <Column field="name" :header="t('organization.shift.shiftName')" />
                        <Column field="present" :header="t('attendanceDashboard.cards.present')" />
                        <Column field="absent" :header="t('attendanceDashboard.cards.absent')" />
                        <Column field="late" :header="t('attendanceDashboard.cards.late')" />
                    </DataTable>
                </template>
            </Card>

            <Card>
                <template #title>
                    {{ t("attendanceDashboard.sections.minutesSummary") }}
                </template>

                <template #content>
                    <div class="minutes-summary">
                        <div>
                            <span>{{ t("attendanceDashboard.fields.totalWorked") }}</span>
                            <strong>{{ formatMinutes(summary.totalWorkedMinutes) }}</strong>
                        </div>
                        <div>
                            <span>{{ t("attendanceDashboard.fields.totalLate") }}</span>
                            <strong>{{ formatMinutes(summary.totalLateMinutes) }}</strong>
                        </div>
                        <div>
                            <span>{{ t("attendanceDashboard.fields.totalEarlyLeave") }}</span>
                            <strong>{{ formatMinutes(summary.totalEarlyLeaveMinutes) }}</strong>
                        </div>
                        <div>
                            <span>{{ t("attendanceDashboard.fields.presentRate") }}</span>
                            <strong>{{ summary.presentRate || 0 }}%</strong>
                        </div>
                    </div>
                </template>
            </Card>
        </div>
    </section>
</template>

<style scoped>
.attendance-dashboard-page {
    width: 100%;
    display: grid;
    gap: 1rem;
}

.attendance-dashboard-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.attendance-dashboard-page__eyebrow {
    display: inline-flex;
    margin-bottom: 0.35rem;
    color: var(--hrms-color-primary);
    font-size: 0.76rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

.attendance-dashboard-page__header h1 {
    margin: 0;
    font-size: clamp(1.35rem, 2vw, 1.85rem);
}

.attendance-dashboard-page__header p {
    max-width: 58rem;
    margin: 0.45rem 0 0;
    color: var(--hrms-text-muted);
    font-size: 0.9rem;
}

.attendance-dashboard-page__actions {
    display: flex;
    gap: 0.5rem;
}

.attendance-dashboard-filters {
    display: grid;
    grid-template-columns: minmax(13rem, 1.4fr) repeat(4, minmax(11rem, 1fr));
    gap: 0.55rem;
    align-items: start;
}

.attendance-dashboard-filters__actions {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
}

.attendance-summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
}

.attendance-summary-card__content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.attendance-summary-card__icon {
    display: inline-grid;
    place-items: center;
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 0.85rem;
    background: var(--hrms-surface-ground);
    color: var(--hrms-color-primary);
}

.attendance-summary-card__content div {
    display: grid;
    gap: 0.15rem;
}

.attendance-summary-card__content span {
    color: var(--hrms-text-muted);
    font-size: 0.75rem;
    font-weight: 700;
}

.attendance-summary-card__content strong {
    font-size: 1.45rem;
    line-height: 1;
}

.attendance-summary-card--success .attendance-summary-card__icon {
    color: var(--hrms-color-success);
}

.attendance-summary-card--warning .attendance-summary-card__icon {
    color: var(--hrms-color-warning);
}

.attendance-summary-card--danger .attendance-summary-card__icon {
    color: var(--hrms-color-danger);
}

.attendance-dashboard-grid {
    display: grid;
    gap: 1rem;
}

.attendance-dashboard-grid--two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.status-breakdown-list {
    display: grid;
    gap: 0.65rem;
}

.status-breakdown-row {
    display: grid;
    gap: 0.35rem;
}

.status-breakdown-row > div:first-child {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.status-bar {
    height: 0.55rem;
    overflow: hidden;
    border-radius: 999px;
    background: var(--hrms-surface-ground);
}

.status-bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--hrms-color-primary);
}

.minutes-summary {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.minutes-summary div {
    display: grid;
    gap: 0.25rem;
    padding: 1rem;
    border: 1px solid var(--hrms-border-color);
    border-radius: 0.85rem;
    background: var(--hrms-surface-ground);
}

.minutes-summary span {
    color: var(--hrms-text-muted);
    font-size: 0.75rem;
    font-weight: 700;
}

.minutes-summary strong {
    font-size: 1.2rem;
}

:deep(.p-datatable-thead > tr > th),
:deep(.p-datatable-tbody > tr > td) {
    text-align: center;
    vertical-align: middle;
    font-size: 0.78rem;
}

@media (max-width: 1180px) {
    .attendance-dashboard-filters,
    .attendance-summary-grid,
    .attendance-dashboard-grid--two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .attendance-dashboard-page__header {
        flex-direction: column;
    }

    .attendance-dashboard-filters,
    .attendance-summary-grid,
    .attendance-dashboard-grid--two,
    .minutes-summary {
        grid-template-columns: 1fr;
    }

    .attendance-dashboard-filters__actions {
        flex-wrap: wrap;
    }
}
</style>
