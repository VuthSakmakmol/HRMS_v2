import { apiClient } from "@/shared/services/apiClient.js"

const ATTENDANCE_ENDPOINT = "/attendance"

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()

    window.URL.revokeObjectURL(url)
}

export async function fetchAttendanceRecords(params) {
    const response = await apiClient.get(ATTENDANCE_ENDPOINT, { params })
    return response.data.data
}

export async function createAttendanceRecord(payload) {
    const response = await apiClient.post(ATTENDANCE_ENDPOINT, payload)
    return response.data.data.record
}

export async function updateAttendanceRecord(attendanceId, payload) {
    const response = await apiClient.patch(
        `${ATTENDANCE_ENDPOINT}/${attendanceId}`,
        payload,
    )
    return response.data.data.record
}

export async function downloadAttendanceTemplate() {
    const response = await apiClient.get(
        `${ATTENDANCE_ENDPOINT}/import-template`,
        {
            responseType: "blob",
            timeout: 0,
        },
    )

    downloadBlob(response.data, "attendance-import-template.xlsx")
}

export async function importAttendance(file, onUploadProgress) {
    const formData = new FormData()
    formData.append("file", file)

    const response = await apiClient.post(
        `${ATTENDANCE_ENDPOINT}/import`,
        formData,
        {
            timeout: 0,
            onUploadProgress,
        },
    )

    return response.data.data.summary
}
