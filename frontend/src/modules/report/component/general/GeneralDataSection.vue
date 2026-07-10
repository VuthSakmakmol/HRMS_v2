<script setup>
import { computed } from "vue"

const props = defineProps({
    data: {
        type: Object,
        default: () => ({}),
    },
})

const cards = computed(() => [
    {
        key: "age",
        icon: "pi pi-users",
        label: "Avg. Age",
        leftTitle: "TOTAL",
        leftValue: props.data.totalAverageAge ?? 0,
        rightTitle: "SEWER",
        rightValue: props.data.sewerAverageAge ?? 0,
        decimals: 0,
    },
    {
        key: "service",
        icon: "pi pi-briefcase",
        label: "Years Of Service",
        leftTitle: "TOTAL",
        leftValue: props.data.totalAverageService ?? 0,
        rightTitle: "SEWER",
        rightValue: props.data.sewerAverageService ?? 0,
        decimals: 1,
    },
    {
        key: "ratio",
        icon: "",
        label: "Indirect / Direct Ratio",
        leftTitle: props.data.previousPeriodLabel || "Previous",
        leftValue: props.data.previousIndirectDirectRatio ?? 0,
        rightTitle: props.data.currentPeriodLabel || "Current",
        rightValue: props.data.currentIndirectDirectRatio ?? 0,
        decimals: 2,
    },
])

function formatValue(value, decimals) {
    return Number(value || 0).toFixed(decimals)
}
</script>

<template>
    <section class="dashboard-section general-section">
        <header class="section-title">
            <span class="section-number">1</span>
            <h2>GENERAL DATA</h2>
        </header>

        <div class="general-grid">
            <article
                v-for="card in cards"
                :key="card.key"
                class="general-card"
            >
                <div class="metric-label">
                    <i v-if="card.icon" :class="card.icon" />
                    <strong>{{ card.label }}</strong>
                </div>

                <div class="metric-divider" />

                <div class="metric-value-group">
                    <span>{{ card.leftTitle }}</span>
                    <strong class="metric-box metric-box-muted">
                        {{ formatValue(card.leftValue, card.decimals) }}
                    </strong>
                </div>

                <div class="metric-value-group">
                    <span>{{ card.rightTitle }}</span>
                    <strong class="metric-box metric-box-primary">
                        {{ formatValue(card.rightValue, card.decimals) }}
                    </strong>
                </div>
            </article>
        </div>
    </section>
</template>

<style scoped>
.dashboard-section {
    background: #ffffff;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
}

.section-title h2 {
    margin: 0;
    color: #595959;
    font-size: 1.45rem;
    font-weight: 800;
}

.section-number {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    border: 1px solid #002060;
    border-radius: 50%;
    background: #00a9e0;
    color: #ffffff;
    font-size: 1.25rem;
    font-weight: 800;
}

.general-grid {
    display: grid;
    gap: 1.5rem;
    max-width: 44rem;
}

.general-card {
    display: grid;
    grid-template-columns: 8.5rem 1px minmax(8rem, 1fr) minmax(8rem, 1fr);
    align-items: center;
    gap: 1.5rem;
    padding: 1rem 1.75rem;
    border: 1px solid #000000;
    border-radius: 0.65rem;
}

.metric-label {
    display: grid;
    justify-items: center;
    gap: 0.65rem;
    color: #595959;
    text-align: center;
}

.metric-label i {
    color: #000000;
    font-size: 3.5rem;
}

.metric-label strong {
    max-width: 7.5rem;
    line-height: 1.25;
}

.metric-divider {
    height: 6.8rem;
    border-left: 1px dotted #000000;
}

.metric-value-group {
    display: grid;
    justify-items: center;
    gap: 0.55rem;
    color: #595959;
    font-size: 1rem;
}

.metric-box {
    display: grid;
    min-width: 8.25rem;
    min-height: 4.25rem;
    place-items: center;
    border: 1px solid #000000;
    border-radius: 0.7rem;
    box-shadow: 0 4px 10px rgb(0 0 0 / 20%);
    color: #002060;
    font-size: 2.3rem;
    font-weight: 800;
}

.metric-box-muted {
    background: #e7e6e6;
}

.metric-box-primary {
    background: #67bddb;
}

@media (max-width: 760px) {
    .general-card {
        grid-template-columns: 1fr 1fr;
    }

    .metric-label {
        grid-column: 1 / -1;
    }

    .metric-divider {
        display: none;
    }

    .metric-box {
        min-width: 7rem;
    }
}
</style>
