<script setup>
import DashboardSectionHeader from "../shared/DashboardSectionHeader.vue"
import ManpowerChart from "./ManpowerChart.vue"
import ManpowerTable from "./ManpowerTable.vue"

defineProps({
    title: {
        type: String,
        required: true,
    },
    rows: {
        type: Array,
        default: () => [],
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

        <ManpowerTable
            :rows="rows"
            :selected-period-key="selectedPeriodKey"
        />

        <ManpowerChart
            :rows="rows"
            :selected-period-key="selectedPeriodKey"
        />
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
}
</style>
