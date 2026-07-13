<script setup>
import { useI18n } from "vue-i18n"

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

const metrics = [
    {
        key: "budget",
        labelKey: "hrDashboard.manpower.budget",
        className: "metric-budget",
    },
    {
        key: "roadmap",
        labelKey: "hrDashboard.manpower.roadmap",
        className: "metric-roadmap",
    },
    {
        key: "actual",
        labelKey: "hrDashboard.manpower.actual",
        className: "metric-actual",
    },
    {
        key: "fillRate",
        labelKey: "hrDashboard.manpower.fillRate",
        className: "metric-fill-rate",
        suffix: "%",
    },
]
</script>

<template>
    <div class="manpower-table-wrap">
        <table class="manpower-table">
            <thead>
                <tr>
                    <th class="manpower-table__metric-header">
                        {{ t("hrDashboard.manpower.item") }}
                    </th>

                    <th
                        v-for="row in rows"
                        :key="row.month"
                        :class="{
                            'is-selected-period-key': row.key === selectedPeriodKey,
                        }"
                    >
                        {{ t(`hrDashboard.monthsShort.${row.month}`) }}
                    </th>
                </tr>
            </thead>

            <tbody>
                <tr
                    v-for="metric in metrics"
                    :key="metric.key"
                    :class="metric.className"
                >
                    <th>
                        {{ t(metric.labelKey) }}
                    </th>

                    <td
                        v-for="row in rows"
                        :key="`${metric.key}-${row.month}`"
                        :class="{
                            'is-selected-period-key': row.key === selectedPeriodKey,
                            'is-negative': Number(row[metric.key]) < 0,
                        }"
                    >
                        {{ row[metric.key] ?? 0 }}{{ metric.suffix || "" }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.manpower-table-wrap {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
}

.manpower-table {
    width: 100%;
    min-width: 0;
    border-collapse: collapse;
    table-layout: fixed;
    background: #ffffff;
}

.manpower-table th,
.manpower-table td {
    height: 1.5rem;
    padding: 0.18rem 0.22rem;
    border: 1px solid #a6a6a6;
    color: #111111;
    font-size: clamp(0.5rem, 0.72vw, 0.66rem);
    font-weight: 700;
    line-height: 1.1;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
}

.manpower-table thead th {
    background: #002060;
    color: #ffffff;
    font-weight: 800;
}

.manpower-table__metric-header,
.manpower-table tbody th {
    width: 7rem;
    text-align: left;
}

.metric-budget th,
.metric-budget td {
    background: #d9e1f2;
}

.metric-roadmap th,
.metric-roadmap td {
    background: #00b0f0;
    color: #ffffff;
}

.metric-actual th,
.metric-actual td {
    background: #e7e6e6;
}

.metric-fill-rate th,
.metric-fill-rate td {
    background: #ffd966;
}

.manpower-table .is-selected-period-key {
    border-right: 2px solid #ff0000;
    border-left: 2px solid #ff0000;
}

.manpower-table thead .is-selected-period-key {
    border-top: 2px solid #ff0000;
}

.manpower-table tbody tr:last-child .is-selected-period-key {
    border-bottom: 2px solid #ff0000;
}

.manpower-table .is-negative {
    color: #ff0000;
}

@media (max-width: 720px) {
    .manpower-table__metric-header,
    .manpower-table tbody th {
        width: 5.5rem;
    }
}
</style>
