<script setup>
import { computed } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
import DatePicker from "primevue/datepicker"
import Select from "primevue/select"

const props = defineProps({
    modelValue: {
        type: Object,
        required: true,
    },
    lookups: {
        type: Object,
        required: true,
    },
    loading: {
        type: Boolean,
        default: false,
    },
    lookupLoading: {
        type: Boolean,
        default: false,
    },
})

const emit = defineEmits([
    "update:modelValue",
    "apply",
    "reset",
    "scope-change",
])

const { t } = useI18n()

const branchOptions = computed(() =>
    props.lookups.branches.filter((item) =>
        !props.modelValue.companyId ||
        item.companyId === props.modelValue.companyId,
    ),
)

const departmentOptions = computed(() =>
    props.lookups.departments.filter((item) =>
        (!props.modelValue.companyId ||
            item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId ||
            item.branchId === props.modelValue.branchId),
    ),
)

const positionOptions = computed(() =>
    props.lookups.positions.filter((item) =>
        (!props.modelValue.companyId ||
            item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId ||
            item.branchId === props.modelValue.branchId) &&
        (!props.modelValue.departmentId ||
            item.departmentId === props.modelValue.departmentId),
    ),
)

const lineOptions = computed(() =>
    props.lookups.lines.filter((item) =>
        (!props.modelValue.companyId ||
            item.companyId === props.modelValue.companyId) &&
        (!props.modelValue.branchId ||
            item.branchId === props.modelValue.branchId) &&
        (!props.modelValue.departmentId ||
            item.departmentId === props.modelValue.departmentId),
    ),
)

const employeeTypeOptions = computed(() =>
    props.lookups.employeeTypes.filter((item) =>
        !props.modelValue.companyId ||
        item.companyId === props.modelValue.companyId,
    ),
)

function optionLabel(item) {
    return item.code
        ? `${item.code} - ${item.name}`
        : item.name
}

function updateField(field, value, dependentFields = []) {
    const nextValue = {
        ...props.modelValue,
        [field]: value || undefined,
    }

    for (const dependentField of dependentFields) {
        nextValue[dependentField] = undefined
    }

    emit("update:modelValue", nextValue)

    if (["companyId", "branchId", "departmentId"].includes(field)) {
        emit("scope-change", nextValue)
    }
}
</script>

<template>
    <section class="dashboard-filter-bar">
        <div class="dashboard-filter-bar__grid">
            <div class="dashboard-filter-bar__field">
                <label for="dashboard-start-date">
                    {{ t("hrDashboard.filters.startDate") }}
                </label>

                <DatePicker
                    id="dashboard-start-date"
                    :model-value="modelValue.startDate"
                    date-format="dd/mm/yy"
                    show-icon
                    icon-display="input"
                    :max-date="modelValue.endDate"
                    @update:model-value="updateField('startDate', $event)"
                />
            </div>

            <div class="dashboard-filter-bar__field">
                <label for="dashboard-end-date">
                    {{ t("hrDashboard.filters.endDate") }}
                </label>

                <DatePicker
                    id="dashboard-end-date"
                    :model-value="modelValue.endDate"
                    date-format="dd/mm/yy"
                    show-icon
                    icon-display="input"
                    :min-date="modelValue.startDate"
                    @update:model-value="updateField('endDate', $event)"
                />
            </div>

            <div class="dashboard-filter-bar__field">
                <label for="dashboard-company">
                    {{ t("hrDashboard.filters.company") }}
                </label>

                <Select
                    id="dashboard-company"
                    :model-value="modelValue.companyId"
                    :options="lookups.companies"
                    :option-label="optionLabel"
                    option-value="id"
                    :placeholder="t('hrDashboard.filters.allCompanies')"
                    show-clear
                    filter
                    :loading="lookupLoading"
                    @update:model-value="updateField(
                        'companyId',
                        $event,
                        [
                            'branchId',
                            'departmentId',
                            'positionId',
                            'lineId',
                            'employeeTypeId',
                        ],
                    )"
                />
            </div>

            <div class="dashboard-filter-bar__field">
                <label for="dashboard-branch">
                    {{ t("hrDashboard.filters.branch") }}
                </label>

                <Select
                    id="dashboard-branch"
                    :model-value="modelValue.branchId"
                    :options="branchOptions"
                    :option-label="optionLabel"
                    option-value="id"
                    :placeholder="t('hrDashboard.filters.allBranches')"
                    show-clear
                    filter
                    :loading="lookupLoading"
                    @update:model-value="updateField(
                        'branchId',
                        $event,
                        [
                            'departmentId',
                            'positionId',
                            'lineId',
                        ],
                    )"
                />
            </div>

            <div class="dashboard-filter-bar__field">
                <label for="dashboard-department">
                    {{ t("hrDashboard.filters.department") }}
                </label>

                <Select
                    id="dashboard-department"
                    :model-value="modelValue.departmentId"
                    :options="departmentOptions"
                    :option-label="optionLabel"
                    option-value="id"
                    :placeholder="t('hrDashboard.filters.allDepartments')"
                    show-clear
                    filter
                    :loading="lookupLoading"
                    @update:model-value="updateField(
                        'departmentId',
                        $event,
                        ['positionId', 'lineId'],
                    )"
                />
            </div>

            <div class="dashboard-filter-bar__field">
                <label for="dashboard-position">
                    {{ t("hrDashboard.filters.position") }}
                </label>

                <Select
                    id="dashboard-position"
                    :model-value="modelValue.positionId"
                    :options="positionOptions"
                    :option-label="optionLabel"
                    option-value="id"
                    :placeholder="t('hrDashboard.filters.allPositions')"
                    show-clear
                    filter
                    :loading="lookupLoading"
                    @update:model-value="updateField('positionId', $event)"
                />
            </div>

            <div class="dashboard-filter-bar__field">
                <label for="dashboard-line">
                    {{ t("hrDashboard.filters.line") }}
                </label>

                <Select
                    id="dashboard-line"
                    :model-value="modelValue.lineId"
                    :options="lineOptions"
                    :option-label="optionLabel"
                    option-value="id"
                    :placeholder="t('hrDashboard.filters.allLines')"
                    show-clear
                    filter
                    :loading="lookupLoading"
                    @update:model-value="updateField('lineId', $event)"
                />
            </div>

            <div class="dashboard-filter-bar__field">
                <label for="dashboard-employee-type">
                    {{ t("hrDashboard.filters.employeeType") }}
                </label>

                <Select
                    id="dashboard-employee-type"
                    :model-value="modelValue.employeeTypeId"
                    :options="employeeTypeOptions"
                    :option-label="optionLabel"
                    option-value="id"
                    :placeholder="t('hrDashboard.filters.allEmployeeTypes')"
                    show-clear
                    filter
                    :loading="lookupLoading"
                    @update:model-value="updateField('employeeTypeId', $event)"
                />
            </div>
        </div>

        <div class="dashboard-filter-bar__actions">
            <Button
                :label="t('common.reset')"
                icon="pi pi-undo"
                severity="secondary"
                outlined
                :disabled="loading"
                @click="emit('reset')"
            />

            <Button
                :label="t('common.apply')"
                icon="pi pi-filter"
                :loading="loading"
                @click="emit('apply')"
            />
        </div>
    </section>
</template>

<style scoped>
.dashboard-filter-bar {
    display: grid;
    gap: 0.85rem;
    padding: 0.85rem;
    border: 1px solid var(--surface-border);
    border-radius: 0.75rem;
    background: var(--surface-card);
}

.dashboard-filter-bar__grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(10rem, 1fr));
    gap: 0.75rem;
}

.dashboard-filter-bar__field {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
}

.dashboard-filter-bar__field label {
    color: var(--text-color-secondary);
    font-size: 0.72rem;
    font-weight: 700;
}

.dashboard-filter-bar__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
}

:deep(.p-select),
:deep(.p-datepicker) {
    width: 100%;
}

@media (max-width: 1100px) {
    .dashboard-filter-bar__grid {
        grid-template-columns: repeat(2, minmax(10rem, 1fr));
    }
}

@media (max-width: 640px) {
    .dashboard-filter-bar__grid {
        grid-template-columns: 1fr;
    }

    .dashboard-filter-bar__actions {
        justify-content: stretch;
    }

    .dashboard-filter-bar__actions :deep(.p-button) {
        flex: 1;
    }
}
</style>
