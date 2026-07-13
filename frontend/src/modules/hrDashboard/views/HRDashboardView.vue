<script setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
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

const filters = ref({
    ...dashboardStore.filters,
})

const dashboard = computed(() => dashboardStore.dashboard || {})
const selectedPeriodKey = computed(
    () => dashboard.value.filters?.selectedPeriodKey || null,
)

function createDefaultFilters() {
    const year = new Date().getFullYear()

    return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31),
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
    filters.value = {
        ...nextFilters,
    }

    await loadLookups(nextFilters)
}

async function resetFilters() {
    filters.value = createDefaultFilters()

    await Promise.all([
        loadLookups(filters.value),
        dashboardStore.loadDashboard(filters.value),
    ])
}

onMounted(async () => {
    await Promise.all([
        loadLookups(),
        loadDashboard(),
    ])
})
</script>

<template>
    <div class="hr-dashboard-page">
        <header class="hr-dashboard-page__header">
            <div>
                <span class="hr-dashboard-page__eyebrow">
                    {{ t("hrDashboard.eyebrow") }}
                </span>

                <h1>{{ t("hrDashboard.title") }}</h1>

                <p>{{ t("hrDashboard.description") }}</p>
            </div>

            <Button
                icon="pi pi-refresh"
                :label="t('common.refresh')"
                severity="secondary"
                outlined
                :loading="dashboardStore.loading"
                @click="loadDashboard"
            />
        </header>

        <DashboardFilterBar
            v-model="filters"
            :lookups="dashboardStore.lookups"
            :loading="dashboardStore.loading"
            :lookup-loading="dashboardStore.lookupLoading"
            @apply="loadDashboard"
            @reset="resetFilters"
            @scope-change="handleScopeChange"
        />

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
</template>

<style scoped>
.hr-dashboard-page {
    display: grid;
    gap: 1rem;
    min-width: 0;
}

.hr-dashboard-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.hr-dashboard-page__eyebrow {
    color: var(--primary-color);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.hr-dashboard-page__header h1 {
    margin: 0.25rem 0 0;
    color: var(--text-color);
    font-size: clamp(1.35rem, 2vw, 2rem);
}

.hr-dashboard-page__header p {
    max-width: 50rem;
    margin: 0.35rem 0 0;
    color: var(--text-color-secondary);
    font-size: 0.82rem;
}

.hr-dashboard-page__content {
    display: grid;
    gap: 1rem;
    min-width: 0;
}

.hr-dashboard-page__loading {
    display: grid;
    min-height: 20rem;
    place-items: center;
}

@media (max-width: 720px) {
    .hr-dashboard-page__header {
        align-items: stretch;
        flex-direction: column;
    }
}
</style>
