<script setup>
defineProps({
    icon: {
        type: String,
        default: "pi pi-inbox",
    },
    title: {
        type: String,
        default: "No records found",
    },
    message: {
        type: String,
        default: "Try changing the filters or create a new record.",
    },
})
</script>

<template>
    <div class="app-empty-state">
        <i
            :class="icon"
            aria-hidden="true"
        />

        <strong>{{ title }}</strong>
        <span>{{ message }}</span>

        <div
            v-if="$slots.default"
            class="app-empty-state__actions"
        >
            <slot />
        </div>
    </div>
</template>

<style scoped>
.app-empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 0.25rem;
    min-height: 8rem;
    padding: 1rem;
    color: var(--hrms-text-muted);
    text-align: center;
}

.app-empty-state > i {
    margin-bottom: 0.25rem;
    font-size: 1.35rem;
    opacity: 0.65;
}

.app-empty-state > strong {
    color: var(--hrms-text);
    font-size: var(--hrms-font-size-md);
}

.app-empty-state > span {
    max-width: 28rem;
    font-size: var(--hrms-font-size-sm);
}

.app-empty-state__actions {
    margin-top: 0.5rem;
}
</style>
