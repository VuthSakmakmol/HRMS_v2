import { createRouter, createWebHistory } from "vue-router"

const router = createRouter({
    history: createWebHistory(),

    routes: [
        {
            path: "/",
            name: "foundation",
            component: () => import("@/modules/system/SystemStatusView.vue"),
        },
    ],
})

export default router