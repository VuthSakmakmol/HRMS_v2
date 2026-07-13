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
const height = 220
const padding = {
    top: 18,
    right: 20,
    bottom: 34,
    left: 42,
}

const chartWidth = width - padding.left - padding.right
const chartHeight = height - padding.top - padding.bottom
const groupWidth = chartWidth / 12
const barWidth = Math.min(13, groupWidth / 5)

const maxValue = computed(() => {
    const values = props.rows.flatMap((row) => [
        Number(row.present) || 0,
        Number(row.absent) || 0,
        Number(row.late) || 0,
    ])

    return Math.max(10, ...values) * 1.1
})

const gridLines = computed(() =>
    Array.from({ length: 5 }, (_, index) => {
        const ratio = index / 4
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
    <div class="attendance-chart-wrap">
        <svg
            class="attendance-chart"
            :viewBox="`0 0 ${width} ${height}`"
            role="img"
            :aria-label="t('hrDashboard.attendance.chartAria')"
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
                    class="attendance-chart__axis-label"
                >
                    {{ line.value }}
                </text>
            </g>

            <g
                v-for="(row, index) in rows"
                :key="row.key"
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
                    :x="groupX(index) - barWidth * 1.5 - 3"
                    :y="padding.top + chartHeight - barHeight(row.present)"
                    :width="barWidth"
                    :height="barHeight(row.present)"
                    :fill="dashboardColors.green"
                />

                <rect
                    :x="groupX(index) - barWidth / 2"
                    :y="padding.top + chartHeight - barHeight(row.absent)"
                    :width="barWidth"
                    :height="barHeight(row.absent)"
                    :fill="dashboardColors.red"
                />

                <rect
                    :x="groupX(index) + barWidth / 2 + 3"
                    :y="padding.top + chartHeight - barHeight(row.late)"
                    :width="barWidth"
                    :height="barHeight(row.late)"
                    :fill="dashboardColors.orange"
                />

                <text
                    :x="groupX(index)"
                    :y="height - 18"
                    text-anchor="middle"
                    class="attendance-chart__month"
                >
                    {{ t(`hrDashboard.monthsShort.${row.month}`) }}
                </text>
            </g>
        </svg>

        <div class="attendance-chart__legend">
            <span>
                <i :style="{ background: dashboardColors.green }" />
                {{ t("hrDashboard.attendance.present") }}
            </span>

            <span>
                <i :style="{ background: dashboardColors.red }" />
                {{ t("hrDashboard.attendance.absent") }}
            </span>

            <span>
                <i :style="{ background: dashboardColors.orange }" />
                {{ t("hrDashboard.attendance.late") }}
            </span>
        </div>
    </div>
</template>

<style scoped>
.attendance-chart-wrap {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
    background: #ffffff;
}

.attendance-chart {
    display: block;
    width: 100%;
    min-width: 0;
    height: auto;
}

.attendance-chart__axis-label,
.attendance-chart__month {
    fill: #404040;
    font-size: 9px;
    font-weight: 600;
}

.attendance-chart__legend {
    display: flex;
    justify-content: center;
    gap: 1rem;
    padding: 0 0.6rem 0.45rem;
    color: #333333;
    font-size: 0.64rem;
    font-weight: 700;
}

.attendance-chart__legend span {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}

.attendance-chart__legend i {
    display: inline-block;
    width: 0.75rem;
    height: 0.5rem;
}
</style>
