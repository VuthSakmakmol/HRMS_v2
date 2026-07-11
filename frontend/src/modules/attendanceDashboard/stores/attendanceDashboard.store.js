import { defineStore } from "pinia"

import { fetchAttendanceDashboard } from "../services/attendanceDashboard.api.js"

const DASHBOARD_CACHE_TTL_MS = 30_000

function buildQueryKey(params = {}) {
    return JSON.stringify(
        Object.keys(params)
            .sort()
            .reduce((result, key) => {
                result[key] = params[key]
                return result
            }, {}),
    )
}

function removeEmptyParams(params = {}) {
    return Object.entries(params).reduce((result, [key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
            result[key] = value
        }

        return result
    }, {})
}

export const useAttendanceDashboardStore = defineStore("attendanceDashboard", {
    state: () => ({
        data: null,
        loading: false,
        error: null,
        cache: {},
        pendingRequests: {},
    }),

    actions: {
        clearCache() {
            this.cache = {}
            this.pendingRequests = {}
        },

        async loadDashboard(params = {}, options = {}) {
            const cleanParams = removeEmptyParams(params)
            const key = buildQueryKey(cleanParams)
            const cached = this.cache[key]
            const force = Boolean(options.force)

            if (!force && cached && Date.now() - cached.loadedAt < DASHBOARD_CACHE_TTL_MS) {
                this.data = cached.data
                return cached.data
            }

            if (!force && this.pendingRequests[key]) {
                const data = await this.pendingRequests[key]
                this.data = data
                return data
            }

            this.loading = true
            this.error = null

            const request = fetchAttendanceDashboard(cleanParams)
            this.pendingRequests[key] = request

            try {
                const data = await request
                this.cache[key] = {
                    data,
                    loadedAt: Date.now(),
                }
                this.data = data
                return data
            } catch (error) {
                this.error = error
                throw error
            } finally {
                delete this.pendingRequests[key]
                this.loading = false
            }
        },
    },
})
