<script setup>
import { computed } from "vue"

const props = defineProps({
    title: {
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

const maxValue = computed(() => {
    const values = props.months.flatMap((month) => [month.targetRoadmap, month.actual])
    return Math.max(1, ...values.map((value) => Number(value || 0)))
})

function barHeight(value) {
    return `${Math.max(0, Number(value || 0) / maxValue.value * 100)}%`
}
</script>

<template>
    <div class="chart-shell">
        <h3>{{ title }}</h3>

        <div class="chart-body">
            <div
                v-for="month in months"
                :key="month.month"
                class="month-column"
                :class="{ selected: month.month === selectedMonth }"
            >
                <div class="plot-area">
                    <div class="bar-pair">
                        <div
                            class="bar roadmap-bar"
                            :style="{ height: barHeight(month.targetRoadmap) }"
                        >
                            <span>{{ month.targetRoadmap }}</span>
                        </div>
                        <div
                            class="bar actual-bar"
                            :style="{ height: barHeight(month.actual) }"
                        >
                            <span>{{ month.actual }}</span>
                        </div>
                    </div>
                    <span class="fill-rate">{{ month.fillRate.toFixed(1) }}%</span>
                </div>
                <span class="month-label">{{ month.label }}</span>
            </div>
        </div>

        <div class="chart-legend">
            <span><i class="roadmap-dot" />Target Roadmap (1)</span>
            <span><i class="actual-dot" />Actual (2)</span>
            <span><i class="fill-dot" />Fill rate</span>
        </div>
    </div>
</template>

<style scoped>
.chart-shell {
    padding: 0.65rem 1rem 0.8rem;
    border: 1px solid #000000;
    background: #ffffff;
}

h3 {
    margin: 0 0 0.5rem;
    color: #595959;
    font-size: 1.25rem;
    font-weight: 500;
    text-align: center;
}

.chart-body {
    display: grid;
    min-width: 800px;
    height: 18rem;
    grid-template-columns: repeat(12, 1fr);
    align-items: stretch;
    border-bottom: 1px solid #bfbfbf;
    background-image: repeating-linear-gradient(
        to top,
        transparent 0,
        transparent calc(20% - 1px),
        #d9d9d9 20%
    );
}

.month-column {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto;
    padding: 0.25rem;
}

.month-column.selected {
    border: 3px solid #ff0000;
}

.plot-area {
    position: relative;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}

.bar-pair {
    display: flex;
    height: 85%;
    align-items: flex-end;
    gap: 0.12rem;
}

.bar {
    position: relative;
    width: 1rem;
    min-height: 1px;
}

.bar span {
    position: absolute;
    top: -1rem;
    left: 50%;
    font-size: 0.62rem;
    transform: translateX(-50%);
    white-space: nowrap;
}

.roadmap-bar {
    background: #00a9e0;
}

.actual-bar {
    background: #a5a5a5;
}

.fill-rate {
    position: absolute;
    bottom: 0.15rem;
    color: #002060;
    font-size: 0.68rem;
}

.month-label {
    padding-top: 0.35rem;
    color: #595959;
    font-size: 0.72rem;
    text-align: center;
}

.chart-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 1.2rem;
    margin-top: 0.75rem;
    font-size: 0.72rem;
}

.chart-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.chart-legend i {
    width: 0.75rem;
    height: 0.45rem;
}

.roadmap-dot {
    background: #00a9e0;
}

.actual-dot {
    background: #a5a5a5;
}

.fill-dot {
    background: #ffd966;
}
</style>
