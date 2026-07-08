import { createRouter, createWebHistory } from "vue-router"

import { useAuthStore } from "@/app/stores/auth.store.js"

const router = createRouter({
    history: createWebHistory(),

    routes: [
        {
            path: "/login",
            name: "login",
            component: () => import("@/modules/auth/LoginView.vue"),
            meta: {
                guestOnly: true,
            },
        },

        {
            path: "/",
            component: () => import("@/layouts/AppShell.vue"),
            meta: {
                requiresAuth: true,
            },

            children: [
                {
                    path: "",
                    name: "workspace",
                    component: () =>
                        import("@/modules/workspace/WorkspaceView.vue"),
                    meta: {
                        titleKey: "nav.overview",
                    },
                },
            ],
        },

        {
            path: "/:pathMatch(.*)*",
            redirect: {
                name: "workspace",
            },
        },
    ],
})

router.beforeEach(async (to) => {
    const authStore = useAuthStore()

    await authStore.bootstrap()

    const requiresAuth = to.matched.some(
        (route) => route.meta.requiresAuth,
    )

    const guestOnly = to.matched.some(
        (route) => route.meta.guestOnly,
    )

    if (requiresAuth && !authStore.isAuthenticated) {
        return {
            name: "login",
            query: {
                redirect: to.fullPath,
            },
        }
    }

    if (guestOnly && authStore.isAuthenticated) {
        return {
            name: "workspace",
        }
    }

    return true
})

export default router