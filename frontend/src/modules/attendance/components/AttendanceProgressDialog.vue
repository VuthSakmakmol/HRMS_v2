<script setup>
import Dialog from "primevue/dialog"
import ProgressBar from "primevue/progressbar"

const props = defineProps({
    visible: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: "Processing attendance",
    },
    progress: {
        type: Number,
        default: 0,
    },
    message: {
        type: String,
        default: "",
    },
})

const emit = defineEmits(["update:visible"])
</script>

<template>
    <Dialog
        :visible="props.visible"
        modal
        :closable="false"
        :header="props.title"
        class="attendance-progress-dialog"
        @update:visible="emit('update:visible', $event)"
    >
        <div class="progress-content">
            <ProgressBar :value="props.progress" />
            <p v-if="props.message">{{ props.message }}</p>
        </div>
    </Dialog>
</template>

<style scoped>
.progress-content {
    display: grid;
    gap: 0.75rem;
    min-width: min(28rem, 80vw);
}

.progress-content p {
    margin: 0;
    color: var(--text-color-secondary);
}
</style>
