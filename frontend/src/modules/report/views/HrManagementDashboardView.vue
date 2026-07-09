<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"

import { fetchBranches } from "@/modules/organization/services/branch.api.js"
import { fetchCompanies } from "@/modules/organization/services/company.api.js"
import { fetchDepartments } from "@/modules/organization/services/department.api.js"
import { fetchPositions } from "@/modules/organization/services/position.api.js"
import { fetchEmployeeTypes } from "@/modules/employeeType/services/employeeType.api.js"
import { fetchLines } from "@/modules/line/services/line.api.js"
import { fetchShifts } from "@/modules/shift/services/shift.api.js"

import { useHrDashboardStore } from "../stores/hrDashboard.store.js"

const toast = useToast()
const dashboardStore = useHrDashboardStore()

const today = new Date()
const currentYear = today.getFullYear()
const currentMonth = today.getMonth() + 1

const filtersOpen = ref(true)

const companies = ref([])
const branches = ref([])
const departments = ref([])
const positions = ref([])
const employeeTypes = ref([])
const lines = ref([])
const shifts = ref([])

const filters = reactive({
    companyId: "",
    branchId: "",
    asOfDate: toInputDate(today),
    fromDate: toInputDate(new Date(currentYear, currentMonth - 1, 1)),
    toDate: toInputDate(new Date(currentYear, currentMonth, 0)),
    year: currentYear,
    month: currentMonth,
    departmentId: "",
    employeeTypeId: "",
    employeeTypeChildId: "",
    positionId: "",
    lineId: "",
    shiftId: "",
    gender: "ALL",
    employmentStatus: "ALL",
})

const yearOptions = computed(() => {
    const years = []
    for (let year = currentYear - 3; year <= currentYear + 2; year += 1) {
        years.push({ label: String(year), value: year })
    }
    return years
})

const monthOptions = computed(() => [
    { label: "Jan", value: 1 },
    { label: "Feb", value: 2 },
    { label: "Mar", value: 3 },
    { label: "Apr", value: 4 },
    { label: "May", value: 5 },
    { label: "Jun", value: 6 },
    { label: "Jul", value: 7 },
    { label: "Aug", value: 8 },
    { label: "Sep", value: 9 },
    { label: "Oct", value: 10 },
    { label: "Nov", value: 11 },
    { label: "Dec", value: 12 },
])

const genderOptions = computed(() => [
    { label: "All Genders", value: "ALL" },
    { label: "Male", value: "MALE" },
    { label: "Female", value: "FEMALE" },
    { label: "Other", value: "OTHER" },
    { label: "Unknown", value: "UNKNOWN" },
])

const statusOptions = computed(() => [
    { label: "All Statuses", value: "ALL" },
    { label: "Working", value: "WORKING" },
    { label: "Resigned", value: "RESIGNED" },
    { label: "Terminated", value: "TERMINATED" },
    { label: "Abandoned", value: "ABANDONED" },
    { label: "Retired", value: "RETIRED" },
])

const companyOptions = computed(() => [
    { label: "All Companies", value: "" },
    ...companies.value.map((item) => ({
        label: `${item.code} - ${item.displayName || item.legalName || item.name}`,
        value: item.id,
    })),
])

const branchOptions = computed(() => [
    { label: "All Branches", value: "" },
    ...branches.value
        .filter((item) => !filters.companyId || item.companyId === filters.companyId)
        .map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
])

const departmentOptions = computed(() => [
    { label: "All Departments", value: "" },
    ...departments.value
        .filter((item) => {
            if (filters.companyId && item.companyId !== filters.companyId) return false
            if (filters.branchId && item.branchId !== filters.branchId) return false
            return true
        })
        .map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
])

const positionOptions = computed(() => [
    { label: "All Positions", value: "" },
    ...positions.value
        .filter((item) => {
            if (filters.companyId && item.companyId !== filters.companyId) return false
            if (filters.branchId && item.branchId !== filters.branchId) return false
            if (filters.departmentId && item.departmentId !== filters.departmentId) return false
            return true
        })
        .map((item) => ({ label: `${item.code} - ${item.title || item.name}`, value: item.id })),
])

const employeeTypeOptions = computed(() => [
    { label: "All Employee Types", value: "" },
    ...employeeTypes.value.map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
])

const employeeTypeChildOptions = computed(() => {
    const selectedType = employeeTypes.value.find((item) => item.id === filters.employeeTypeId)
    const children = selectedType?.children || selectedType?.childGroups || []

    return [
        { label: "All Child Groups", value: "" },
        ...children.map((item) => ({
            label: item.code ? `${item.code} - ${item.name}` : item.name,
            value: item.id || item._id,
        })),
    ]
})

const lineOptions = computed(() => [
    { label: "All Lines", value: "" },
    ...lines.value
        .filter((item) => {
            if (filters.companyId && item.companyId !== filters.companyId) return false
            if (filters.branchId && item.branchId !== filters.branchId) return false
            if (filters.departmentId && item.departmentId !== filters.departmentId) return false
            if (filters.positionId && item.positionId && item.positionId !== filters.positionId) return false
            return true
        })
        .map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
])

const shiftOptions = computed(() => [
    { label: "All Shifts", value: "" },
    ...shifts.value
        .filter((item) => {
            if (filters.companyId && item.companyId !== filters.companyId) return false
            if (filters.branchId && item.branchId !== filters.branchId) return false
            return true
        })
        .map((item) => ({ label: `${item.code} - ${item.name}`, value: item.id })),
])

const dashboard = computed(() => dashboardStore.dashboard || {})
const summary = computed(() => dashboard.value.summary || {})
const totalSummary = computed(() => summary.value.total || {})
const selectedSummary = computed(() => summary.value.selected || {})
const selectedMonthSummary = computed(() => summary.value.selectedMonth || {})
const manpowerMonths = computed(() => dashboard.value.manpowerPlan?.months || [])
const movementMonths = computed(() => dashboard.value.movement?.months || [])
const movementSummary = computed(() => dashboard.value.movement?.summary || {})
const recruitment = computed(() => dashboard.value.recruitment || {})
const turnover = computed(() => dashboard.value.turnover || {})
const vacancy = computed(() => dashboard.value.vacancy || {})

const topDepartmentRows = computed(() => (dashboard.value.breakdowns?.byDepartment || []).slice(0, 8))
const topPositionRows = computed(() => (dashboard.value.breakdowns?.byPosition || []).slice(0, 8))
const topLineRows = computed(() => (dashboard.value.breakdowns?.byLine || []).slice(0, 8))

const maxPlanValue = computed(() => {
    const values = manpowerMonths.value.flatMap((item) => [item.targetRoadmap || 0, item.actual || 0])
    return Math.max(1, ...values)
})

const maxMovementValue = computed(() => {
    const values = movementMonths.value.flatMap((item) => [item.in || 0, item.out || 0, Math.abs(item.balance || 0)])
    return Math.max(1, ...values)
})

function toInputDate(value) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return date.toISOString().slice(0, 10)
}

function formatNumber(value, digits = 0) {
    const number = Number(value || 0)
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    }).format(number)
}

function formatPercent(value) {
    return `${formatNumber(value, 1)}%`
}

function varianceClass(value) {
    const number = Number(value || 0)
    if (number < 0) return "negative"
    if (number > 0) return "positive"
    return "neutral"
}

function barWidth(value, max) {
    if (!max) return "0%"
    return `${Math.max(2, Math.min(100, Math.abs(Number(value || 0)) / max * 100))}%`
}

function getErrorMessage(error) {
    return (
        error?.response?.data?.error?.messageKey ||
        error?.response?.data?.message ||
        error?.message ||
        "Please review the entered information."
    )
}

async function loadLookups() {
    try {
        const [companyResult, branchResult, departmentResult, positionResult, employeeTypeResult, lineResult, shiftResult] = await Promise.all([
            fetchCompanies({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchBranches({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchDepartments({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchPositions({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchEmployeeTypes({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchLines({ page: 1, limit: 100, status: "ACTIVE" }),
            fetchShifts({ page: 1, limit: 100, status: "ACTIVE" }),
        ])

        companies.value = companyResult.items || []
        branches.value = branchResult.items || []
        departments.value = departmentResult.items || []
        positions.value = positionResult.items || []
        employeeTypes.value = employeeTypeResult.items || []
        lines.value = lineResult.items || []
        shifts.value = shiftResult.items || []
    } catch (error) {
        toast.add({
            severity: "warn",
            summary: "Some filters failed to load",
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

async function applyFilters() {
    try {
        await dashboardStore.loadDashboard(filters)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: "Unable to load dashboard",
            detail: getErrorMessage(error),
            life: 6000,
        })
    }
}

function resetFilters() {
    filters.companyId = ""
    filters.branchId = ""
    filters.asOfDate = toInputDate(today)
    filters.fromDate = toInputDate(new Date(currentYear, currentMonth - 1, 1))
    filters.toDate = toInputDate(new Date(currentYear, currentMonth, 0))
    filters.year = currentYear
    filters.month = currentMonth
    filters.departmentId = ""
    filters.employeeTypeId = ""
    filters.employeeTypeChildId = ""
    filters.positionId = ""
    filters.lineId = ""
    filters.shiftId = ""
    filters.gender = "ALL"
    filters.employmentStatus = "ALL"
    applyFilters()
}

onMounted(async () => {
    await loadLookups()
    await applyFilters()
})
</script>

<template>
    <section class="hr-dashboard page-shell">
        <div class="page-header">
            <div>
                <span class="page-eyebrow">Reports</span>
                <h2>HR Management Dashboard</h2>
                <p>
                    Filter once and review manpower, plan, movement, recruitment,
                    turnover, and vacancy together for management presentation.
                </p>
            </div>

            <div class="page-header__actions">
                <Button
                    :icon="filtersOpen ? 'pi pi-filter-slash' : 'pi pi-filter'"
                    :label="filtersOpen ? 'Hide Filters' : 'Show Filters'"
                    outlined
                    @click="filtersOpen = !filtersOpen"
                />
                <Button icon="pi pi-refresh" label="Refresh" :loading="dashboardStore.loading" @click="applyFilters" />
            </div>
        </div>

        <Card v-if="filtersOpen" class="filter-card">
            <template #content>
                <div class="filter-grid">
                    <label>
                        <span>Company</span>
                        <Select v-model="filters.companyId" :options="companyOptions" option-label="label" option-value="value" fluid />
                    </label>

                    <label>
                        <span>Branch</span>
                        <Select v-model="filters.branchId" :options="branchOptions" option-label="label" option-value="value" fluid />
                    </label>

                    <label>
                        <span>As Of Date</span>
                        <input v-model="filters.asOfDate" class="plain-input" type="date" />
                    </label>

                    <label>
                        <span>From Date</span>
                        <input v-model="filters.fromDate" class="plain-input" type="date" />
                    </label>

                    <label>
                        <span>To Date</span>
                        <input v-model="filters.toDate" class="plain-input" type="date" />
                    </label>

                    <label>
                        <span>Year</span>
                        <Select v-model="filters.year" :options="yearOptions" option-label="label" option-value="value" fluid />
                    </label>

                    <label>
                        <span>Month</span>
                        <Select v-model="filters.month" :options="monthOptions" option-label="label" option-value="value" fluid />
                    </label>

                    <label>
                        <span>Department</span>
                        <Select v-model="filters.departmentId" :options="departmentOptions" option-label="label" option-value="value" filter fluid />
                    </label>

                    <label>
                        <span>Employee Type</span>
                        <Select v-model="filters.employeeTypeId" :options="employeeTypeOptions" option-label="label" option-value="value" filter fluid />
                    </label>

                    <label>
                        <span>Child Group</span>
                        <Select v-model="filters.employeeTypeChildId" :options="employeeTypeChildOptions" option-label="label" option-value="value" filter fluid />
                    </label>

                    <label>
                        <span>Position</span>
                        <Select v-model="filters.positionId" :options="positionOptions" option-label="label" option-value="value" filter fluid />
                    </label>

                    <label>
                        <span>Line</span>
                        <Select v-model="filters.lineId" :options="lineOptions" option-label="label" option-value="value" filter fluid />
                    </label>

                    <label>
                        <span>Shift</span>
                        <Select v-model="filters.shiftId" :options="shiftOptions" option-label="label" option-value="value" filter fluid />
                    </label>

                    <label>
                        <span>Gender</span>
                        <Select v-model="filters.gender" :options="genderOptions" option-label="label" option-value="value" fluid />
                    </label>

                    <label>
                        <span>Status</span>
                        <Select v-model="filters.employmentStatus" :options="statusOptions" option-label="label" option-value="value" fluid />
                    </label>
                </div>

                <div class="filter-actions">
                    <Button icon="pi pi-filter" label="Apply" :loading="dashboardStore.loading" @click="applyFilters" />
                    <Button icon="pi pi-times" label="Reset" outlined @click="resetFilters" />
                </div>
            </template>
        </Card>

        <ProgressBar v-if="dashboardStore.loading" mode="indeterminate" class="dashboard-progress" />

        <div v-if="dashboard.meta" class="dashboard-meta">
            <Tag severity="info" :value="`As of ${dashboard.meta.asOfDate}`" />
            <Tag severity="secondary" :value="`Period ${dashboard.meta.fromDate} → ${dashboard.meta.toDate}`" />
            <Tag severity="success" :value="`${dashboard.meta.monthLabel} ${dashboard.meta.year}`" />
        </div>

        <div class="kpi-grid">
            <Card class="kpi-card">
                <template #content>
                    <div class="kpi-card__icon"><i class="pi pi-users" /></div>
                    <div class="kpi-card__body">
                        <span>Actual Headcount</span>
                        <strong>{{ formatNumber(selectedSummary.headcount) }}</strong>
                        <small>Total scope: {{ formatNumber(totalSummary.headcount) }}</small>
                    </div>
                </template>
            </Card>

            <Card class="kpi-card">
                <template #content>
                    <div class="kpi-card__icon"><i class="pi pi-calendar-clock" /></div>
                    <div class="kpi-card__body">
                        <span>Avg. Age</span>
                        <strong>{{ formatNumber(selectedSummary.avgAge, 1) }}</strong>
                        <small>Total scope: {{ formatNumber(totalSummary.avgAge, 1) }}</small>
                    </div>
                </template>
            </Card>

            <Card class="kpi-card">
                <template #content>
                    <div class="kpi-card__icon"><i class="pi pi-briefcase" /></div>
                    <div class="kpi-card__body">
                        <span>Years of Service</span>
                        <strong>{{ formatNumber(selectedSummary.avgService, 1) }}</strong>
                        <small>Total scope: {{ formatNumber(totalSummary.avgService, 1) }}</small>
                    </div>
                </template>
            </Card>

            <Card class="kpi-card kpi-card--blue">
                <template #content>
                    <div class="kpi-card__icon"><i class="pi pi-chart-line" /></div>
                    <div class="kpi-card__body">
                        <span>Fill Rate</span>
                        <strong>{{ formatPercent(selectedMonthSummary.fillRate) }}</strong>
                        <small>Roadmap: {{ formatNumber(selectedMonthSummary.targetRoadmap) }}</small>
                    </div>
                </template>
            </Card>

            <Card class="kpi-card">
                <template #content>
                    <div class="kpi-card__icon"><i class="pi pi-sign-in" /></div>
                    <div class="kpi-card__body">
                        <span>Movement In</span>
                        <strong>{{ formatNumber(movementSummary.in) }}</strong>
                        <small>Internal: {{ formatNumber(movementSummary.internal) }}</small>
                    </div>
                </template>
            </Card>

            <Card class="kpi-card">
                <template #content>
                    <div class="kpi-card__icon"><i class="pi pi-sign-out" /></div>
                    <div class="kpi-card__body">
                        <span>Movement Out</span>
                        <strong>{{ formatNumber(movementSummary.out) }}</strong>
                        <small>Balance: {{ formatNumber(movementSummary.balance) }}</small>
                    </div>
                </template>
            </Card>
        </div>

        <div class="dashboard-grid dashboard-grid--main">
            <Card>
                <template #title>Manpower Plan vs Actual</template>
                <template #content>
                    <div class="month-chart">
                        <div v-for="item in manpowerMonths" :key="item.month" class="month-chart__row" :class="{ 'is-selected': item.month === dashboard.meta?.month }">
                            <span class="month-chart__label">{{ item.label }}</span>
                            <div class="month-chart__bars">
                                <span class="bar bar--roadmap" :style="{ width: barWidth(item.targetRoadmap, maxPlanValue) }" />
                                <span class="bar bar--actual" :style="{ width: barWidth(item.actual, maxPlanValue) }" />
                            </div>
                            <strong>{{ formatNumber(item.actual) }}</strong>
                            <small>{{ formatPercent(item.fillRate) }}</small>
                        </div>
                    </div>
                </template>
            </Card>

            <Card>
                <template #title>Movement In / Out</template>
                <template #content>
                    <div class="month-chart movement-chart">
                        <div v-for="item in movementMonths" :key="item.month" class="month-chart__row" :class="{ 'is-selected': item.month === dashboard.meta?.month }">
                            <span class="month-chart__label">{{ item.label }}</span>
                            <div class="month-chart__bars month-chart__bars--triple">
                                <span class="bar bar--in" :style="{ width: barWidth(item.in, maxMovementValue) }" />
                                <span class="bar bar--out" :style="{ width: barWidth(item.out, maxMovementValue) }" />
                                <span class="bar bar--balance" :style="{ width: barWidth(item.balance, maxMovementValue) }" />
                            </div>
                            <strong>{{ formatNumber(item.in) }}/{{ formatNumber(item.out) }}</strong>
                            <small :class="varianceClass(item.balance)">{{ formatNumber(item.balance) }}</small>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <Card>
            <template #title>Monthly Manpower Table</template>
            <template #content>
                <DataTable :value="manpowerMonths" size="small" responsive-layout="scroll" class="compact-table">
                    <Column field="label" header="Month" />
                    <Column header="Budget">
                        <template #body="{ data }">{{ formatNumber(data.targetBudget) }}</template>
                    </Column>
                    <Column header="Roadmap">
                        <template #body="{ data }">{{ formatNumber(data.targetRoadmap) }}</template>
                    </Column>
                    <Column header="Actual">
                        <template #body="{ data }"><strong>{{ formatNumber(data.actual) }}</strong></template>
                    </Column>
                    <Column header="+/- Budget">
                        <template #body="{ data }"><span :class="varianceClass(data.gapBudget)">{{ formatNumber(data.gapBudget) }}</span></template>
                    </Column>
                    <Column header="+/- Roadmap">
                        <template #body="{ data }"><span :class="varianceClass(data.gapRoadmap)">{{ formatNumber(data.gapRoadmap) }}</span></template>
                    </Column>
                    <Column header="Fill Rate">
                        <template #body="{ data }">{{ formatPercent(data.fillRate) }}</template>
                    </Column>
                </DataTable>
            </template>
        </Card>

        <div class="dashboard-grid dashboard-grid--three">
            <Card>
                <template #title>By Department</template>
                <template #content>
                    <div class="rank-list">
                        <div v-for="item in topDepartmentRows" :key="item.id" class="rank-row">
                            <div>
                                <strong>{{ item.label }}</strong>
                                <small>{{ formatPercent(item.percent) }}</small>
                            </div>
                            <span>{{ formatNumber(item.value) }}</span>
                        </div>
                    </div>
                </template>
            </Card>

            <Card>
                <template #title>By Position</template>
                <template #content>
                    <div class="rank-list">
                        <div v-for="item in topPositionRows" :key="item.id" class="rank-row">
                            <div>
                                <strong>{{ item.label }}</strong>
                                <small>{{ formatPercent(item.percent) }}</small>
                            </div>
                            <span>{{ formatNumber(item.value) }}</span>
                        </div>
                    </div>
                </template>
            </Card>

            <Card>
                <template #title>By Line</template>
                <template #content>
                    <div class="rank-list">
                        <div v-for="item in topLineRows" :key="item.id" class="rank-row">
                            <div>
                                <strong>{{ item.label }}</strong>
                                <small>{{ formatPercent(item.percent) }}</small>
                            </div>
                            <span>{{ formatNumber(item.value) }}</span>
                        </div>
                    </div>
                </template>
            </Card>
        </div>

        <div class="dashboard-grid dashboard-grid--main">
            <Card>
                <template #title>Recruitment Channels</template>
                <template #content>
                    <div class="section-summary">
                        <span>Total Hires</span>
                        <strong>{{ formatNumber(recruitment.totalHires) }}</strong>
                    </div>
                    <div class="rank-list">
                        <div v-for="item in recruitment.channels || []" :key="item.label" class="rank-row">
                            <div>
                                <strong>{{ item.label }}</strong>
                                <small>{{ formatPercent(item.percent) }}</small>
                            </div>
                            <span>{{ formatNumber(item.value) }}</span>
                        </div>
                    </div>
                </template>
            </Card>

            <Card>
                <template #title>Turnover</template>
                <template #content>
                    <div class="mini-kpi-row">
                        <div>
                            <span>Exits</span>
                            <strong>{{ formatNumber(turnover.totalExits) }}</strong>
                        </div>
                        <div>
                            <span>Turnover Rate</span>
                            <strong>{{ formatPercent(turnover.turnoverRate) }}</strong>
                        </div>
                        <div>
                            <span>Avg. Headcount</span>
                            <strong>{{ formatNumber(turnover.averageHeadcount, 1) }}</strong>
                        </div>
                    </div>

                    <DataTable :value="turnover.reasons || []" size="small" responsive-layout="scroll" class="compact-table">
                        <Column field="label" header="Reason" />
                        <Column header="Count">
                            <template #body="{ data }">{{ formatNumber(data.value) }}</template>
                        </Column>
                        <Column header="%">
                            <template #body="{ data }">{{ formatPercent(data.percent) }}</template>
                        </Column>
                    </DataTable>
                </template>
            </Card>
        </div>

        <Card>
            <template #title>Vacancy by Position</template>
            <template #content>
                <DataTable :value="vacancy.items || []" size="small" responsive-layout="scroll" class="compact-table">
                    <Column field="label" header="Position" />
                    <Column header="Roadmap">
                        <template #body="{ data }">{{ formatNumber(data.targetRoadmap) }}</template>
                    </Column>
                    <Column header="Actual">
                        <template #body="{ data }">{{ formatNumber(data.actual) }}</template>
                    </Column>
                    <Column header="Vacancy">
                        <template #body="{ data }"><strong>{{ formatNumber(data.vacancy) }}</strong></template>
                    </Column>
                </DataTable>
            </template>
        </Card>

        <div class="future-grid">
            <Card>
                <template #title>Absence Report</template>
                <template #content>
                    <p>Ready to connect after Attendance + Leave modules.</p>
                </template>
            </Card>
            <Card>
                <template #title>Labor Cost / OT Expense</template>
                <template #content>
                    <p>Ready to connect after Payroll + OT payment result modules.</p>
                </template>
            </Card>
        </div>
    </section>
</template>

<style scoped>
.page-shell {
    display: grid;
    gap: 1rem;
    width: 100%;
}

.page-header,
.page-header__actions,
.filter-actions,
.dashboard-meta {
    display: flex;
    align-items: center;
}

.page-header {
    justify-content: space-between;
    gap: 1rem;
}

.page-header h2,
.page-header p {
    margin: 0;
}

.page-header h2 {
    color: var(--hrms-text);
    font-size: 1.45rem;
    line-height: 1.2;
}

.page-header p {
    max-width: 48rem;
    margin-top: 0.35rem;
    color: var(--hrms-text-muted);
    font-size: 0.82rem;
    line-height: 1.55;
}

.page-eyebrow {
    display: block;
    color: var(--hrms-primary);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.page-header__actions,
.filter-actions,
.dashboard-meta {
    gap: 0.5rem;
    flex-wrap: wrap;
}

.filter-card :deep(.p-card-content) {
    display: grid;
    gap: 1rem;
}

.filter-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(10rem, 1fr));
    gap: 0.75rem;
}

.filter-grid label {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
}

.filter-grid label > span {
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.plain-input {
    width: 100%;
    min-height: 2.42rem;
    padding: 0 0.72rem;
    color: var(--hrms-text);
    background: var(--hrms-surface);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
    font: inherit;
}

.dashboard-progress {
    height: 0.35rem;
}

.kpi-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(10rem, 1fr));
    gap: 0.75rem;
}

.kpi-card :deep(.p-card-content) {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.2rem 0;
}

.kpi-card__icon {
    width: 2.5rem;
    height: 2.5rem;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    color: var(--hrms-primary);
    background: color-mix(in srgb, var(--hrms-primary) 12%, transparent);
    border-radius: 999px;
    font-size: 1.15rem;
}

.kpi-card--blue .kpi-card__icon {
    color: #0369a1;
    background: rgb(14 165 233 / 0.14);
}

.kpi-card__body {
    min-width: 0;
}

.kpi-card__body span,
.kpi-card__body small {
    display: block;
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
}

.kpi-card__body strong {
    display: block;
    margin-top: 0.1rem;
    color: var(--hrms-text);
    font-size: 1.45rem;
    line-height: 1.1;
}

.dashboard-grid {
    display: grid;
    gap: 1rem;
}

.dashboard-grid--main {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.dashboard-grid--three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.month-chart {
    display: grid;
    gap: 0.45rem;
}

.month-chart__row {
    display: grid;
    grid-template-columns: 2.4rem minmax(8rem, 1fr) 3.8rem 3.5rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0.45rem;
    border-radius: var(--hrms-radius-md);
}

.month-chart__row.is-selected {
    background: rgb(14 165 233 / 0.1);
    outline: 1px solid rgb(14 165 233 / 0.22);
}

.month-chart__label,
.month-chart__row small {
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
}

.month-chart__row strong {
    color: var(--hrms-text);
    font-size: 0.75rem;
    text-align: right;
}

.month-chart__bars {
    display: grid;
    gap: 0.18rem;
}

.month-chart__bars--triple {
    gap: 0.12rem;
}

.bar {
    display: block;
    height: 0.42rem;
    min-width: 0.5rem;
    border-radius: 999px;
}

.bar--roadmap {
    background: rgb(148 163 184 / 0.6);
}

.bar--actual,
.bar--in {
    background: rgb(14 165 233 / 0.8);
}

.bar--out {
    background: rgb(249 115 22 / 0.78);
}

.bar--balance {
    background: rgb(100 116 139 / 0.55);
}

.compact-table :deep(.p-datatable-thead > tr > th),
.compact-table :deep(.p-datatable-tbody > tr > td) {
    padding: 0.45rem 0.55rem;
    font-size: 0.74rem;
    text-align: center;
}

.compact-table :deep(.p-datatable-thead > tr > th:first-child),
.compact-table :deep(.p-datatable-tbody > tr > td:first-child) {
    text-align: left;
}

.positive {
    color: #15803d;
    font-weight: 800;
}

.negative {
    color: #dc2626;
    font-weight: 800;
}

.neutral {
    color: var(--hrms-text-muted);
    font-weight: 700;
}

.rank-list {
    display: grid;
    gap: 0.45rem;
}

.rank-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.6rem;
    background: var(--hrms-app-background);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.rank-row strong,
.rank-row small {
    display: block;
}

.rank-row strong {
    color: var(--hrms-text);
    font-size: 0.76rem;
}

.rank-row small {
    margin-top: 0.15rem;
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
}

.rank-row > span {
    color: var(--hrms-primary);
    font-weight: 800;
}

.section-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    border-radius: var(--hrms-radius-md);
    background: rgb(14 165 233 / 0.08);
}

.section-summary span {
    color: var(--hrms-text-muted);
    font-size: 0.75rem;
    font-weight: 700;
}

.section-summary strong {
    color: var(--hrms-text);
    font-size: 1.3rem;
}

.mini-kpi-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.6rem;
    margin-bottom: 0.75rem;
}

.mini-kpi-row > div {
    padding: 0.65rem;
    text-align: center;
    background: var(--hrms-app-background);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.mini-kpi-row span,
.mini-kpi-row strong {
    display: block;
}

.mini-kpi-row span {
    color: var(--hrms-text-muted);
    font-size: 0.68rem;
    font-weight: 700;
}

.mini-kpi-row strong {
    margin-top: 0.2rem;
    color: var(--hrms-text);
    font-size: 1.1rem;
}

.future-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
}

.future-grid p {
    margin: 0;
    color: var(--hrms-text-muted);
    font-size: 0.8rem;
}

@media (max-width: 1400px) {
    .filter-grid {
        grid-template-columns: repeat(4, minmax(10rem, 1fr));
    }

    .kpi-grid {
        grid-template-columns: repeat(3, minmax(10rem, 1fr));
    }
}

@media (max-width: 1050px) {
    .filter-grid,
    .dashboard-grid--main,
    .dashboard-grid--three,
    .future-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 680px) {
    .page-header {
        align-items: flex-start;
        flex-direction: column;
    }

    .filter-grid,
    .kpi-grid {
        grid-template-columns: 1fr;
    }

    .month-chart__row {
        grid-template-columns: 2.4rem minmax(7rem, 1fr) 3.5rem;
    }

    .month-chart__row small {
        display: none;
    }
}
</style>
