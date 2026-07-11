import { apiClient } from "@/shared/services/apiClient.js"

const ATTENDANCE_DASHBOARD_ENDPOINT = "/attendance/dashboard"

export async function fetchAttendanceDashboard(params = {}) {
    const response = await apiClient.get(ATTENDANCE_DASHBOARD_ENDPOINT, {
        params,
    })

    return response.data.data
}
