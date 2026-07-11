<script setup>
import Button from "primevue/button"

const props = defineProps({
    canEdit: {
        type: Boolean,
        default: false,
    },
    canArchive: {
        type: Boolean,
        default: false,
    },
    canDelete: {
        type: Boolean,
        default: false,
    },
    canRestore: {
        type: Boolean,
        default: false,
    },
    editLabel: {
        type: String,
        default: "Edit",
    },
    archiveLabel: {
        type: String,
        default: "Archive",
    },
    deleteLabel: {
        type: String,
        default: "Delete",
    },
    restoreLabel: {
        type: String,
        default: "Restore",
    },
    disabled: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    "edit",
    "archive",
    "delete",
    "restore",
])
</script>

<template>
    <div class="app-table-actions">
        <slot name="before" />

        <Button
            v-if="props.canEdit"
            v-tooltip.top="props.editLabel"
            class="hrms-icon-button"
            icon="pi pi-pencil"
            severity="secondary"
            text
            rounded
            :aria-label="props.editLabel"
            :disabled="props.disabled"
            @click="emit('edit')"
        />

        <Button
            v-if="props.canRestore"
            v-tooltip.top="props.restoreLabel"
            class="hrms-icon-button"
            icon="pi pi-refresh"
            severity="success"
            text
            rounded
            :aria-label="props.restoreLabel"
            :disabled="props.disabled"
            @click="emit('restore')"
        />

        <Button
            v-if="props.canArchive"
            v-tooltip.top="props.archiveLabel"
            class="hrms-icon-button"
            icon="pi pi-inbox"
            severity="warn"
            text
            rounded
            :aria-label="props.archiveLabel"
            :disabled="props.disabled"
            @click="emit('archive')"
        />

        <Button
            v-if="props.canDelete"
            v-tooltip.top="props.deleteLabel"
            class="hrms-icon-button"
            icon="pi pi-trash"
            severity="danger"
            text
            rounded
            :aria-label="props.deleteLabel"
            :disabled="props.disabled"
            @click="emit('delete')"
        />

        <slot name="after" />
    </div>
</template>

<style scoped>
.app-table-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    min-width: 0;
    white-space: nowrap;
}
</style>
