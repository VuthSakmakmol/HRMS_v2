<script setup>
import ManpowerChart from "./ManpowerChart.vue"
import ManpowerTable from "./ManpowerTable.vue"

defineProps({
    title: {
        type: String,
        required: true,
    },
    companyLabel: {
        type: String,
        default: "CAMBODIA (TAC)",
    },
    months: {
        type: Array,
        default: () => [],
    },
    selectedMonth: {
        type: Number,
        default: 1,
    },
})
</script>

<template>
    <section class="manpower-section">
        <ManpowerTable
            :title="title"
            :company-label="companyLabel"
            :months="months"
            :selected-month="selectedMonth"
        />

        <ManpowerChart
            :title="`Manpower (${companyLabel.replace(/.*\((.*)\).*/, '$1')})`"
            :months="months"
            :selected-month="selectedMonth"
        />
    </section>
</template>

<style scoped>
.manpower-section {
    display: grid;
    gap: 1rem;
}
</style>
