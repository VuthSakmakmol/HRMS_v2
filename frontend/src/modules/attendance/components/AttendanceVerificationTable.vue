<script setup>
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Tag from "primevue/tag"

const props = defineProps({
    items: {
        type: Array,
        default: () => [],
    },
    loading: {
        type: Boolean,
        default: false,
    },
})

function severity(status) {
    if (["PRESENT", "HOLIDAY", "REST_DAY"].includes(status)) {
        return "success"
    }

    if (["LATE", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(status)) {
        return "warn"
    }

    return "danger"
}
</script>

<template>
    <DataTable :value="props.items" :loading="props.loading" scrollable>
        <Column field="employeeCode" header="Employee ID" />
        <Column field="employeeName" header="Employee" />
        <Column field="attendanceDate" header="Date" />
        <Column field="firstInAt" header="First In" />
        <Column field="lastOutAt" header="Last Out" />
        <Column field="status" header="Status">
            <template #body="{ data }">
                <Tag :value="data.status" :severity="severity(data.status)" />
            </template>
        </Column>
    </DataTable>
</template>
