<script setup>
import { useI18n } from "vue-i18n"

const props = defineProps({
    rows: {
        type: Array,
        default: () => [],
    },
})

const { t } = useI18n()
</script>

<template>
    <div class="attendance-line-table-wrap">
        <table class="attendance-line-table">
            <thead>
                <tr>
                    <th>{{ t("hrDashboard.attendance.line") }}</th>
                    <th>{{ t("hrDashboard.attendance.processed") }}</th>
                    <th>{{ t("hrDashboard.attendance.present") }}</th>
                    <th>{{ t("hrDashboard.attendance.absent") }}</th>
                    <th>{{ t("hrDashboard.attendance.late") }}</th>
                    <th>{{ t("hrDashboard.attendance.missingPunch") }}</th>
                    <th>{{ t("hrDashboard.attendance.needsReview") }}</th>
                    <th>{{ t("hrDashboard.attendance.attendanceRate") }}</th>
                </tr>
            </thead>

            <tbody>
                <tr
                    v-for="row in rows"
                    :key="row.lineId"
                >
                    <th>
                        <strong>{{ row.name }}</strong>
                        <span>{{ row.code }}</span>
                    </th>
                    <td>{{ row.processed }}</td>
                    <td class="is-present">{{ row.present }}</td>
                    <td class="is-absent">{{ row.absent }}</td>
                    <td class="is-warning">{{ row.late }}</td>
                    <td class="is-warning">{{ row.missingPunch }}</td>
                    <td class="is-review">{{ row.needsReview }}</td>
                    <td class="is-rate">{{ row.attendanceRate }}%</td>
                </tr>

                <tr v-if="rows.length === 0">
                    <td colspan="8" class="attendance-line-table__empty">
                        {{ t("hrDashboard.attendance.noLineData") }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.attendance-line-table-wrap {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #7f8fa6;
    border-top: 0;
}

.attendance-line-table {
    width: 100%;
    min-width: 0;
    border-collapse: collapse;
    table-layout: fixed;
    background: #ffffff;
}

.attendance-line-table th,
.attendance-line-table td {
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

.attendance-line-table thead th {
    background: #002060;
    color: #ffffff;
    font-weight: 800;
}

.attendance-line-table tbody th {
    text-align: left;
}

.attendance-line-table tbody th strong,
.attendance-line-table tbody th span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.attendance-line-table tbody th span {
    color: #666666;
    font-size: 0.56rem;
}

.attendance-line-table tbody tr:nth-child(even) td,
.attendance-line-table tbody tr:nth-child(even) th {
    background: #f8fbff;
}

.is-present {
    color: #375623;
}

.is-absent {
    color: #9c0006;
}

.is-warning {
    color: #9c5700;
}

.is-review {
    color: #7f6000;
}

.is-rate {
    background: #e2f0d9;
    color: #375623;
}

.attendance-line-table__empty {
    color: #666666;
    font-style: italic;
}
</style>
