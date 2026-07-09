import { defineStore } from "pinia"

import { fetchHrManagementDashboard } from "../services/hrDashboard.api.js"

function cleanParams(filters) {
    const params = {}

    for (const [key, value] of Object.entries(filters || {})) {
        if (value === "" || value === null || value === undefined) continue
        params[key] = value
    }

    return params
}

export const useHrDashboardStore = defineStore("hrDashboard", {
    state: () => ({
        dashboard: null,
        loading: false,
        error: null,
    }),

    actions: {
        async loadDashboard(filters = {}) {
            this.loading = true
            this.error = null

            try {
                this.dashboard = await fetchHrManagementDashboard(cleanParams(filters))
                return this.dashboard
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },
    },
})
