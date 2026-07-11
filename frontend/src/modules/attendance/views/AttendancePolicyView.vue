<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Checkbox from "primevue/checkbox"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputNumber from "primevue/inputnumber"
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"

import { fetchBranchesLookup } from "@/modules/organization/services/branch.api.js"
import { fetchCompaniesLookup } from "@/modules/organization/services/company.api.js"
import { useAuthStore } from "@/app/stores/auth.store.js"
import {
    createAttendancePolicy,
    fetchAttendancePolicies,
    updateAttendancePolicy,
} from "../services/attendance.api.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const selectedId = ref(null)
const items = ref([])
const companies = ref([])
const branches = ref([])

const form = reactive({
    companyId: null,
    branchId: null,
    name: "",
    code: "",
    graceInMinutes: 0,
    graceOutMinutes: 0,
    minimumWorkedMinutes: 0,
    lateRoundUnitMinutes: 1,
    lateRoundMethod: "CEIL",
    earlyLeaveRoundUnitMinutes: 1,
    earlyLeaveRoundMethod: "CEIL",
    autoGenerateAbsent: true,
    treatSundayAsRestDay: true,
    status: "ACTIVE",
})

const canCreate = computed(() =>
    authStore.hasPermission("ATTENDANCE.POLICY.CREATE"),
)
const canUpdate = computed(() =>
    authStore.hasPermission("ATTENDANCE.POLICY.UPDATE"),
)

const roundMethods = [
    { label: "Floor", value: "FLOOR" },
    { label: "Ceil", value: "CEIL" },
    { label: "Nearest", value: "NEAREST" },
]

function resetForm() {
    selectedId.value = null
    Object.assign(form, {
        companyId: null,
        branchId: null,
        name: "",
        code: "",
        graceInMinutes: 0,
        graceOutMinutes: 0,
        minimumWorkedMinutes: 0,
        lateRoundUnitMinutes: 1,
        lateRoundMethod: "CEIL",
        earlyLeaveRoundUnitMinutes: 1,
        earlyLeaveRoundMethod: "CEIL",
        autoGenerateAbsent: true,
        treatSundayAsRestDay: true,
        status: "ACTIVE",
    })
}

function openCreate() {
    resetForm()
    dialogVisible.value = true
}

function openEdit(item) {
    selectedId.value = item.id
    Object.assign(form, {
        companyId: item.companyId?.id || item.companyId,
        branchId: item.branchId?.id || item.branchId || null,
        name: item.name,
        code: item.code,
        graceInMinutes: item.graceInMinutes,
        graceOutMinutes: item.graceOutMinutes,
        minimumWorkedMinutes: item.minimumWorkedMinutes,
        lateRoundUnitMinutes: item.lateRoundUnitMinutes,
        lateRoundMethod: item.lateRoundMethod,
        earlyLeaveRoundUnitMinutes: item.earlyLeaveRoundUnitMinutes,
        earlyLeaveRoundMethod: item.earlyLeaveRoundMethod,
        autoGenerateAbsent: item.autoGenerateAbsent,
        treatSundayAsRestDay: item.treatSundayAsRestDay,
        status: item.status,
    })
    dialogVisible.value = true
}

async function loadLookups() {
    const [companyResult, branchResult] = await Promise.all([
        fetchCompaniesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
        fetchBranchesLookup({ page: 1, limit: 100, status: "ACTIVE" }),
    ])
    companies.value = companyResult || []
    branches.value = branchResult || []
}

async function loadItems() {
    loading.value = true
    try {
        items.value = await fetchAttendancePolicies({ status: "ALL" })
    } finally {
        loading.value = false
    }
}

async function save() {
    saving.value = true
    try {
        const payload = { ...form }
        if (selectedId.value) {
            await updateAttendancePolicy(selectedId.value, payload)
        } else {
            await createAttendancePolicy(payload)
        }
        dialogVisible.value = false
        await loadItems()
        toast.add({
            severity: "success",
            summary: t("common.success"),
            detail: t("attendance.policy.saved"),
            life: 2500,
        })
    } finally {
        saving.value = false
    }
}

onMounted(async () => {
    await Promise.all([loadLookups(), loadItems()])
})
</script>

<template>
    <section class="page-shell">
        <div class="page-header">
            <div>
                <h1>{{ t("attendance.policy.title") }}</h1>
                <p>{{ t("attendance.policy.description") }}</p>
            </div>
            <Button
                v-if="canCreate"
                icon="pi pi-plus"
                :label="t('attendance.policy.add')"
                @click="openCreate"
            />
        </div>

        <Card>
            <template #content>
                <DataTable :value="items" :loading="loading" scrollable striped-rows>
                    <Column field="code" :header="t('common.code')" />
                    <Column field="name" :header="t('common.name')" />
                    <Column :header="t('organization.company.title')">
                        <template #body="{ data }">
                            {{ data.companyId?.displayName || "-" }}
                        </template>
                    </Column>
                    <Column :header="t('organization.branch.title')">
                        <template #body="{ data }">
                            {{ data.branchId?.name || t("common.all") }}
                        </template>
                    </Column>
                    <Column field="graceInMinutes" :header="t('attendance.policy.graceIn')" />
                    <Column field="graceOutMinutes" :header="t('attendance.policy.graceOut')" />
                    <Column :header="t('common.status')">
                        <template #body="{ data }">
                            <Tag
                                :value="data.status"
                                :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'"
                            />
                        </template>
                    </Column>
                    <Column v-if="canUpdate" :header="t('common.actions')">
                        <template #body="{ data }">
                            <Button
                                icon="pi pi-pencil"
                                text
                                rounded
                                @click="openEdit(data)"
                            />
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="selectedId ? t('attendance.policy.edit') : t('attendance.policy.add')"
            class="policy-dialog"
        >
            <div class="form-grid">
                <div class="form-field">
                    <label for="policyCompany">{{ t("organization.company.title") }}</label>
                    <Select
                        id="policyCompany"
                        v-model="form.companyId"
                        :options="companies"
                        option-label="displayName"
                        option-value="id"
                        :placeholder="t('organization.company.title')"
                        filter
                    />
                </div>

                <div class="form-field">
                    <label for="policyBranch">{{ t("organization.branch.title") }}</label>
                    <Select
                        id="policyBranch"
                        v-model="form.branchId"
                        :options="branches"
                        option-label="name"
                        option-value="id"
                        :placeholder="t('organization.branch.title')"
                        filter
                        show-clear
                    />
                </div>

                <div class="form-field">
                    <label for="policyCode">{{ t("common.code") }}</label>
                    <InputText
                        id="policyCode"
                        v-model.trim="form.code"
                        :placeholder="t('common.code')"
                    />
                </div>

                <div class="form-field">
                    <label for="policyName">{{ t("common.name") }}</label>
                    <InputText
                        id="policyName"
                        v-model.trim="form.name"
                        :placeholder="t('common.name')"
                    />
                </div>

                <div class="form-field">
                    <label for="graceInMinutes">{{ t("attendance.policy.graceIn") }}</label>
                    <InputNumber
                        input-id="graceInMinutes"
                        v-model="form.graceInMinutes"
                        :min="0"
                        :use-grouping="false"
                        :placeholder="t('attendance.policy.graceIn')"
                    />
                </div>

                <div class="form-field">
                    <label for="graceOutMinutes">{{ t("attendance.policy.graceOut") }}</label>
                    <InputNumber
                        input-id="graceOutMinutes"
                        v-model="form.graceOutMinutes"
                        :min="0"
                        :use-grouping="false"
                        :placeholder="t('attendance.policy.graceOut')"
                    />
                </div>

                <div class="form-field">
                    <label for="minimumWorkedMinutes">{{ t("attendance.policy.minimumWorked") }}</label>
                    <InputNumber
                        input-id="minimumWorkedMinutes"
                        v-model="form.minimumWorkedMinutes"
                        :min="0"
                        :use-grouping="false"
                        :placeholder="t('attendance.policy.minimumWorked')"
                    />
                </div>

                <div class="form-field">
                    <label for="lateRoundUnitMinutes">{{ t("attendance.policy.lateRoundUnit") }}</label>
                    <InputNumber
                        input-id="lateRoundUnitMinutes"
                        v-model="form.lateRoundUnitMinutes"
                        :min="1"
                        :use-grouping="false"
                        :placeholder="t('attendance.policy.lateRoundUnit')"
                    />
                </div>

                <div class="form-field">
                    <label for="lateRoundMethod">Late Round Method</label>
                    <Select
                        id="lateRoundMethod"
                        v-model="form.lateRoundMethod"
                        :options="roundMethods"
                        option-label="label"
                        option-value="value"
                        placeholder="Late Round Method"
                    />
                </div>

                <div class="form-field">
                    <label for="earlyLeaveRoundUnitMinutes">{{ t("attendance.policy.earlyRoundUnit") }}</label>
                    <InputNumber
                        input-id="earlyLeaveRoundUnitMinutes"
                        v-model="form.earlyLeaveRoundUnitMinutes"
                        :min="1"
                        :use-grouping="false"
                        :placeholder="t('attendance.policy.earlyRoundUnit')"
                    />
                </div>

                <div class="form-field">
                    <label for="earlyLeaveRoundMethod">Early Leave Round Method</label>
                    <Select
                        id="earlyLeaveRoundMethod"
                        v-model="form.earlyLeaveRoundMethod"
                        :options="roundMethods"
                        option-label="label"
                        option-value="value"
                        placeholder="Early Leave Round Method"
                    />
                </div>

                <div class="form-field">
                    <label for="policyStatus">{{ t("common.status") }}</label>
                    <Select
                        id="policyStatus"
                        v-model="form.status"
                        :options="[
                            { label: 'ACTIVE', value: 'ACTIVE' },
                            { label: 'INACTIVE', value: 'INACTIVE' },
                        ]"
                        option-label="label"
                        option-value="value"
                        :placeholder="t('common.status')"
                    />
                </div>
            </div>

            <div class="check-row">
                <Checkbox v-model="form.autoGenerateAbsent" binary input-id="autoAbsent" />
                <label for="autoAbsent">{{ t("attendance.policy.autoAbsent") }}</label>
            </div>
            <div class="check-row">
                <Checkbox v-model="form.treatSundayAsRestDay" binary input-id="sundayRest" />
                <label for="sundayRest">{{ t("attendance.policy.sundayRest") }}</label>
            </div>

            <template #footer>
                <Button :label="t('common.cancel')" severity="secondary" text @click="dialogVisible = false" />
                <Button :label="t('common.save')" :loading="saving" @click="save" />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.page-shell {
    display: grid;
    gap: 1rem;
}

.page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
}

.page-header h1 {
    margin: 0;
}

.page-header p {
    margin: 0.35rem 0 0;
    color: var(--text-color-secondary);
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem 1rem;
}

.form-field {
    display: grid;
    min-width: 0;
    gap: 0.38rem;
}

.form-field > label {
    color: var(--text-color);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1.2;
}

.form-field :deep(.p-inputtext),
.form-field :deep(.p-inputnumber),
.form-field :deep(.p-select) {
    width: 100%;
}

.check-row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin-top: 0.85rem;
}

:deep(.policy-dialog) {
    width: min(760px, 95vw);
}

@media (max-width: 640px) {
    .form-grid {
        grid-template-columns: 1fr;
    }
}
</style>
