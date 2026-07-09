import { apiClient } from "@/shared/services/apiClient.js"

const HR_DASHBOARD_ENDPOINT = "/reports/hr-management-dashboard"

export async function fetchHrManagementDashboard(params = {}) {
    const response = await apiClient.get(HR_DASHBOARD_ENDPOINT, {
        params,
        timeout: 30000,
    })

    return response.data.data.dashboard
}
