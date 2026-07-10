import { defineStore } from "pinia"

import {
    fetchHrDashboard,
    fetchHrDashboardLookups,
} from "../services/hrDashboard.api.js"

function formatDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return date
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function cleanFilters(filters) {
    return Object.fromEntries(
        Object.entries(filters)
            .filter(([, value]) =>
                value !== "" && value !== null && value !== undefined,
            )
            .map(([key, value]) => [key, formatDate(value)]),
    )
}

function currentYearRange() {
    const year = new Date().getFullYear()

    return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31),
    }
}

export const useHrDashboardStore = defineStore("hrDashboard", {
    state: () => ({
        dashboard: null,
        lookups: {
            companies: [],
            branches: [],
            departments: [],
            positions: [],
            lines: [],
            employeeTypes: [],
        },
        loading: false,
        lookupLoading: false,
        error: null,
        filters: {
            ...currentYearRange(),
            companyId: undefined,
            branchId: undefined,
            departmentId: undefined,
            positionId: undefined,
            lineId: undefined,
            employeeTypeId: undefined,
        },
    }),

    actions: {
        async loadLookups(filters = {}) {
            this.lookupLoading = true

            try {
                this.lookups = await fetchHrDashboardLookups(
                    cleanFilters({
                        companyId: filters.companyId,
                        branchId: filters.branchId,
                        departmentId: filters.departmentId,
                    }),
                )

                return this.lookups
            } finally {
                this.lookupLoading = false
            }
        },

        async loadDashboard(filters = {}) {
            this.loading = true
            this.error = null
            this.filters = {
                ...this.filters,
                ...filters,
            }

            try {
                this.dashboard = await fetchHrDashboard(
                    cleanFilters(this.filters),
                )

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
