import { defineStore } from "pinia"

import {
    createAttendanceRecord,
    downloadAttendanceTemplate,
    fetchAttendanceRecords,
    importAttendance,
    updateAttendanceRecord,
} from "../services/attendance.api.js"

export const useAttendanceStore = defineStore("attendance", {
    state: () => ({
        items: [],
        pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 1,
        },
        loading: false,
        saving: false,
        importing: false,
        importProgress: 0,
        importSummary: null,
        error: null,
    }),

    actions: {
        async load(params) {
            this.loading = true
            this.error = null

            try {
                const result = await fetchAttendanceRecords(params)
                this.items = result.items || []
                this.pagination = result.pagination || this.pagination
                return result
            } catch (error) {
                this.error = error
                throw error
            } finally {
                this.loading = false
            }
        },

        async save(payload, attendanceId = null) {
            this.saving = true
            this.error = null

            try {
                return attendanceId
                    ? await updateAttendanceRecord(attendanceId, payload)
                    : await createAttendanceRecord(payload)
            } finally {
                this.saving = false
            }
        },

        async downloadTemplate() {
            await downloadAttendanceTemplate()
        },

        async importFile(file) {
            this.importing = true
            this.importProgress = 1
            this.importSummary = null

            try {
                const summary = await importAttendance(file, (event) => {
                    if (event.total) {
                        this.importProgress = Math.min(
                            95,
                            Math.round((event.loaded * 100) / event.total),
                        )
                    }
                })
                this.importProgress = 100
                this.importSummary = summary
                return summary
            } finally {
                this.importing = false
            }
        },
    },
})
