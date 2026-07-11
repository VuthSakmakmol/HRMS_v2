<script setup>
import { reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useToast } from "primevue/usetoast"

import Button from "primevue/button"
import Card from "primevue/card"
import Checkbox from "primevue/checkbox"
import Message from "primevue/message"
import ProgressSpinner from "primevue/progressspinner"

import { useModulePermissions } from "@/shared/auth/useModulePermissions.js"
import { runAttendanceVerification } from "../services/attendance.api.js"

const { t } = useI18n()
const toast = useToast()

const { canRun } = (() => {
    const permissions = useModulePermissions({ run: "ATTENDANCE.VERIFICATION.RUN" })
    return { canRun: permissions.has("ATTENDANCE.VERIFICATION.RUN") }
})()
const today = new Date().toISOString().slice(0, 10)

const running = ref(false)
const summary = ref(null)
const form = reactive({
    dateFrom: today,
    dateTo: today,
    overwriteCorrected: false,
})

async function runVerification() {
    running.value = true
    summary.value = null
    try {
        summary.value = await runAttendanceVerification({ ...form })
        toast.add({
            severity: "success",
            summary: t("common.success"),
            detail: t("attendance.verification.completed"),
            life: 3000,
        })
    } finally {
        running.value = false
    }
}
</script>

<template>
    <section class="page-shell">
        <div class="page-header">
            <div>
                <h1>{{ t("attendance.verification.title") }}</h1>
                <p>{{ t("attendance.verification.description") }}</p>
            </div>
        </div>

        <Card>
            <template #content>
                <div class="form-row">
                    <label>
                        <span>{{ t("common.dateFrom") }}</span>
                        <input v-model="form.dateFrom" type="date" />
                    </label>
                    <label>
                        <span>{{ t("common.dateTo") }}</span>
                        <input v-model="form.dateTo" type="date" />
                    </label>
                    <div class="check-row">
                        <Checkbox v-model="form.overwriteCorrected" binary input-id="overwriteCorrected" />
                        <label for="overwriteCorrected">{{ t("attendance.verification.overwriteCorrected") }}</label>
                    </div>
                    <Button
                        v-if="canRun"
                        icon="pi pi-play"
                        :label="t('attendance.verification.run')"
                        :loading="running"
                        @click="runVerification"
                    />
                </div>
            </template>
        </Card>

        <Card v-if="running">
            <template #content>
                <div class="loading-state">
                    <ProgressSpinner />
                    <p>{{ t("attendance.verification.running") }}</p>
                </div>
            </template>
        </Card>

        <Card v-if="summary">
            <template #content>
                <Message severity="success" :closable="false">
                    {{ t("attendance.verification.completed") }}
                </Message>
                <div class="summary-grid">
                    <article><strong>{{ summary.employeeCount }}</strong><span>{{ t("attendance.verification.employees") }}</span></article>
                    <article><strong>{{ summary.processedCount }}</strong><span>{{ t("attendance.verification.processed") }}</span></article>
                    <article><strong>{{ summary.presentCount }}</strong><span>{{ t("attendance.status.present") }}</span></article>
                    <article><strong>{{ summary.absentCount }}</strong><span>{{ t("attendance.status.absent") }}</span></article>
                    <article><strong>{{ summary.reviewCount }}</strong><span>{{ t("attendance.verification.review") }}</span></article>
                    <article><strong>{{ summary.restDayCount }}</strong><span>{{ t("attendance.status.restDay") }}</span></article>
                    <article><strong>{{ summary.holidayCount }}</strong><span>{{ t("attendance.status.holiday") }}</span></article>
                    <article><strong>{{ summary.skippedCount }}</strong><span>{{ t("attendance.verification.skipped") }}</span></article>
                </div>
            </template>
        </Card>
    </section>
</template>

<style scoped>
.page-shell {
    display: grid;
    gap: 1rem;
}

.page-header h1 {
    margin: 0;
}

.page-header p {
    margin: 0.35rem 0 0;
    color: var(--text-color-secondary);
}

.form-row {
    display: flex;
    align-items: end;
    gap: 1rem;
    flex-wrap: wrap;
}

.form-row label {
    display: grid;
    gap: 0.35rem;
}

.check-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.45rem;
}

.loading-state {
    display: grid;
    place-items: center;
    gap: 0.75rem;
    min-height: 180px;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.85rem;
    margin-top: 1rem;
}

.summary-grid article {
    display: grid;
    gap: 0.25rem;
    padding: 1rem;
    border: 1px solid var(--surface-border);
    border-radius: 0.75rem;
}

.summary-grid strong {
    font-size: 1.6rem;
}

.summary-grid span {
    color: var(--text-color-secondary);
}

@media (max-width: 800px) {
    .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}
</style>
