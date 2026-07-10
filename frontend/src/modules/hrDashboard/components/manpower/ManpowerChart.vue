<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import { dashboardColors } from "../../config/dashboardColors.js"

const props = defineProps({
    rows: {
        type: Array,
        default: () => [],
    },
    selectedPeriodKey: {
        type: String,
        default: null,
    },
})

const { t } = useI18n()

const width = 960
const height = 300
const padding = {
    top: 24,
    right: 24,
    bottom: 46,
    left: 52,
}

const chartWidth = width - padding.left - padding.right
const chartHeight = height - padding.top - padding.bottom
const groupWidth = chartWidth / 12
const barWidth = Math.min(18, groupWidth / 4)

const maxValue = computed(() => {
    const values = props.rows.flatMap((row) => [
        Number(row.roadmap) || 0,
        Number(row.actual) || 0,
    ])

    return Math.max(10, ...values) * 1.1
})

const gridLines = computed(() =>
    Array.from({ length: 6 }, (_, index) => {
        const ratio = index / 5
        const value = Math.round(maxValue.value * (1 - ratio))
        const y = padding.top + chartHeight * ratio

        return {
            value,
            y,
        }
    }),
)

function barHeight(value) {
    return (Number(value) || 0) / maxValue.value * chartHeight
}

function groupX(index) {
    return padding.left + index * groupWidth + groupWidth / 2
}
</script>

<template>
    <div class="manpower-chart-wrap">
        <svg
            class="manpower-chart"
            :viewBox="`0 0 ${width} ${height}`"
            role="img"
            :aria-label="t('hrDashboard.manpower.chartAria')"
        >
            <g
                v-for="line in gridLines"
                :key="line.value"
            >
                <line
                    :x1="padding.left"
                    :x2="width - padding.right"
                    :y1="line.y"
                    :y2="line.y"
                    stroke="#d9d9d9"
                    stroke-width="1"
                />

                <text
                    :x="padding.left - 8"
                    :y="line.y + 4"
                    text-anchor="end"
                    class="manpower-chart__axis-label"
                >
                    {{ line.value }}
                </text>
            </g>

            <g
                v-for="(row, index) in rows"
                :key="row.month"
            >
                <rect
                    v-if="row.key === selectedPeriodKey"
                    :x="padding.left + index * groupWidth + 2"
                    :y="padding.top"
                    :width="groupWidth - 4"
                    :height="chartHeight"
                    fill="none"
                    :stroke="dashboardColors.red"
                    stroke-width="2"
                />

                <rect
                    :x="groupX(index) - barWidth - 2"
                    :y="padding.top + chartHeight - barHeight(row.roadmap)"
                    :width="barWidth"
                    :height="barHeight(row.roadmap)"
                    :fill="dashboardColors.cyan"
                />

                <rect
                    :x="groupX(index) + 2"
                    :y="padding.top + chartHeight - barHeight(row.actual)"
                    :width="barWidth"
                    :height="barHeight(row.actual)"
                    :fill="dashboardColors.gray"
                />

                <text
                    :x="groupX(index)"
                    :y="height - 20"
                    text-anchor="middle"
                    class="manpower-chart__month"
                >
                    {{ t(`hrDashboard.monthsShort.${row.month}`) }}
                </text>
            </g>
        </svg>

        <div class="manpower-chart__legend">
            <span>
                <i :style="{ background: dashboardColors.cyan }" />
                {{ t("hrDashboard.manpower.roadmap") }}
            </span>

            <span>
                <i :style="{ background: dashboardColors.gray }" />
                {{ t("hrDashboard.manpower.actual") }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.manpower-chart-wrap {
    border: 1px solid #7f8fa6;
    border-top: 0;
    background: #ffffff;
}

.manpower-chart {
    display: block;
    width: 100%;
    min-width: 760px;
}

.manpower-chart__axis-label,
.manpower-chart__month {
    fill: #404040;
    font-size: 10px;
    font-weight: 600;
}

.manpower-chart__legend {
    display: flex;
    justify-content: center;
    gap: 1.25rem;
    padding: 0 0.75rem 0.75rem;
    color: #333333;
    font-size: 0.7rem;
    font-weight: 700;
}

.manpower-chart__legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.manpower-chart__legend i {
    display: inline-block;
    width: 0.85rem;
    height: 0.55rem;
}
</style>
