<script setup>
import Checkbox from "primevue/checkbox"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"

const model = defineModel({
    type: Object,
    required: true,
})

defineProps({
    companies: {
        type: Array,
        default: () => [],
    },
    branches: {
        type: Array,
        default: () => [],
    },
})

const roundMethods = [
    { label: "Floor", value: "FLOOR" },
    { label: "Ceil", value: "CEIL" },
    { label: "Nearest", value: "NEAREST" },
]
</script>

<template>
    <div class="policy-form-grid">
        <Select
            v-model="model.companyId"
            :options="companies"
            option-label="displayName"
            option-value="id"
            placeholder="Company"
            filter
        />
        <Select
            v-model="model.branchId"
            :options="branches"
            option-label="name"
            option-value="id"
            placeholder="All branches"
            filter
            show-clear
        />
        <InputText v-model="model.code" placeholder="Code" />
        <InputText v-model="model.name" placeholder="Name" />
        <InputNumber v-model="model.graceInMinutes" :min="0" placeholder="Grace in" />
        <InputNumber v-model="model.graceOutMinutes" :min="0" placeholder="Grace out" />
        <InputNumber v-model="model.minimumWorkedMinutes" :min="0" placeholder="Minimum worked" />
        <InputNumber v-model="model.lateRoundUnitMinutes" :min="1" placeholder="Late round unit" />
        <Select v-model="model.lateRoundMethod" :options="roundMethods" option-label="label" option-value="value" />
        <InputNumber v-model="model.earlyLeaveRoundUnitMinutes" :min="1" placeholder="Early-leave round unit" />
        <Select v-model="model.earlyLeaveRoundMethod" :options="roundMethods" option-label="label" option-value="value" />
        <Select v-model="model.status" :options="['ACTIVE', 'INACTIVE']" />

        <label class="checkbox-field">
            <Checkbox v-model="model.autoGenerateAbsent" binary />
            <span>Auto-generate absence</span>
        </label>

        <label class="checkbox-field">
            <Checkbox v-model="model.treatSundayAsRestDay" binary />
            <span>Treat Sunday as rest day</span>
        </label>
    </div>
</template>

<style scoped>
.policy-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.checkbox-field {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

@media (max-width: 720px) {
    .policy-form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
