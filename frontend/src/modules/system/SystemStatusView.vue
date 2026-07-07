<script setup>
import { computed, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"

import Button from "primevue/button"
import Card from "primevue/card"
import Message from "primevue/message"
import Tag from "primevue/tag"

import { useUiStore } from "@/app/stores/ui.store.js"
import { apiClient } from "@/shared/services/apiClient.js"

const { t } = useI18n()
const uiStore = useUiStore()

const apiState = ref("loading")
const apiResult = ref(null)
const apiError = ref("")

const apiSeverity = computed(() => {
    if (apiState.value === "success") return "success"
    if (apiState.value === "error") return "danger"
    return "info"
})

const apiStatusText = computed(() => {
    if (apiState.value === "success") return t("foundation.apiConnected")
    if (apiState.value === "error") return t("foundation.apiUnavailable")
    return t("foundation.apiChecking")
})

const databaseStatusText = computed(() => {
    if (!apiResult.value?.database?.configured) {
        return t("foundation.databasePending")
    }

    if (apiResult.value.database.state === "connected") {
        return t("foundation.databaseConnected")
    }

    return apiResult.value.database.state
})

const lastCheckedText = computed(() => {
    if (!apiResult.value?.timestamp) {
        return t("foundation.noCheckYet")
    }

    return new Intl.DateTimeFormat(uiStore.locale, {
        dateStyle: "medium",
        timeStyle: "medium",
    }).format(new Date(apiResult.value.timestamp))
})

async function checkApi() {
    apiState.value = "loading"
    apiError.value = ""

    try {
        const response = await apiClient.get("/health")

        apiResult.value = response.data.data
        apiState.value = "success"
    } catch (error) {
        apiState.value = "error"

        const messageKey = error.response?.data?.error?.messageKey

        apiError.value = messageKey
            ? t(messageKey)
            : t("foundation.apiUnavailable")
    }
}

onMounted(checkApi)
</script>

<template>
    <main class="foundation-page">
        <header class="foundation-topbar">
            <div class="foundation-brand">
                <div class="foundation-brand__icon">
                    <i class="pi pi-building" />
                </div>

                <div>
                    <strong>{{ t("app.name") }}</strong>
                    <span>{{ t("app.subtitle") }}</span>
                </div>
            </div>

            <div class="foundation-actions">
                <Button
                    size="small"
                    :outlined="uiStore.locale !== 'en-US'"
                    label="EN"
                    @click="uiStore.setLocale('en-US')"
                />

                <Button
                    size="small"
                    :outlined="uiStore.locale !== 'km-KH'"
                    label="ខ្មែរ"
                    @click="uiStore.setLocale('km-KH')"
                />

                <Button
                    rounded
                    text
                    :icon="
                        uiStore.colorMode === 'dark'
                            ? 'pi pi-sun'
                            : 'pi pi-moon'
                    "
                    :aria-label="
                        uiStore.colorMode === 'dark'
                            ? t('common.lightMode')
                            : t('common.darkMode')
                    "
                    @click="uiStore.toggleColorMode()"
                />
            </div>
        </header>

        <section class="foundation-content">
            <div class="foundation-heading">
                <span>{{ t("foundation.eyebrow") }}</span>
                <h1>{{ t("foundation.title") }}</h1>
                <p>{{ t("foundation.description") }}</p>
            </div>

            <section class="foundation-grid">
                <Card class="foundation-card">
                    <template #title>
                        <div class="foundation-card__title">
                            <i class="pi pi-server" />
                            <span>{{ t("foundation.apiConnection") }}</span>
                        </div>
                    </template>

                    <template #content>
                        <div class="foundation-card__content">
                            <div class="foundation-status-row">
                                <div>
                                    <strong>{{ apiStatusText }}</strong>
                                    <span>{{ t("foundation.lastChecked") }}</span>
                                </div>

                                <Tag
                                    :severity="apiSeverity"
                                    :value="apiStatusText"
                                />
                            </div>

                            <div class="foundation-value">
                                {{ lastCheckedText }}
                            </div>

                            <Message
                                v-if="apiState === 'error'"
                                severity="error"
                                :closable="false"
                            >
                                {{ apiError }}
                            </Message>

                            <Button
                                size="small"
                                :loading="apiState === 'loading'"
                                :label="t('common.retry')"
                                icon="pi pi-refresh"
                                @click="checkApi"
                            />
                        </div>
                    </template>
                </Card>

                <Card class="foundation-card">
                    <template #title>
                        <div class="foundation-card__title">
                            <i class="pi pi-database" />
                            <span>{{ t("foundation.databaseConnection") }}</span>
                        </div>
                    </template>

                    <template #content>
                        <div class="foundation-card__content">
                            <div class="foundation-status-row">
                                <div>
                                    <strong>{{ databaseStatusText }}</strong>
                                    <span>
                                        {{ t("foundation.databaseConnection") }}
                                    </span>
                                </div>

                                <Tag
                                    :severity="
                                        apiResult?.database?.configured
                                            ? 'success'
                                            : 'warn'
                                    "
                                    :value="databaseStatusText"
                                />
                            </div>

                            <div class="foundation-value">
                                {{
                                    apiResult?.database?.configured
                                        ? apiResult.database.state
                                        : "MONGO_URI"
                                }}
                            </div>
                        </div>
                    </template>
                </Card>

                <Card class="foundation-card">
                    <template #title>
                        <div class="foundation-card__title">
                            <i class="pi pi-language" />
                            <span>{{ t("foundation.language") }}</span>
                        </div>
                    </template>

                    <template #content>
                        <div class="foundation-card__content">
                            <div class="foundation-value">
                                {{
                                    uiStore.locale === "km-KH"
                                        ? t("common.khmer")
                                        : t("common.english")
                                }}
                            </div>

                            <span class="foundation-muted">
                                English and Khmer are controlled from shared
                                locale files.
                            </span>
                        </div>
                    </template>
                </Card>

                <Card class="foundation-card">
                    <template #title>
                        <div class="foundation-card__title">
                            <i class="pi pi-palette" />
                            <span>{{ t("foundation.theme") }}</span>
                        </div>
                    </template>

                    <template #content>
                        <div class="foundation-card__content">
                            <div class="foundation-value">
                                {{
                                    uiStore.colorMode === "dark"
                                        ? t("common.darkMode")
                                        : t("common.lightMode")
                                }}
                            </div>

                            <span class="foundation-muted">
                                Colors, fonts, surfaces, and status colors
                                come from one brand configuration.
                            </span>
                        </div>
                    </template>
                </Card>
            </section>
        </section>
    </main>
</template>

<style scoped>
.foundation-page {
    min-height: 100vh;
    background: var(--hrms-app-background);
}

.foundation-topbar {
    min-height: 4.25rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--hrms-space-4);
    padding: var(--hrms-space-3) var(--hrms-space-5);
    background: var(--hrms-surface);
    border-bottom: 1px solid var(--hrms-border);
}

.foundation-brand {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-3);
}

.foundation-brand__icon {
    width: 2.25rem;
    height: 2.25rem;
    display: grid;
    place-items: center;
    color: white;
    border-radius: var(--hrms-radius-md);
    background: var(--hrms-primary);
}

.foundation-brand strong,
.foundation-brand span {
    display: block;
}

.foundation-brand strong {
    font-size: 0.9rem;
}

.foundation-brand span,
.foundation-muted,
.foundation-status-row span {
    color: var(--hrms-text-muted);
    font-size: 0.75rem;
}

.foundation-actions {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-2);
}

.foundation-content {
    width: 100%;
    padding: 2rem;
}

.foundation-heading {
    max-width: 50rem;
    margin-bottom: 1.5rem;
}

.foundation-heading > span {
    color: var(--hrms-primary);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.foundation-heading h1 {
    margin: 0.5rem 0;
    color: var(--hrms-text);
    font-size: clamp(1.35rem, 2vw, 2rem);
}

.foundation-heading p {
    max-width: 46rem;
    margin: 0;
    color: var(--hrms-text-muted);
    line-height: 1.6;
}

.foundation-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
}

.foundation-card {
    min-width: 0;
    border: 1px solid var(--hrms-border);
    box-shadow: var(--hrms-shadow-sm);
}

.foundation-card__title {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-2);
    color: var(--hrms-text);
    font-size: 0.85rem;
}

.foundation-card__content {
    display: grid;
    gap: var(--hrms-space-3);
}

.foundation-status-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--hrms-space-3);
}

.foundation-status-row strong {
    display: block;
    color: var(--hrms-text);
    font-size: 0.85rem;
}

.foundation-value {
    color: var(--hrms-text);
    font-weight: 600;
    word-break: break-word;
}

@media (max-width: 1100px) {
    .foundation-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 640px) {
    .foundation-topbar,
    .foundation-content {
        padding-left: 1rem;
        padding-right: 1rem;
    }

    .foundation-grid {
        grid-template-columns: 1fr;
    }

    .foundation-brand span {
        display: none;
    }
}
</style>