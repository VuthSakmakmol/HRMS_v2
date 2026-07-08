<script setup>
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute, useRouter } from "vue-router"

import Button from "primevue/button"

import { useAuthStore } from "@/app/stores/auth.store.js"
import { useUiStore } from "@/app/stores/ui.store.js"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const uiStore = useUiStore()

const sidebarOpen = ref(false)

const pageTitle = computed(() =>
    t(route.meta.titleKey || "nav.overview"),
)

const roleLabel = computed(() => {
    if (authStore.isRootAdmin) {
        return t("auth.rootAdministrator")
    }

    return authStore.user?.roleCodes?.join(", ") || "-"
})

const navItems = [
    {
        labelKey: "nav.overview",
        icon: "pi pi-th-large",
        to: {
            name: "workspace",
        },
    },
]

function closeSidebar() {
    sidebarOpen.value = false
}

function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
}

async function logout() {
    authStore.logout()
    closeSidebar()

    await router.replace({
        name: "login",
    })
}
</script>

<template>
    <div class="app-shell">
        <div
            v-if="sidebarOpen"
            class="app-shell__overlay"
            @click="closeSidebar"
        />

        <aside
            class="app-sidebar"
            :class="{
                'app-sidebar--open': sidebarOpen,
            }"
        >
            <div class="app-sidebar__brand">
                <div class="app-sidebar__brand-icon">
                    <i class="pi pi-building" />
                </div>

                <div class="app-sidebar__brand-text">
                    <strong>{{ t("app.name") }}</strong>
                    <span>{{ t("app.subtitle") }}</span>
                </div>
            </div>

            <nav class="app-sidebar__nav">
                <span class="app-sidebar__section-label">
                    {{ t("nav.workspace") }}
                </span>

                <RouterLink
                    v-for="item in navItems"
                    :key="item.labelKey"
                    :to="item.to"
                    class="app-sidebar__link"
                    active-class="app-sidebar__link--active"
                    @click="closeSidebar"
                >
                    <i :class="item.icon" />
                    <span>{{ t(item.labelKey) }}</span>
                </RouterLink>
            </nav>

            <div class="app-sidebar__bottom">
                <div class="app-sidebar__profile">
                    <div class="app-sidebar__avatar">
                        {{
                            (authStore.user?.displayName || "?")
                                .slice(0, 1)
                                .toUpperCase()
                        }}
                    </div>

                    <div class="app-sidebar__profile-text">
                        <strong>{{ authStore.user?.displayName }}</strong>
                        <span>{{ roleLabel }}</span>
                    </div>
                </div>

                <Button
                    class="app-sidebar__logout"
                    severity="danger"
                    text
                    icon="pi pi-sign-out"
                    :label="t('common.logout')"
                    @click="logout"
                />
            </div>
        </aside>

        <section class="app-main">
            <header class="app-topbar">
                <div class="app-topbar__left">
                    <Button
                        class="app-topbar__menu-button"
                        text
                        rounded
                        icon="pi pi-bars"
                        :aria-label="t('common.menu')"
                        @click="toggleSidebar"
                    />

                    <div>
                        <h1>{{ pageTitle }}</h1>
                        <span>{{ t("app.subtitle") }}</span>
                    </div>
                </div>

                <div class="app-topbar__actions">
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
                        text
                        rounded
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

            <main class="app-content">
                <RouterView />
            </main>
        </section>
    </div>
</template>

<style scoped>
.app-shell {
    min-height: 100vh;
    display: flex;
    background: var(--hrms-app-background);
}

.app-sidebar {
    width: 16rem;
    min-height: 100vh;
    flex: 0 0 16rem;
    display: flex;
    flex-direction: column;
    background: var(--hrms-sidebar);
    color: var(--hrms-sidebar-text);
    border-right: 1px solid rgb(255 255 255 / 0.08);
}

.app-sidebar__brand {
    min-height: 4.5rem;
    display: flex;
    align-items: center;
    gap: var(--hrms-space-3);
    padding: 0 var(--hrms-space-4);
    border-bottom: 1px solid rgb(255 255 255 / 0.08);
}

.app-sidebar__brand-icon,
.app-sidebar__avatar {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    color: white;
    background: var(--hrms-primary);
}

.app-sidebar__brand-icon {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--hrms-radius-md);
}

.app-sidebar__brand-text,
.app-sidebar__profile-text {
    min-width: 0;
}

.app-sidebar__brand-text strong,
.app-sidebar__brand-text span,
.app-sidebar__profile-text strong,
.app-sidebar__profile-text span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-sidebar__brand-text strong {
    font-size: 0.86rem;
}

.app-sidebar__brand-text span,
.app-sidebar__profile-text span {
    margin-top: 0.125rem;
    color: rgb(229 237 248 / 0.65);
    font-size: 0.7rem;
}

.app-sidebar__nav {
    display: grid;
    gap: 0.25rem;
    padding: var(--hrms-space-4) var(--hrms-space-3);
}

.app-sidebar__section-label {
    padding: 0 var(--hrms-space-2);
    margin-bottom: var(--hrms-space-1);
    color: rgb(229 237 248 / 0.5);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.app-sidebar__link {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.5rem;
    padding: 0 0.75rem;
    color: rgb(229 237 248 / 0.78);
    border-radius: var(--hrms-radius-md);
    font-size: 0.8rem;
    font-weight: 600;
}

.app-sidebar__link:hover {
    color: white;
    background: rgb(255 255 255 / 0.07);
}

.app-sidebar__link--active {
    color: white;
    background: var(--hrms-primary);
}

.app-sidebar__bottom {
    display: grid;
    gap: var(--hrms-space-3);
    margin-top: auto;
    padding: var(--hrms-space-3);
    border-top: 1px solid rgb(255 255 255 / 0.08);
}

.app-sidebar__profile {
    display: flex;
    align-items: center;
    gap: var(--hrms-space-3);
    min-width: 0;
}

.app-sidebar__avatar {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    font-weight: 700;
}

.app-sidebar__profile-text strong {
    font-size: 0.76rem;
}

.app-sidebar__logout {
    justify-content: flex-start;
    width: 100%;
}

.app-main {
    min-width: 0;
    flex: 1 1 auto;
}

.app-topbar {
    min-height: 4.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--hrms-space-4);
    padding: 0 var(--hrms-space-5);
    background: var(--hrms-surface);
    border-bottom: 1px solid var(--hrms-border);
}

.app-topbar__left,
.app-topbar__actions {
    display: flex;
    align-items: center;
}

.app-topbar__left {
    gap: var(--hrms-space-3);
    min-width: 0;
}

.app-topbar__left h1,
.app-topbar__left span {
    margin: 0;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.app-topbar__left h1 {
    color: var(--hrms-text);
    font-size: 0.95rem;
}

.app-topbar__left span {
    margin-top: 0.125rem;
    color: var(--hrms-text-muted);
    font-size: 0.7rem;
}

.app-topbar__actions {
    gap: var(--hrms-space-2);
}

.app-topbar__menu-button {
    display: none;
}

.app-content {
    width: 100%;
    min-height: calc(100vh - 4.5rem);
    padding: 1.25rem;
}

.app-shell__overlay {
    display: none;
}

@media (max-width: 900px) {
    .app-sidebar {
        position: fixed;
        z-index: 1200;
        inset: 0 auto 0 0;
        transform: translateX(-100%);
        transition: transform 0.2s ease;
        box-shadow: var(--hrms-shadow-md);
    }

    .app-sidebar--open {
        transform: translateX(0);
    }

    .app-shell__overlay {
        position: fixed;
        z-index: 1100;
        inset: 0;
        display: block;
        background: rgb(0 0 0 / 0.42);
    }

    .app-topbar__menu-button {
        display: inline-flex;
    }
}

@media (max-width: 600px) {
    .app-topbar,
    .app-content {
        padding-left: 1rem;
        padding-right: 1rem;
    }

    .app-topbar {
        gap: var(--hrms-space-2);
    }

    .app-topbar__actions {
        gap: 0.125rem;
    }

    .app-topbar__left span {
        display: none;
    }
}
</style>