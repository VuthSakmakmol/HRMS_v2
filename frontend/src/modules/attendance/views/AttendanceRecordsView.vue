<script setup>
import { computed, onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import Dialog from "primevue/dialog"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useAttendanceStore } from "../stores/attendance.store.js"

const { t } = useI18n()
const toast = useToast()
const authStore = useAuthStore()
const attendanceStore = useAttendanceStore()

const today = new Date().toISOString().slice(0, 10)
const firstDay = `${today.slice(0, 8)}01`

const filters = reactive({
    page: 1,
    limit: 20,
    search: "",
    dateFrom: firstDay,
    dateTo: today,
    status: "ALL",
})

const dialogVisible = ref(false)
const selectedId = ref(null)
const form = reactive({
    employeeCode: "",
    attendanceDate: today,
    firstInAt: "",
    lastOutAt: "",
    note: "",
})

const importDialogVisible = ref(false)
const selectedFile = ref(null)

const canCreate = computed(() =>
    authStore.hasPermission("ATTENDANCE.RECORD.CREATE"),
)
const canUpdate = computed(() =>
    authStore.hasPermission("ATTENDANCE.RECORD.UPDATE"),
)
const canImport = computed(() =>
    authStore.hasPermission("ATTENDANCE.RECORD.IMPORT"),
)

const statusOptions = computed(() => [
    { label: t("attendance.status.all"), value: "ALL" },
    { label: t("attendance.status.present"), value: "PRESENT" },
    { label: t("attendance.status.late"), value: "LATE" },
    { label: t("attendance.status.earlyLeave"), value: "EARLY_LEAVE" },
    { label: t("attendance.status.missingIn"), value: "MISSING_IN" },
    { label: t("attendance.status.missingOut"), value: "MISSING_OUT" },
    { label: t("attendance.status.absent"), value: "ABSENT" },
])

function toDateTimeValue(value) {
    if (!value) {
        return ""
    }

    const date = new Date(value)
    const offset = date.getTimezoneOffset() * 60000
    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function formatDate(value) {
    return value ? new Intl.DateTimeFormat().format(new Date(value)) : "-"
}

function formatTime(value) {
    return value
        ? new Intl.DateTimeFormat([], {
              hour: "2-digit",
              minute: "2-digit",
          }).format(new Date(value))
        : "-"
}

function statusSeverity(status) {
    if (status === "PRESENT") return "success"
    if (["LATE", "EARLY_LEAVE", "LATE_AND_EARLY_LEAVE"].includes(status)) {
        return "warn"
    }
    if (["MISSING_IN", "MISSING_OUT", "ABSENT"].includes(status)) {
        return "danger"
    }
    return "info"
}

async function loadRecords(page = filters.page) {
    filters.page = page
    await attendanceStore.load({ ...filters })
}

function resetForm() {
    selectedId.value = null
    form.employeeCode = ""
    form.attendanceDate = today
    form.firstInAt = ""
    form.lastOutAt = ""
    form.note = ""
}

function openCreate() {
    resetForm()
    dialogVisible.value = true
}

function openEdit(record) {
    selectedId.value = record.id
    form.employeeCode = record.employeeCode
    form.attendanceDate = String(record.attendanceDate).slice(0, 10)
    form.firstInAt = toDateTimeValue(record.firstInAt)
    form.lastOutAt = toDateTimeValue(record.lastOutAt)
    form.note = record.note || ""
    dialogVisible.value = true
}

async function saveRecord() {
    await attendanceStore.save(
        {
            employeeCode: form.employeeCode,
            attendanceDate: form.attendanceDate,
            firstInAt: form.firstInAt || null,
            lastOutAt: form.lastOutAt || null,
            note: form.note,
        },
        selectedId.value,
    )

    dialogVisible.value = false
    toast.add({
        severity: "success",
        summary: t("common.success"),
        detail: t("attendance.saved"),
        life: 2500,
    })
    await loadRecords()
}

function onFileChange(event) {
    selectedFile.value = event.target.files?.[0] || null
}

async function runImport() {
    if (!selectedFile.value) {
        return
    }

    await attendanceStore.importFile(selectedFile.value)
    importDialogVisible.value = false
    await loadRecords(1)
}

onMounted(() => {
    loadRecords(1)
})
</script>

<template>
    <section class="attendance-page">
        <div class="page-header">
            <div>
                <h1>{{ t("attendance.title") }}</h1>
                <p>{{ t("attendance.description") }}</p>
            </div>

            <div class="page-actions">
                <Button
                    v-if="canImport"
                    icon="pi pi-download"
                    :label="t('attendance.template')"
                    severity="secondary"
                    outlined
                    @click="attendanceStore.downloadTemplate()"
                />
                <Button
                    v-if="canImport"
                    icon="pi pi-upload"
                    :label="t('attendance.import')"
                    severity="secondary"
                    @click="importDialogVisible = true"
                />
                <Button
                    v-if="canCreate"
                    icon="pi pi-plus"
                    :label="t('attendance.addRecord')"
                    @click="openCreate"
                />
            </div>
        </div>

        <Card>
            <template #content>
                <div class="filters">
                    <InputText
                        v-model="filters.search"
                        :placeholder="t('attendance.searchPlaceholder')"
                        @keyup.enter="loadRecords(1)"
                    />
                    <input v-model="filters.dateFrom" type="date" class="native-input" />
                    <input v-model="filters.dateTo" type="date" class="native-input" />
                    <Select
                        v-model="filters.status"
                        :options="statusOptions"
                        option-label="label"
                        option-value="value"
                    />
                    <Button
                        icon="pi pi-search"
                        :label="t('common.search')"
                        @click="loadRecords(1)"
                    />
                </div>

                <DataTable
                    :value="attendanceStore.items"
                    :loading="attendanceStore.loading"
                    striped-rows
                    scrollable
                    paginator
                    lazy
                    :rows="attendanceStore.pagination.limit"
                    :total-records="attendanceStore.pagination.total"
                    @page="loadRecords($event.page + 1)"
                >
                    <Column field="attendanceDate" :header="t('attendance.date')">
                        <template #body="{ data }">{{ formatDate(data.attendanceDate) }}</template>
                    </Column>
                    <Column field="employeeCode" :header="t('attendance.employeeId')" />
                    <Column :header="t('attendance.employeeName')">
                        <template #body="{ data }">
                            {{ data.employeeId?.displayName || '-' }}
                        </template>
                    </Column>
                    <Column :header="t('attendance.shift')">
                        <template #body="{ data }">
                            {{ data.shiftId?.code || '-' }}
                        </template>
                    </Column>
                    <Column :header="t('attendance.firstIn')">
                        <template #body="{ data }">{{ formatTime(data.firstInAt) }}</template>
                    </Column>
                    <Column :header="t('attendance.lastOut')">
                        <template #body="{ data }">{{ formatTime(data.lastOutAt) }}</template>
                    </Column>
                    <Column field="workedMinutes" :header="t('attendance.workedMinutes')" />
                    <Column :header="t('attendance.statusLabel')">
                        <template #body="{ data }">
                            <Tag
                                :value="t(`attendance.status.${data.status.toLowerCase()}`)"
                                :severity="statusSeverity(data.status)"
                            />
                        </template>
                    </Column>
                    <Column :header="t('common.actions')">
                        <template #body="{ data }">
                            <Button
                                v-if="canUpdate"
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
            :header="selectedId ? t('attendance.editRecord') : t('attendance.addRecord')"
            class="attendance-dialog"
        >
            <div class="form-grid">
                <label>
                    <span>{{ t("attendance.employeeId") }}</span>
                    <InputText v-model="form.employeeCode" :disabled="Boolean(selectedId)" />
                </label>
                <label>
                    <span>{{ t("attendance.date") }}</span>
                    <input v-model="form.attendanceDate" type="date" class="native-input" />
                </label>
                <label>
                    <span>{{ t("attendance.firstIn") }}</span>
                    <input v-model="form.firstInAt" type="datetime-local" class="native-input" />
                </label>
                <label>
                    <span>{{ t("attendance.lastOut") }}</span>
                    <input v-model="form.lastOutAt" type="datetime-local" class="native-input" />
                </label>
                <label class="full-width">
                    <span>{{ t("common.note") }}</span>
                    <Textarea v-model="form.note" rows="3" />
                </label>
            </div>

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    text
                    @click="dialogVisible = false"
                />
                <Button
                    :label="t('common.save')"
                    :loading="attendanceStore.saving"
                    @click="saveRecord"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="importDialogVisible"
            modal
            :header="t('attendance.importTitle')"
        >
            <input type="file" accept=".xlsx" @change="onFileChange" />
            <ProgressBar
                v-if="attendanceStore.importing"
                :value="attendanceStore.importProgress"
                class="import-progress"
            />

            <template #footer>
                <Button
                    :label="t('common.cancel')"
                    severity="secondary"
                    text
                    @click="importDialogVisible = false"
                />
                <Button
                    :label="t('attendance.import')"
                    :disabled="!selectedFile"
                    :loading="attendanceStore.importing"
                    @click="runImport"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.attendance-page {
    display: grid;
    gap: 1rem;
}

.page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.page-header h1 {
    margin: 0;
}

.page-header p {
    margin: 0.35rem 0 0;
    color: var(--p-text-muted-color);
}

.page-actions,
.filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
}

.native-input {
    min-height: 2.5rem;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--p-form-field-border-color);
    border-radius: var(--p-form-field-border-radius);
    background: var(--p-form-field-background);
    color: var(--p-form-field-color);
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    min-width: min(42rem, 80vw);
}

.form-grid label {
    display: grid;
    gap: 0.4rem;
}

.full-width {
    grid-column: 1 / -1;
}

.import-progress {
    margin-top: 1rem;
}

@media (max-width: 768px) {
    .page-header {
        flex-direction: column;
    }

    .form-grid {
        grid-template-columns: 1fr;
        min-width: 0;
    }

    .full-width {
        grid-column: auto;
    }
}
</style>
