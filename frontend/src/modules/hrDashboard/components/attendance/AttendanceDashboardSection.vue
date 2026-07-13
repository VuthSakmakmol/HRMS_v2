<script setup>
import DashboardSectionHeader from "../shared/DashboardSectionHeader.vue"
import AttendanceLineTable from "./AttendanceLineTable.vue"
import AttendanceSummaryTable from "./AttendanceSummaryTable.vue"
import AttendanceTrendChart from "./AttendanceTrendChart.vue"

defineProps({
    title: {
        type: String,
        required: true,
    },
    data: {
        type: Object,
        default: () => ({}),
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})
</script>

<template>
    <section class="dashboard-section">
        <DashboardSectionHeader :title="title" />

        <AttendanceSummaryTable
            :rows="data.monthly || []"
            :selected-period-key="selectedPeriodKey"
        />

        <AttendanceTrendChart
            :rows="data.monthly || []"
            :selected-period-key="selectedPeriodKey"
        />

        <DashboardSectionHeader :title="$t('hrDashboard.sections.attendanceByLine')" />

        <AttendanceLineTable :rows="data.byLine || []" />
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
}
</style>
