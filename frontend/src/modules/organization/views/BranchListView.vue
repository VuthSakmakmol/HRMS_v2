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
import InputText from "primevue/inputtext"
import Select from "primevue/select"
import Tag from "primevue/tag"
import Textarea from "primevue/textarea"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"
import { fetchCompanies } from "../services/company.api.js"
import { useBranchStore } from "../stores/branch.store.js"

const { t } = useI18n()
const toast = useToast()

const authStore = useAuthStore()
const uiStore = useUiStore()
const branchStore = useBranchStore()

const BRANCH_PERMISSIONS = Object.freeze({
    VIEW: "ORGANIZATION.BRANCH.VIEW",
    CREATE: "ORGANIZATION.BRANCH.CREATE",
    UPDATE: "ORGANIZATION.BRANCH.UPDATE",
    ARCHIVE: "ORGANIZATION.BRANCH.ARCHIVE",
})

const companies = ref([])
const companyLoading = ref(false)

const dialogVisible = ref(false)
const dialogMode = ref("create")
const selectedBranchId = ref(null)

const archiveDialogVisible = ref(false)
const archiveCandidate = ref(null)

const formErrors = ref({})

const filters = reactive({
    search: "",
    status: "ALL",
    companyId: "",
})

const form = reactive(createEmptyForm())

const canCreate = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.CREATE),
)

const canUpdate = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.UPDATE),
)

const canArchive = computed(() =>
    authStore.hasPermission(BRANCH_PERMISSIONS.ARCHIVE),
)

const dialogTitle = computed(() => {
    return dialogMode.value === "create"
        ? t("organization.branch.createTitle")
        : t("organization.branch.editTitle")
})

const companyOptions = computed(() =>
    companies.value.map((company) => ({
        label: `${company.code} - ${company.displayName}`,
        value: company.id,
    })),
)

const companyFilterOptions = computed(() => [
    {
        label: t("organization.branch.allCompanies"),
        value: "",
    },
    ...companyOptions.value,
])

const statusOptions = computed(() => [
    {
        label: t("organization.branch.statusAll"),
        value: "ALL",
    },
    {
        label: t("organization.branch.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.branch.statusInactive"),
        value: "INACTIVE",
    },
    {
        label: t("organization.branch.statusArchived"),
        value: "ARCHIVED",
    },
])

const editableStatusOptions = computed(() => [
    {
        label: t("organization.branch.statusActive"),
        value: "ACTIVE",
    },
    {
        label: t("organization.branch.statusInactive"),
        value: "INACTIVE",
    },
])

function createEmptyForm() {
    return {
        companyId: "",
        code: "",
        name: "",
        shortName: "",
        status: "ACTIVE",
        isHeadOffice: false,
        timezone: "Asia/Phnom_Penh",

        contact: {
            email: "",
            phone: "",
        },

        address: {
            addressLine1: "",
            addressLine2: "",
            city: "Phnom Penh",
            stateProvince: "",
            postalCode: "",
            countryCode: "KH",
        },
    }
}

function assignForm(source) {
    const nextForm = source || createEmptyForm()

    form.companyId = nextForm.companyId || ""
    form.code = nextForm.code || ""
    form.name = nextForm.name || ""
    form.shortName = nextForm.shortName || ""
    form.status = nextForm.status === "INACTIVE" ? "INACTIVE" : "ACTIVE"
    form.isHeadOffice = Boolean(nextForm.isHeadOffice)
    form.timezone = nextForm.timezone || "Asia/Phnom_Penh"

    form.contact.email = nextForm.contact?.email || ""
    form.contact.phone = nextForm.contact?.phone || ""

    form.address.addressLine1 = nextForm.address?.addressLine1 || ""
    form.address.addressLine2 = nextForm.address?.addressLine2 || ""
    form.address.city = nextForm.address?.city || ""
    form.address.stateProvince = nextForm.address?.stateProvince || ""
    form.address.postalCode = nextForm.address?.postalCode || ""
    form.address.countryCode = nextForm.address?.countryCode || "KH"
}

function buildCreatePayload() {
    return {
        companyId: form.companyId,
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        status: form.status,
        isHeadOffice: form.isHeadOffice,
        timezone: form.timezone,

        contact: {
            email: form.contact.email,
            phone: form.contact.phone,
        },

        address: {
            addressLine1: form.address.addressLine1,
            addressLine2: form.address.addressLine2,
            city: form.address.city,
            stateProvince: form.address.stateProvince,
            postalCode: form.address.postalCode,
            countryCode: form.address.countryCode,
        },
    }
}

function buildUpdatePayload() {
    return {
        code: form.code,
        name: form.name,
        shortName: form.shortName,
        status: form.status,
        isHeadOffice: form.isHeadOffice,
        timezone: form.timezone,

        contact: {
            email: form.contact.email,
            phone: form.contact.phone,
        },

        address: {
            addressLine1: form.address.addressLine1,
            addressLine2: form.address.addressLine2,
            city: form.address.city,
            stateProvince: form.address.stateProvince,
            postalCode: form.address.postalCode,
            countryCode: form.address.countryCode,
        },
    }
}

function getErrorMessage(error) {
    const messageKey = error?.response?.data?.error?.messageKey

    if (messageKey) {
        const translated = t(messageKey)

        return translated === messageKey ? t("errors.internal") : translated
    }

    return t("errors.internal")
}

function applyBackendFieldErrors(error) {
    const fields = error?.response?.data?.error?.fields || {}
    const nextErrors = {}

    for (const [field, messages] of Object.entries(fields)) {
        nextErrors[field] = Array.isArray(messages)
            ? messages.map((messageKey) => {
                  const translated = t(messageKey)

                  return translated === messageKey
                      ? t("errors.validationFailed")
                      : translated
              })
            : [t("errors.validationFailed")]
    }

    formErrors.value = nextErrors
}

function getFieldError(fieldName) {
    const messages = formErrors.value[fieldName]

    if (!messages?.length) {
        return ""
    }

    return messages[0]
}

function clearFieldError(fieldName) {
    if (!formErrors.value[fieldName]) {
        return
    }

    formErrors.value = {
        ...formErrors.value,
        [fieldName]: undefined,
    }
}

function normalizeCodeInput() {
    form.code = form.code
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^A-Z0-9_-]/g, "")

    clearFieldError("code")
}

function normalizeCountryCodeInput() {
    form.address.countryCode = form.address.countryCode
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 2)
}

function getStatusSeverity(status) {
    if (status === "ACTIVE") {
        return "success"
    }

    if (status === "INACTIVE") {
        return "warn"
    }

    if (status === "ARCHIVED") {
        return "danger"
    }

    return "secondary"
}

function getStatusLabel(status) {
    if (status === "ACTIVE") {
        return t("organization.branch.statusActive")
    }

    if (status === "INACTIVE") {
        return t("organization.branch.statusInactive")
    }

    if (status === "ARCHIVED") {
        return t("organization.branch.statusArchived")
    }

    return status || "-"
}

function formatDateTime(value) {
    if (!value) {
        return "-"
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
        return "-"
    }

    return new Intl.DateTimeFormat(uiStore.locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date)
}

async function loadCompanies() {
    companyLoading.value = true

    try {
        const result = await fetchCompanies({
            page: 1,
            limit: 100,
            status: "ACTIVE",
            search: "",
        })

        companies.value = result.items || []
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.companyLoadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    } finally {
        companyLoading.value = false
    }
}

async function loadBranches(params = {}) {
    try {
        await branchStore.loadBranches(params)
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.loadFailed"),
            detail: getErrorMessage(error),
            life: 4500,
        })
    }
}

function applyFilters() {
    loadBranches({
        page: 1,
        limit: branchStore.filters.limit,
        search: filters.search,
        status: filters.status,
        companyId: filters.companyId || undefined,
    })
}

function clearFilters() {
    filters.search = ""
    filters.status = "ALL"
    filters.companyId = ""

    loadBranches({
        page: 1,
        search: "",
        status: "ALL",
        companyId: undefined,
    })
}

function onPage(event) {
    loadBranches({
        page: event.page + 1,
        limit: event.rows,
    })
}

async function openCreateDialog() {
    if (companies.value.length === 0) {
        await loadCompanies()
    }

    dialogMode.value = "create"
    selectedBranchId.value = null
    formErrors.value = {}
    assignForm(createEmptyForm())

    if (companies.value.length === 1) {
        form.companyId = companies.value[0].id
    }

    dialogVisible.value = true
}

function openEditDialog(branch) {
    dialogMode.value = "edit"
    selectedBranchId.value = branch.id
    formErrors.value = {}
    assignForm(branch)
    dialogVisible.value = true
}

function closeDialog() {
    dialogVisible.value = false
    selectedBranchId.value = null
    formErrors.value = {}
}

async function saveBranch() {
    formErrors.value = {}

    try {
        if (dialogMode.value === "create") {
            await branchStore.createBranch(buildCreatePayload())

            toast.add({
                severity: "success",
                summary: t("organization.branch.created"),
                detail: t("organization.branch.createdDetail"),
                life: 3000,
            })
        } else {
            await branchStore.updateBranch(
                selectedBranchId.value,
                buildUpdatePayload(),
            )

            toast.add({
                severity: "success",
                summary: t("organization.branch.updated"),
                detail: t("organization.branch.updatedDetail"),
                life: 3000,
            })
        }

        closeDialog()
        await loadBranches()
    } catch (error) {
        applyBackendFieldErrors(error)

        toast.add({
            severity: "error",
            summary: t("organization.branch.saveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

function openArchiveDialog(branch) {
    archiveCandidate.value = branch
    archiveDialogVisible.value = true
}

function closeArchiveDialog() {
    archiveDialogVisible.value = false
    archiveCandidate.value = null
}

async function confirmArchiveBranch() {
    if (!archiveCandidate.value?.id) {
        return
    }

    try {
        await branchStore.archiveBranch(archiveCandidate.value.id)

        toast.add({
            severity: "success",
            summary: t("organization.branch.archived"),
            detail: t("organization.branch.archivedDetail"),
            life: 3000,
        })

        closeArchiveDialog()
        await loadBranches()
    } catch (error) {
        toast.add({
            severity: "error",
            summary: t("organization.branch.archiveFailed"),
            detail: getErrorMessage(error),
            life: 5000,
        })
    }
}

onMounted(async () => {
    await Promise.all([loadCompanies(), loadBranches()])
})
</script>

<template>
    <section class="branch-page">
        <div class="branch-page__header">
            <div>
                <span class="branch-page__eyebrow">
                    {{ t("organization.branch.eyebrow") }}
                </span>

                <h2>{{ t("organization.branch.title") }}</h2>

                <p>
                    {{ t("organization.branch.description") }}
                </p>
            </div>

            <Button
                v-if="canCreate"
                icon="pi pi-plus"
                :label="t('organization.branch.newBranch')"
                @click="openCreateDialog"
            />
        </div>

        <Card class="branch-card">
            <template #content>
                <div class="branch-toolbar">
                    <div class="branch-toolbar__filters">
                        <span class="branch-search">
                            <i class="pi pi-search" />

                            <InputText
                                v-model="filters.search"
                                class="branch-search__input"
                                :placeholder="
                                    t('organization.branch.searchPlaceholder')
                                "
                                @keyup.enter="applyFilters"
                            />
                        </span>

                        <Select
                            v-model="filters.companyId"
                            class="branch-company-filter"
                            :options="companyFilterOptions"
                            option-label="label"
                            option-value="value"
                            :loading="companyLoading"
                            @change="applyFilters"
                        />

                        <Select
                            v-model="filters.status"
                            class="branch-status-filter"
                            :options="statusOptions"
                            option-label="label"
                            option-value="value"
                            @change="applyFilters"
                        />
                    </div>

                    <div class="branch-toolbar__actions">
                        <Button
                            size="small"
                            icon="pi pi-filter"
                            :label="t('common.apply')"
                            @click="applyFilters"
                        />

                        <Button
                            size="small"
                            severity="secondary"
                            outlined
                            icon="pi pi-times"
                            :label="t('common.clear')"
                            @click="clearFilters"
                        />

                        <Button
                            size="small"
                            severity="secondary"
                            outlined
                            icon="pi pi-refresh"
                            :label="t('common.refresh')"
                            @click="loadBranches"
                        />
                    </div>
                </div>

                <div class="branch-table-wrap">
                    <DataTable
                        lazy
                        paginator
                        striped-rows
                        data-key="id"
                        size="small"
                        scrollable
                        scroll-height="flex"
                        :value="branchStore.items"
                        :loading="branchStore.loading"
                        :rows="branchStore.pagination.limit"
                        :first="
                            (branchStore.pagination.page - 1) *
                            branchStore.pagination.limit
                        "
                        :total-records="branchStore.pagination.total"
                        :rows-per-page-options="[10, 20, 50, 100]"
                        :empty-message="t('organization.branch.empty')"
                        @page="onPage"
                    >
                        <Column
                            field="code"
                            :header="t('organization.branch.code')"
                            frozen
                            style="min-width: 8rem"
                        >
                            <template #body="{ data }">
                                <strong class="branch-code">
                                    {{ data.code }}
                                </strong>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.branch.branchName')"
                            style="min-width: 14rem"
                        >
                            <template #body="{ data }">
                                <div class="branch-name-cell">
                                    <strong>{{ data.name }}</strong>
                                    <span>{{ data.shortName || "-" }}</span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.branch.company')"
                            style="min-width: 14rem"
                        >
                            <template #body="{ data }">
                                <div class="branch-muted-cell">
                                    <strong>
                                        {{ data.company?.displayName || "-" }}
                                    </strong>
                                    <span>{{ data.company?.code || "-" }}</span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            field="status"
                            :header="t('organization.branch.status')"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    :severity="getStatusSeverity(data.status)"
                                    :value="getStatusLabel(data.status)"
                                />
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.branch.type')"
                            style="min-width: 9rem"
                        >
                            <template #body="{ data }">
                                <Tag
                                    v-if="data.isHeadOffice"
                                    severity="info"
                                    :value="t('organization.branch.headOffice')"
                                />

                                <span v-else class="branch-muted-text">
                                    {{ t("organization.branch.branch") }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.branch.contact')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <div class="branch-muted-cell">
                                    <span>{{ data.contact?.email || "-" }}</span>
                                    <span>{{ data.contact?.phone || "-" }}</span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            :header="t('organization.branch.location')"
                            style="min-width: 13rem"
                        >
                            <template #body="{ data }">
                                <div class="branch-muted-cell">
                                    <span>{{ data.address?.city || "-" }}</span>
                                    <span>
                                        {{ data.address?.countryCode || "-" }}
                                    </span>
                                </div>
                            </template>
                        </Column>

                        <Column
                            field="updatedAt"
                            :header="t('organization.branch.updatedAt')"
                            style="min-width: 11rem"
                        >
                            <template #body="{ data }">
                                <span class="branch-date">
                                    {{ formatDateTime(data.updatedAt) }}
                                </span>
                            </template>
                        </Column>

                        <Column
                            :header="t('common.actions')"
                            align-frozen="right"
                            frozen
                            style="min-width: 10rem"
                        >
                            <template #body="{ data }">
                                <div class="branch-actions">
                                    <Button
                                        v-if="
                                            canUpdate &&
                                            data.status !== 'ARCHIVED'
                                        "
                                        size="small"
                                        text
                                        rounded
                                        icon="pi pi-pencil"
                                        :aria-label="t('common.edit')"
                                        @click="openEditDialog(data)"
                                    />

                                    <Button
                                        v-if="
                                            canArchive &&
                                            data.status !== 'ARCHIVED'
                                        "
                                        size="small"
                                        text
                                        rounded
                                        severity="danger"
                                        icon="pi pi-archive"
                                        :aria-label="t('common.archive')"
                                        @click="openArchiveDialog(data)"
                                    />

                                    <span
                                        v-if="data.status === 'ARCHIVED'"
                                        class="branch-archived-text"
                                    >
                                        {{ t("organization.branch.readOnly") }}
                                    </span>
                                </div>
                            </template>
                        </Column>
                    </DataTable>
                </div>
            </template>
        </Card>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            class="branch-dialog"
            :header="dialogTitle"
            :draggable="false"
        >
            <div class="branch-form">
                <div class="branch-form__section">
                    <h3>{{ t("organization.branch.basicInfo") }}</h3>

                    <div class="branch-form__grid">
                        <label class="branch-field branch-field--wide">
                            <span>{{ t("organization.branch.company") }}</span>

                            <Select
                                v-model="form.companyId"
                                :disabled="dialogMode === 'edit'"
                                :invalid="Boolean(getFieldError('companyId'))"
                                :options="companyOptions"
                                option-label="label"
                                option-value="value"
                                :placeholder="
                                    t('organization.branch.selectCompany')
                                "
                                :loading="companyLoading"
                                @change="clearFieldError('companyId')"
                            />

                            <small v-if="getFieldError('companyId')">
                                {{ getFieldError("companyId") }}
                            </small>
                        </label>

                        <label class="branch-field">
                            <span>{{ t("organization.branch.code") }}</span>

                            <InputText
                                v-model="form.code"
                                :invalid="Boolean(getFieldError('code'))"
                                autocomplete="off"
                                placeholder="PP-HQ"
                                @input="normalizeCodeInput"
                            />

                            <small v-if="getFieldError('code')">
                                {{ getFieldError("code") }}
                            </small>
                        </label>

                        <label class="branch-field">
                            <span>{{ t("organization.branch.shortName") }}</span>

                            <InputText
                                v-model="form.shortName"
                                autocomplete="off"
                                placeholder="HQ"
                            />
                        </label>

                        <label class="branch-field branch-field--wide">
                            <span>{{ t("organization.branch.name") }}</span>

                            <InputText
                                v-model="form.name"
                                :invalid="Boolean(getFieldError('name'))"
                                autocomplete="off"
                                placeholder="Phnom Penh Head Office"
                                @input="clearFieldError('name')"
                            />

                            <small v-if="getFieldError('name')">
                                {{ getFieldError("name") }}
                            </small>
                        </label>

                        <label class="branch-field">
                            <span>{{ t("organization.branch.status") }}</span>

                            <Select
                                v-model="form.status"
                                :options="editableStatusOptions"
                                option-label="label"
                                option-value="value"
                            />
                        </label>

                        <label class="branch-field">
                            <span>{{ t("organization.branch.timezone") }}</span>

                            <InputText
                                v-model="form.timezone"
                                autocomplete="off"
                            />
                        </label>

                        <div class="branch-field branch-field--wide">
                            <div class="branch-checkbox-row">
                                <Checkbox
                                    v-model="form.isHeadOffice"
                                    input-id="isHeadOffice"
                                    binary
                                    @change="clearFieldError('isHeadOffice')"
                                />

                                <label for="isHeadOffice">
                                    {{
                                        t(
                                            "organization.branch.markAsHeadOffice",
                                        )
                                    }}
                                </label>
                            </div>

                            <small v-if="getFieldError('isHeadOffice')">
                                {{ getFieldError("isHeadOffice") }}
                            </small>
                        </div>
                    </div>
                </div>

                <div class="branch-form__section">
                    <h3>{{ t("organization.branch.contactAddress") }}</h3>

                    <div class="branch-form__grid">
                        <label class="branch-field">
                            <span>{{ t("organization.branch.email") }}</span>

                            <InputText
                                v-model="form.contact.email"
                                :invalid="
                                    Boolean(getFieldError('contact.email'))
                                "
                                autocomplete="off"
                                placeholder="branch@trax.local"
                                @input="clearFieldError('contact.email')"
                            />

                            <small v-if="getFieldError('contact.email')">
                                {{ getFieldError("contact.email") }}
                            </small>
                        </label>

                        <label class="branch-field">
                            <span>{{ t("organization.branch.phone") }}</span>

                            <InputText
                                v-model="form.contact.phone"
                                autocomplete="off"
                            />
                        </label>

                        <label class="branch-field branch-field--wide">
                            <span>
                                {{ t("organization.branch.addressLine1") }}
                            </span>

                            <Textarea
                                v-model="form.address.addressLine1"
                                rows="2"
                                auto-resize
                            />
                        </label>

                        <label class="branch-field">
                            <span>{{ t("organization.branch.city") }}</span>

                            <InputText
                                v-model="form.address.city"
                                autocomplete="off"
                            />
                        </label>

                        <label class="branch-field">
                            <span>
                                {{ t("organization.branch.stateProvince") }}
                            </span>

                            <InputText
                                v-model="form.address.stateProvince"
                                autocomplete="off"
                            />
                        </label>

                        <label class="branch-field">
                            <span>
                                {{ t("organization.branch.postalCode") }}
                            </span>

                            <InputText
                                v-model="form.address.postalCode"
                                autocomplete="off"
                            />
                        </label>

                        <label class="branch-field">
                            <span>
                                {{ t("organization.branch.countryCode") }}
                            </span>

                            <InputText
                                v-model="form.address.countryCode"
                                maxlength="2"
                                autocomplete="off"
                                @input="normalizeCountryCodeInput"
                            />
                        </label>
                    </div>
                </div>
            </div>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :label="t('common.cancel')"
                    @click="closeDialog"
                />

                <Button
                    icon="pi pi-save"
                    :loading="branchStore.saving"
                    :label="t('common.save')"
                    @click="saveBranch"
                />
            </template>
        </Dialog>

        <Dialog
            v-model:visible="archiveDialogVisible"
            modal
            class="branch-archive-dialog"
            :header="t('organization.branch.archiveTitle')"
            :draggable="false"
        >
            <p class="branch-archive-text">
                {{
                    t("organization.branch.archiveMessage", {
                        name: archiveCandidate?.name || "-",
                    })
                }}
            </p>

            <template #footer>
                <Button
                    severity="secondary"
                    outlined
                    :label="t('common.cancel')"
                    @click="closeArchiveDialog"
                />

                <Button
                    severity="danger"
                    icon="pi pi-archive"
                    :loading="branchStore.archiving"
                    :label="t('common.archive')"
                    @click="confirmArchiveBranch"
                />
            </template>
        </Dialog>
    </section>
</template>

<style scoped>
.branch-page {
    width: 100%;
    display: grid;
    gap: 1rem;
}

.branch-page__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
}

.branch-page__eyebrow {
    color: var(--hrms-primary);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.branch-page h2 {
    margin: 0.35rem 0;
    color: var(--hrms-text);
    font-size: 1.45rem;
    line-height: 1.2;
}

.branch-page p {
    max-width: 54rem;
    margin: 0;
    color: var(--hrms-text-muted);
    font-size: 0.78rem;
    line-height: 1.6;
}

.branch-card {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--hrms-border);
    box-shadow: var(--hrms-shadow-sm);
}

.branch-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
}

.branch-toolbar__filters,
.branch-toolbar__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.branch-toolbar__filters {
    min-width: 0;
    flex: 1 1 auto;
}

.branch-toolbar__actions {
    flex: 0 0 auto;
}

.branch-search {
    width: min(100%, 23rem);
    position: relative;
    display: block;
}

.branch-search i {
    position: absolute;
    top: 50%;
    left: 0.75rem;
    transform: translateY(-50%);
    color: var(--hrms-text-muted);
    font-size: 0.78rem;
}

.branch-search__input {
    width: 100%;
    padding-left: 2.1rem;
}

.branch-company-filter {
    width: 15rem;
}

.branch-status-filter {
    width: 12rem;
}

.branch-table-wrap {
    width: 100%;
    min-width: 0;
    overflow-x: auto;
}

.branch-code {
    color: var(--hrms-primary);
    font-size: 0.78rem;
}

.branch-name-cell,
.branch-muted-cell {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
}

.branch-name-cell strong,
.branch-muted-cell strong,
.branch-muted-cell span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.branch-name-cell strong,
.branch-muted-cell strong {
    color: var(--hrms-text);
    font-size: 0.78rem;
}

.branch-name-cell span,
.branch-muted-cell span,
.branch-date,
.branch-muted-text,
.branch-archived-text {
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
}

.branch-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
}

.branch-dialog {
    width: min(62rem, calc(100vw - 2rem));
}

.branch-archive-dialog {
    width: min(31rem, calc(100vw - 2rem));
}

.branch-form {
    display: grid;
    gap: 1rem;
}

.branch-form__section {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem;
    background: var(--hrms-surface-muted);
    border: 1px solid var(--hrms-border);
    border-radius: var(--hrms-radius-md);
}

.branch-form__section h3 {
    margin: 0;
    color: var(--hrms-text);
    font-size: 0.82rem;
}

.branch-form__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
}

.branch-field {
    display: grid;
    gap: 0.35rem;
}

.branch-field--wide {
    grid-column: 1 / -1;
}

.branch-field span,
.branch-checkbox-row label {
    color: var(--hrms-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
}

.branch-field small {
    color: var(--hrms-danger);
    font-size: 0.68rem;
}

.branch-checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 2.4rem;
}

.branch-archive-text {
    margin: 0;
    color: var(--hrms-text);
    font-size: 0.82rem;
    line-height: 1.6;
}

:deep(.p-card-body),
:deep(.p-card-content) {
    padding: 0;
}

:deep(.p-card-content) {
    padding: 1rem;
}

:deep(.p-datatable) {
    font-size: 0.74rem;
}

:deep(.p-datatable-thead > tr > th) {
    color: var(--hrms-text);
    background: var(--hrms-surface-muted);
    font-size: 0.7rem;
    font-weight: 800;
    white-space: nowrap;
}

:deep(.p-datatable-tbody > tr > td),
:deep(.p-datatable-thead > tr > th) {
    text-align: center;
    vertical-align: middle;
}

:deep(.p-datatable-tbody > tr > td) {
    border-color: var(--hrms-border);
}

:deep(.p-dialog-header),
:deep(.p-dialog-footer) {
    padding: 1rem;
}

:deep(.p-dialog-content) {
    padding: 0 1rem 1rem;
}

@media (max-width: 1050px) {
    .branch-toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .branch-toolbar__filters,
    .branch-toolbar__actions {
        width: 100%;
        flex-wrap: wrap;
    }

    .branch-search,
    .branch-company-filter,
    .branch-status-filter {
        width: 100%;
    }
}

@media (max-width: 900px) {
    .branch-page__header {
        flex-direction: column;
        align-items: stretch;
    }
}

@media (max-width: 650px) {
    .branch-form__grid {
        grid-template-columns: 1fr;
    }

    .branch-page h2 {
        font-size: 1.2rem;
    }
}
</style>