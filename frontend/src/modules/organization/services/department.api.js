import { apiClient } from "@/shared/services/apiClient.js"

const DEPARTMENT_ENDPOINT = "/organization/departments"

export async function fetchDepartments(params = {}) {
    const response = await apiClient.get(DEPARTMENT_ENDPOINT, {
        params,
    })

    return response.data.data
}

export async function createDepartment(payload) {
    const response = await apiClient.post(DEPARTMENT_ENDPOINT, payload)

    return response.data.data.department
}

export async function updateDepartment(departmentId, payload) {
    const response = await apiClient.patch(
        `${DEPARTMENT_ENDPOINT}/${departmentId}`,
        payload,
    )

    return response.data.data.department
}

export async function archiveDepartment(departmentId) {
    const response = await apiClient.patch(
        `${DEPARTMENT_ENDPOINT}/${departmentId}/archive`,
    )

    return response.data.data.department
}