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
    const values = props.months.flatMap((month) => [month.in, month.out, Math.abs(month.balance)])
    return Math.max(10, ...values.map((value) => Number(value || 0)))
})

function barHeight(value) {
    return `${Math.max(1, Number(value || 0) / maxValue.value * 82)}%`
}
</script>

<template>
    <div class="movement-chart">
        <h3>{{ title }}</h3>

        <div class="movement-plot">
            <div
                v-for="month in months"
                :key="month.month"
                class="movement-month"
                :class="{ selected: month.month === selectedMonth }"
            >
                <div class="movement-bars">
                    <div class="movement-bar in-bar" :style="{ height: barHeight(month.in) }">
                        <span>{{ month.in }}</span>
                    </div>
                    <div class="movement-bar out-bar" :style="{ height: barHeight(month.out) }">
                        <span>{{ month.out }}</span>
                    </div>
                    <div class="movement-bar balance-bar" :style="{ height: barHeight(Math.abs(month.balance)) }">
                        <span>{{ month.balance }}</span>
                    </div>
                </div>
                <span class="movement-label">{{ month.label }}</span>
            </div>
        </div>

        <div class="movement-legend">
            <span><i class="in-dot" />In</span>
            <span><i class="out-dot" />Out</span>
            <span><i class="balance-dot" />Balance</span>
        </div>
    </div>
</template>

<style scoped>
.movement-chart {
    padding: 0.75rem 1rem 0.55rem;
    border: 1px solid #000000;
    background: #ffffff;
}

h3 {
    margin: 0 0 0.75rem;
    color: #000000;
    font-size: 1.25rem;
    text-align: center;
}

.movement-plot {
    display: grid;
    min-width: 800px;
    height: 15rem;
    grid-template-columns: repeat(12, 1fr);
    border-bottom: 1px solid #808080;
    background-image: repeating-linear-gradient(
        to top,
        transparent 0,
        transparent calc(20% - 1px),
        #d9d9d9 20%
    );
}

.movement-month {
    display: grid;
    grid-template-rows: 1fr auto;
    padding: 0.25rem;
}

.movement-month.selected {
    border: 3px solid #ff0000;
}

.movement-bars {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.1rem;
}

.movement-bar {
    position: relative;
    width: 1.15rem;
    min-height: 1px;
}

.movement-bar span {
    position: absolute;
    top: -1rem;
    left: 50%;
    font-size: 0.66rem;
    transform: translateX(-50%);
}

.in-bar {
    background: #4472c4;
}

.out-bar {
    background: #ed7d31;
}

.balance-bar {
    background: #a5a5a5;
}

.movement-label {
    padding-top: 0.4rem;
    font-size: 0.72rem;
    text-align: center;
}

.movement-legend {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.72rem;
}

.movement-legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}

.movement-legend i {
    width: 0.55rem;
    height: 0.55rem;
}

.in-dot {
    background: #4472c4;
}

.out-dot {
    background: #ed7d31;
}

.balance-dot {
    background: #a5a5a5;
}
</style>
