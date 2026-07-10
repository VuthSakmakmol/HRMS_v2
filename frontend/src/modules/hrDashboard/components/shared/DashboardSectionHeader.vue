<script setup>
defineProps({
    title: {
        type: String,
        required: true,
    },
})
</script>

<template>
    <div class="dashboard-section-header">
        <span>{{ title }}</span>
    </div>
</template>

<style scoped>
.dashboard-section-header {
    display: flex;
    align-items: center;
    min-height: 2.45rem;
    padding: 0.55rem 0.85rem;
    border: 1px solid #8ea9db;
    background: #00b0f0;
    color: #ffffff;
    font-size: 0.84rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
}
</style>
