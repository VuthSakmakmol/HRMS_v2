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
        key: "processed",
        labelKey: "hrDashboard.attendance.processed",
        className: "metric-processed",
    },
    {
        key: "present",
        labelKey: "hrDashboard.attendance.present",
        className: "metric-present",
    },
    {
        key: "absent",
        labelKey: "hrDashboard.attendance.absent",
        className: "metric-absent",
    },
    {
        key: "late",
        labelKey: "hrDashboard.attendance.late",
        className: "metric-late",
    },
    {
        key: "earlyLeave",
        labelKey: "hrDashboard.attendance.earlyLeave",
        className: "metric-early",
    },
    {
        key: "missingPunch",
        labelKey: "hrDashboard.attendance.missingPunch",
        className: "metric-missing",
    },
    {
        key: "needsReview",
        labelKey: "hrDashboard.attendance.needsReview",
        className: "metric-review",
    },
    {
        key: "attendanceRate",
        labelKey: "hrDashboard.attendance.attendanceRate",
        className: "metric-rate",
        suffix: "%",
    },
]
</script>

<template>
    <div class="attendance-table-wrap">
        <table class="attendance-table">
            <thead>
                <tr>
                    <th class="attendance-table__metric-header">
                        {{ t("hrDashboard.attendance.item") }}
                    </th>

                    <th
                        v-for="row in rows"
                        :key="row.key"
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
                        :key="`${metric.key}-${row.key}`"
                        :class="{
                            'is-selected-period-key': row.key === selectedPeriodKey,
                            'is-warning': ['late', 'earlyLeave', 'missingPunch', 'needsReview'].includes(metric.key) && Number(row[metric.key]) > 0,
                            'is-danger': metric.key === 'absent' && Number(row[metric.key]) > 0,
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
.attendance-table-wrap {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
}

.attendance-table {
    width: 100%;
    min-width: 0;
    border-collapse: collapse;
    table-layout: fixed;
    background: #ffffff;
}

.attendance-table th,
.attendance-table td {
    height: 1.45rem;
    padding: 0.16rem 0.2rem;
    border: 1px solid #a6a6a6;
    color: #111111;
    font-size: clamp(0.48rem, 0.68vw, 0.63rem);
    font-weight: 700;
    line-height: 1.08;
    text-align: center;
    vertical-align: middle;
    word-break: break-word;
}

.attendance-table thead th {
    background: #002060;
    color: #ffffff;
    font-weight: 800;
}

.attendance-table__metric-header,
.attendance-table tbody th {
    width: 7.5rem;
    text-align: left;
}

.metric-processed th,
.metric-processed td {
    background: #d9e1f2;
}

.metric-present th,
.metric-present td {
    background: #e2f0d9;
}

.metric-absent th,
.metric-absent td {
    background: #ffc7ce;
}

.metric-late th,
.metric-late td,
.metric-early th,
.metric-early td,
.metric-missing th,
.metric-missing td {
    background: #ffd966;
}

.metric-review th,
.metric-review td {
    background: #f4b183;
}

.metric-rate th,
.metric-rate td {
    background: #00b0f0;
    color: #ffffff;
}

.attendance-table .is-selected-period-key {
    border-right: 2px solid #ff0000;
    border-left: 2px solid #ff0000;
}

.attendance-table thead .is-selected-period-key {
    border-top: 2px solid #ff0000;
}

.attendance-table tbody tr:last-child .is-selected-period-key {
    border-bottom: 2px solid #ff0000;
}

.attendance-table .is-warning {
    color: #9c5700;
}

.attendance-table .is-danger {
    color: #9c0006;
}

@media (max-width: 720px) {
    .attendance-table__metric-header,
    .attendance-table tbody th {
        width: 5.75rem;
    }
}
</style>
