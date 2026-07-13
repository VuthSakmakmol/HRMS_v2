<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
    employeeTypeLabel: {
        type: String,
        default: "",
    },
})

const { t } = useI18n()

function safeT(key, fallback) {
    const translated = t(key)

    return translated === key ? fallback : translated
}

function formatNumber(value, digits = 1) {
    const number = Number(value)

    if (!Number.isFinite(number)) return "0"

    return number.toFixed(digits).replace(/\.0$/, "")
}

function formatRatio(value) {
    const number = Number(value)

    if (!Number.isFinite(number)) return "0.00"

    return number.toFixed(2)
}

const selectedLabel = computed(() => {
    return props.data.selectedLabel ||
        props.employeeTypeLabel ||
        safeT("hrDashboard.general.selected", "Selected")
})

const budgetLabel = computed(() =>
    props.data.budgetLabel || safeT("hrDashboard.general.budget", "Budget"),
)

const cards = computed(() => [
    {
        key: "averageAge",
        icon: "pi pi-users",
        label: safeT("hrDashboard.general.averageAge", "Avg. Age"),
        firstLabel: safeT("hrDashboard.general.total", "Total"),
        firstValue: formatNumber(props.data.total?.averageAge),
        secondLabel: selectedLabel.value,
        secondValue: formatNumber(props.data.selected?.averageAge),
        suffix: safeT("hrDashboard.units.years", "years"),
    },
    {
        key: "averageService",
        icon: "pi pi-briefcase",
        label: safeT("hrDashboard.general.averageService", "Years Of Service"),
        firstLabel: safeT("hrDashboard.general.total", "Total"),
        firstValue: formatNumber(props.data.total?.averageServiceYears),
        secondLabel: selectedLabel.value,
        secondValue: formatNumber(props.data.selected?.averageServiceYears),
        suffix: safeT("hrDashboard.units.years", "years"),
    },
    {
        key: "indirectDirectRatio",
        icon: "pi pi-sitemap",
        label: safeT("hrDashboard.general.indirectDirectRatio", "Indirect / Direct Ratio"),
        firstLabel: safeT("hrDashboard.general.actual", "Actual"),
        firstValue: formatRatio(props.data.indirectDirect?.actualRatio),
        secondLabel: budgetLabel.value,
        secondValue: formatRatio(props.data.indirectDirect?.budgetRatio),
        suffix: "",
    },
])
</script>

<template>
    <section class="general-metrics-section">
        <article
            v-for="card in cards"
            :key="card.key"
            class="general-metric-card"
        >
            <div class="general-metric-card__identity">
                <i
                    :class="card.icon"
                    aria-hidden="true"
                />
                <span>{{ card.label }}</span>
            </div>

            <div class="general-metric-card__divider" />

            <div class="general-metric-card__values">
                <div class="general-metric-card__value-block general-metric-card__value-block--plain">
                    <span
                        class="general-metric-card__caption"
                        :title="card.firstLabel"
                    >
                        {{ card.firstLabel }}
                    </span>

                    <strong class="general-metric-card__number">
                        {{ card.firstValue }}
                    </strong>

                    <small
                        v-if="card.suffix"
                        class="general-metric-card__suffix"
                    >
                        {{ card.suffix }}
                    </small>
                </div>

                <div class="general-metric-card__value-block general-metric-card__value-block--accent">
                    <span
                        class="general-metric-card__caption"
                        :title="card.secondLabel"
                    >
                        {{ card.secondLabel }}
                    </span>

                    <strong class="general-metric-card__number">
                        {{ card.secondValue }}
                    </strong>

                    <small
                        v-if="card.suffix"
                        class="general-metric-card__suffix"
                    >
                        {{ card.suffix }}
                    </small>
                </div>
            </div>
        </article>
    </section>
</template>

<style scoped>
.general-metrics-section {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.7rem;
    width: 100%;
    min-width: 0;
}

.general-metric-card {
    display: grid;
    grid-template-columns: 5rem 1px minmax(0, 1fr);
    align-items: stretch;
    min-width: 0;
    min-height: 5rem;
    border: 1px solid #1f1f1f;
    border-radius: 0.28rem;
    background: #ffffff;
    overflow: hidden;
}

.general-metric-card__identity {
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.48rem 0.34rem;
    color: #1f1f1f;
    text-align: center;
}

.general-metric-card__identity i {
    color: #000000;
    font-size: 1.8rem;
    line-height: 1;
}

.general-metric-card__identity span {
    max-width: 4.4rem;
    font-size: 0.62rem;
    font-weight: 900;
    line-height: 1.08;
}

.general-metric-card__divider {
    align-self: stretch;
    width: 1px;
    background: #b8b8b8;
}

.general-metric-card__values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: stretch;
    gap: 0.75rem;
    min-width: 0;
    height: 100%;
    padding: 0.5rem 0.75rem;
}

.general-metric-card__value-block {
    display: grid;
    grid-template-rows: 1.16rem minmax(2.28rem, 1fr) 0.7rem;
    align-items: center;
    justify-items: center;
    min-width: 0;
    height: 100%;
}

.general-metric-card__caption {
    width: 100%;
    color: #555555;
    font-size: 0.58rem;
    font-weight: 900;
    line-height: 1;
    padding-top: 0.14rem;
    text-align: center;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.general-metric-card__number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    align-self: center;
    justify-self: center;
    min-width: 4.7rem;
    min-height: 2.15rem;
    margin: auto;
    padding: 0.2rem 0.7rem;
    border: 1px solid #7d7d7d;
    border-radius: 0.38rem;
    background: linear-gradient(180deg, #f8f8f8 0%, #e4e4e4 100%);
    box-shadow: inset 0 0.12rem 0.2rem rgb(255 255 255 / 0.9), 0 0.09rem 0.28rem rgb(0 0 0 / 0.25);
    color: #002060;
    font-size: 1.36rem;
    font-weight: 950;
    letter-spacing: -0.02em;
    line-height: 1;
    text-align: center;
}

.general-metric-card__value-block--accent .general-metric-card__number {
    border-color: #4f9bb7;
    background: linear-gradient(180deg, #91d8f2 0%, #56b9db 100%);
}

.general-metric-card__suffix {
    align-self: start;
    margin-top: 0.03rem;
    color: #333333;
    font-size: 0.58rem;
    font-weight: 900;
    line-height: 1;
    text-align: center;
}

@media (max-width: 1180px) {
    .general-metrics-section {
        grid-template-columns: minmax(0, 1fr);
    }
}

@media (max-width: 560px) {
    .general-metric-card {
        grid-template-columns: 4.2rem 1px minmax(0, 1fr);
        min-height: 4.65rem;
    }

    .general-metric-card__identity i {
        font-size: 1.45rem;
    }

    .general-metric-card__identity span {
        font-size: 0.54rem;
    }

    .general-metric-card__values {
        gap: 0.45rem;
        padding: 0.45rem;
    }

    .general-metric-card__caption {
        padding-top: 0.1rem;
        font-size: 0.5rem;
    }

    .general-metric-card__number {
        min-width: 3.65rem;
        min-height: 1.95rem;
        padding: 0.16rem 0.48rem;
        font-size: 1.08rem;
    }

    .general-metric-card__suffix {
        font-size: 0.5rem;
    }
}
</style>
