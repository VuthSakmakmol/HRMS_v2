<script setup>
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

function number(value) {
    return new Intl.NumberFormat("en-US").format(Number(value || 0))
}

function percent(value) {
    return `${Number(value || 0).toFixed(1)}%`
}
</script>

<template>
    <div class="manpower-table-wrap">
        <table class="manpower-table">
            <thead>
                <tr>
                    <th class="category-header">{{ title }}</th>
                    <th colspan="12">{{ companyLabel }}</th>
                </tr>
            </thead>

            <tbody>
                <tr>
                    <th />
                    <td
                        v-for="month in months"
                        :key="`month-${month.month}`"
                        :class="{ selected: month.month === selectedMonth }"
                    >
                        {{ month.label }}
                    </td>
                </tr>

                <tr>
                    <th>Target: Budget</th>
                    <td
                        v-for="month in months"
                        :key="`budget-${month.month}`"
                        :class="{ selected: month.month === selectedMonth }"
                    >
                        {{ number(month.targetBudget) }}
                    </td>
                </tr>

                <tr class="roadmap-row">
                    <th>Target: Roadmap (1)</th>
                    <td
                        v-for="month in months"
                        :key="`roadmap-${month.month}`"
                        :class="{ selected: month.month === selectedMonth }"
                    >
                        {{ number(month.targetRoadmap) }}
                    </td>
                </tr>

                <tr>
                    <th>Actual (2)</th>
                    <td
                        v-for="month in months"
                        :key="`actual-${month.month}`"
                        :class="{ selected: month.month === selectedMonth }"
                    >
                        {{ number(month.actual) }}
                    </td>
                </tr>

                <tr>
                    <th>+/- Budget</th>
                    <td
                        v-for="month in months"
                        :key="`gap-budget-${month.month}`"
                        :class="[
                            { selected: month.month === selectedMonth },
                            month.gapBudget < 0 ? 'negative' : 'positive',
                        ]"
                    >
                        {{ number(month.gapBudget) }}
                    </td>
                </tr>

                <tr class="roadmap-row">
                    <th>+ Over / - Less than target Roadmap (2)-(1)</th>
                    <td
                        v-for="month in months"
                        :key="`gap-roadmap-${month.month}`"
                        :class="[
                            { selected: month.month === selectedMonth },
                            month.gapRoadmap < 0 ? 'negative' : 'positive',
                        ]"
                    >
                        {{ number(month.gapRoadmap) }}
                    </td>
                </tr>

                <tr class="fill-row">
                    <th>Fill rate</th>
                    <td
                        v-for="month in months"
                        :key="`fill-${month.month}`"
                        :class="{ selected: month.month === selectedMonth }"
                    >
                        {{ percent(month.fillRate) }}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<style scoped>
.manpower-table-wrap {
    overflow-x: auto;
}

.manpower-table {
    width: 100%;
    min-width: 930px;
    border-collapse: collapse;
    table-layout: fixed;
    color: #111111;
    font-size: 0.84rem;
}

th,
td {
    padding: 0.32rem 0.28rem;
    border: 1px solid #ffffff;
    background: #d9e2f3;
    text-align: center;
}

th:first-child {
    width: 12rem;
    text-align: left;
}

thead th {
    background: #4472c4;
    color: #ffffff;
    font-size: 1rem;
    font-weight: 800;
    text-align: center;
}

.category-header {
    text-transform: lowercase;
}

.roadmap-row th,
.roadmap-row td {
    background: #00a9e0;
    color: #ffffff;
}

.fill-row td {
    background: #ffd966;
    color: #7f6000;
}

.negative {
    color: #ff0000 !important;
}

.positive {
    color: #008000 !important;
}

.selected {
    border-right: 3px solid #ff0000 !important;
    border-left: 3px solid #ff0000 !important;
}

tr:first-child .selected {
    border-top: 3px solid #ff0000 !important;
}

tr:last-child .selected {
    border-bottom: 3px solid #ff0000 !important;
}
</style>
