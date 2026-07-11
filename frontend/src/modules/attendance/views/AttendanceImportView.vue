<script setup>
import { onMounted, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Column from "primevue/column"
import DataTable from "primevue/datatable"
import InputText from "primevue/inputtext"
import ProgressBar from "primevue/progressbar"

import {
    downloadRawScanTemplate,
    fetchRawScans,
    importRawScans,
} from "../services/attendance.api.js"

const { t } = useI18n()
const toast = useToast()
const today = new Date().toISOString().slice(0, 10)
const firstDay = `${today.slice(0, 8)}01`

const loading = ref(false)
const importing = ref(false)
const progress = ref(0)
const selectedFile = ref(null)
const items = ref([])
const pagination = reactive({ page: 1, limit: 50, total: 0 })
const filters = reactive({
    dateFrom: firstDay,
    dateTo: today,
    search: "",
})

function formatDateTime(value) {
    return value ? new Intl.DateTimeFormat([], { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "-"
}

async function load(page = 1) {
    loading.value = true
    try {
        const result = await fetchRawScans({
            ...filters,
            page,
            limit: pagination.limit,
        })
        items.value = result.items || []
        Object.assign(pagination, result.pagination || {})
    } finally {
        loading.value = false
    }
}

function onFileChange(event) {
    selectedFile.value = event.target.files?.[0] || null
}

async function runImport() {
    if (!selectedFile.value) {
        return
    }

    importing.value = true
    progress.value = 1
    try {
        const summary = await importRawScans(selectedFile.value, (event) => {
            if (event.total) {
                progress.value = Math.min(95, Math.round((event.loaded * 100) / event.total))
            }
        })
        progress.value = 100
        toast.add({
            severity: summary.errorCount ? "warn" : "success",
            summary: t("common.success"),
            detail: `${summary.importedCount} imported, ${summary.duplicateCount} duplicates, ${summary.errorCount} errors`,
            life: 4000,
        })
        await load(1)
    } finally {
        importing.value = false
    }
}

onMounted(() => load(1))
</script>

<template>
    <section class="page-shell">
        <div class="page-header">
            <div>
                <h1>{{ t("attendance.scan.title") }}</h1>
                <p>{{ t("attendance.scan.description") }}</p>
            </div>
            <Button
                icon="pi pi-download"
                :label="t('attendance.scan.template')"
                severity="secondary"
                outlined
                @click="downloadRawScanTemplate"
            />
        </div>

        <Card>
            <template #content>
                <div class="import-row">
                    <input type="file" accept=".xlsx" @change="onFileChange" />
                    <Button
                        icon="pi pi-upload"
                        :label="t('attendance.scan.import')"
                        :disabled="!selectedFile"
                        :loading="importing"
                        @click="runImport"
                    />
                </div>
                <ProgressBar v-if="importing" :value="progress" class="progress" />
            </template>
        </Card>

        <Card>
            <template #content>
                <div class="filters">
                    <InputText v-model="filters.search" :placeholder="t('attendance.employeeId')" @keyup.enter="load(1)" />
                    <input v-model="filters.dateFrom" type="date" />
                    <input v-model="filters.dateTo" type="date" />
                    <Button icon="pi pi-search" :label="t('common.search')" @click="load(1)" />
                </div>

                <DataTable
                    :value="items"
                    :loading="loading"
                    paginator
                    lazy
                    :rows="pagination.limit"
                    :total-records="pagination.total"
                    @page="load($event.page + 1)"
                >
                    <Column field="employeeCode" :header="t('attendance.employeeId')" />
                    <Column :header="t('attendance.scan.scannedAt')">
                        <template #body="{ data }">{{ formatDateTime(data.scannedAt) }}</template>
                    </Column>
                    <Column field="direction" :header="t('attendance.scan.direction')" />
                    <Column field="deviceCode" :header="t('attendance.scan.device')" />
                    <Column field="importBatchId" :header="t('attendance.scan.batch')" />
                </DataTable>
            </template>
        </Card>
    </section>
</template>

<style scoped>
.page-shell {
    display: grid;
    gap: 1rem;
}

.page-header,
.import-row,
.filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.page-header h1 {
    margin: 0;
}

.page-header p {
    margin: 0.35rem 0 0;
    color: var(--text-color-secondary);
}

.progress {
    margin-top: 0.85rem;
}
</style>
