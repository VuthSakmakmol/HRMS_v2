<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import DashboardSectionHeader from "../shared/DashboardSectionHeader.vue"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
})

const { t } = useI18n()

const cards = computed(() => [
    {
        label: t("hrDashboard.general.totalEmployees"),
        value: props.data.totalEmployees ?? 0,
        suffix: "",
    },
    {
        label: t("hrDashboard.general.sewerEmployees"),
        value: props.data.sewerEmployees ?? 0,
        suffix: "",
    },
    {
        label: t("hrDashboard.general.averageAge"),
        value: props.data.averageAge ?? 0,
        suffix: t("hrDashboard.units.years"),
    },
    {
        label: t("hrDashboard.general.sewerAverageAge"),
        value: props.data.sewerAverageAge ?? 0,
        suffix: t("hrDashboard.units.years"),
    },
    {
        label: t("hrDashboard.general.averageService"),
        value: props.data.averageServiceYears ?? 0,
        suffix: t("hrDashboard.units.years"),
    },
    {
        label: t("hrDashboard.general.sewerAverageService"),
        value: props.data.sewerAverageServiceYears ?? 0,
        suffix: t("hrDashboard.units.years"),
    },
    {
        label: t("hrDashboard.general.directIndirectRatio"),
        value: props.data.directIndirectRatio ?? 0,
        suffix: "",
    },
])
</script>

<template>
    <section class="dashboard-section">
        <DashboardSectionHeader
            :title="t('hrDashboard.sections.generalData')"
        />

        <div class="general-data-grid">
            <article
                v-for="card in cards"
                :key="card.label"
                class="general-data-card"
            >
                <span class="general-data-card__label">
                    {{ card.label }}
                </span>

                <strong class="general-data-card__value">
                    {{ card.value }}
                    <small v-if="card.suffix">
                        {{ card.suffix }}
                    </small>
                </strong>
            </article>
        </div>
    </section>
</template>

<style scoped>
.dashboard-section {
    display: grid;
    gap: 0;
}

.general-data-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(8.5rem, 1fr));
    overflow-x: auto;
    border-right: 1px solid #b4c6e7;
    border-bottom: 1px solid #b4c6e7;
    border-left: 1px solid #b4c6e7;
}

.general-data-card {
    display: grid;
    gap: 0.45rem;
    min-width: 8.5rem;
    padding: 0.8rem;
    border-right: 1px solid #b4c6e7;
    background: #ffffff;
    text-align: center;
}

.general-data-card:last-child {
    border-right: 0;
}

.general-data-card__label {
    min-height: 2rem;
    color: #1f1f1f;
    font-size: 0.68rem;
    font-weight: 700;
}

.general-data-card__value {
    color: #002060;
    font-size: 1.35rem;
    font-weight: 900;
}

.general-data-card__value small {
    font-size: 0.62rem;
    font-weight: 700;
}
</style>
