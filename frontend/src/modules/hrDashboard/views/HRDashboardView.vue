<script setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"

import Message from "primevue/message"
import ProgressSpinner from "primevue/progressspinner"

import AttendanceDashboardSection from "../components/attendance/AttendanceDashboardSection.vue"
import DashboardFilterBar from "../components/shared/DashboardFilterBar.vue"
import GeneralDataSection from "../components/general/GeneralDataSection.vue"
import ManpowerSection from "../components/manpower/ManpowerSection.vue"
import MovementSection from "../components/movement/MovementSection.vue"
import { useHrDashboardStore } from "../stores/hrDashboard.store.js"

const { t } = useI18n()
const dashboardStore = useHrDashboardStore()

const filters = ref(normalizeFilters(dashboardStore.filters))

const dashboard = computed(() => dashboardStore.dashboard || {})
const selectedPeriodKey = computed(
    () => dashboard.value.filters?.selectedPeriodKey || null,
)

function toDateString(value) {
    if (!value) {
        return ""
    }

    if (typeof value === "string") {
        return value.slice(0, 10)
    }

    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return ""
    }

    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function normalizeFilters(value = {}) {
    return {
        ...value,
        startDate: toDateString(value.startDate),
        endDate: toDateString(value.endDate),
    }
}

function createDefaultFilters() {
    const year = new Date().getFullYear()

    return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        companyId: undefined,
        branchId: undefined,
        departmentId: undefined,
        positionId: undefined,
        lineId: undefined,
        employeeTypeId: undefined,
    }
}

async function loadDashboard() {
    await dashboardStore.loadDashboard(filters.value)
}

async function loadLookups(scopeFilters = filters.value) {
    await dashboardStore.loadLookups(scopeFilters)
}

async function handleScopeChange(nextFilters) {
    filters.value = normalizeFilters(nextFilters)

    await loadLookups(filters.value)
}

async function resetFilters() {
    filters.value = createDefaultFilters()

    await Promise.all([
        loadLookups(filters.value),
        dashboardStore.loadDashboard(filters.value),
    ])
}

onMounted(async () => {
    filters.value = normalizeFilters({
        ...createDefaultFilters(),
        ...dashboardStore.filters,
    })

    await Promise.all([
        loadLookups(filters.value),
        loadDashboard(),
    ])
})
</script>

<template>
    <section class="hr-dashboard-page hrms-compact">
        <div class="hr-dashboard-page__sticky-tools">
            <DashboardFilterBar
                v-model="filters"
                :lookups="dashboardStore.lookups"
                :loading="dashboardStore.loading"
                :lookup-loading="dashboardStore.lookupLoading"
                @apply="loadDashboard"
                @reset="resetFilters"
                @refresh="loadDashboard"
                @scope-change="handleScopeChange"
            />
        </div>

        <div class="hr-dashboard-page__body">
            <Message
                v-if="dashboardStore.error"
                severity="error"
                :closable="false"
            >
                {{ t("hrDashboard.loadFailed") }}
            </Message>

            <div
                v-if="dashboardStore.loading && !dashboardStore.dashboard"
                class="hr-dashboard-page__loading"
            >
                <ProgressSpinner />
            </div>

            <main
                v-else
                class="hr-dashboard-page__content"
            >
                <GeneralDataSection :data="dashboard.general" />

                <ManpowerSection
                    :title="t('hrDashboard.sections.sewerManpower')"
                    :rows="dashboard.manpower?.sewer || []"
                    :selected-period-key="selectedPeriodKey"
                />

                <ManpowerSection
                    :title="t('hrDashboard.sections.nonSewerManpower')"
                    :rows="dashboard.manpower?.nonSewer || []"
                    :selected-period-key="selectedPeriodKey"
                />

                <AttendanceDashboardSection
                    :title="t('hrDashboard.sections.attendanceDashboard')"
                    :data="dashboard.attendance || {}"
                    :selected-period-key="selectedPeriodKey"
                />

                <MovementSection
                    :title="t('hrDashboard.sections.sewerMovement')"
                    :rows="dashboard.movement?.sewer || []"
                    :selected-period-key="selectedPeriodKey"
                />

                <MovementSection
                    :title="t('hrDashboard.sections.nonSewerMovement')"
                    :rows="dashboard.movement?.nonSewer || []"
                    :selected-period-key="selectedPeriodKey"
                />

                <MovementSection
                    :title="t('hrDashboard.sections.whiteCollarMovement')"
                    :rows="dashboard.movement?.whiteCollar || []"
                    :selected-period-key="selectedPeriodKey"
                />
            </main>
        </div>
    </section>
</template>

<style scoped>
.hr-dashboard-page {
    display: grid;
    min-width: 0;
    min-height: 100%;
    overflow-x: hidden;
}

.hr-dashboard-page__sticky-tools {
    position: sticky;
    top: 0;
    z-index: 60;
    min-width: 0;
    width: 100%;
    background: var(--hrms-surface);
    border-bottom: 1px solid var(--hrms-border);
    box-shadow: 0 0.35rem 1rem rgb(15 23 42 / 0.06);
}

.hr-dashboard-page__body {
    display: grid;
    gap: 0.65rem;
    min-width: 0;
    padding: 0.65rem 0.875rem 0.875rem;
    overflow-x: hidden;
}

.hr-dashboard-page__content {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.7rem;
    min-width: 0;
    overflow-x: hidden;
}

.hr-dashboard-page__loading {
    display: grid;
    min-height: 16rem;
    place-items: center;
}

.hr-dashboard-page :deep(*) {
    max-width: 100%;
}

@media (max-width: 600px) {
    .hr-dashboard-page__body {
        padding: 0.5rem 0.625rem 0.625rem;
    }
}
</style>
