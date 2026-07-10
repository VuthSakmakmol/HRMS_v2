<script setup>
import MovementChart from "./MovementChart.vue"

defineProps({
    sectionNumber: {
        type: Number,
        required: true,
    },
    sectionTitle: {
        type: String,
        required: true,
    },
    chartTitle: {
        type: String,
        required: true,
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
    <section class="movement-section">
        <header class="section-title">
            <span class="section-number">{{ sectionNumber }}</span>
            <h2>{{ sectionTitle }}</h2>
        </header>

        <MovementChart
            :title="chartTitle"
            :months="months"
            :selected-month="selectedMonth"
        />
    </section>
</template>

<style scoped>
.section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
}

.section-title h2 {
    margin: 0;
    color: #595959;
    font-size: 1.45rem;
    font-weight: 800;
}

.section-number {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid #002060;
    border-radius: 50%;
    background: #00a9e0;
    color: #ffffff;
    font-size: 1.25rem;
    font-weight: 800;
}
</style>
