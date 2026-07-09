import axios from "axios"

import { getStoredAccessToken } from "@/shared/auth/auth.storage.js"

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
    timeout: 15000,
    headers: {
        "Content-Type": "application/json",
    },
})

export function setApiAccessToken(accessToken) {
    if (accessToken) {
        apiClient.defaults.headers.common.Authorization =
            `Bearer ${accessToken}`

        return
    }

    delete apiClient.defaults.headers.common.Authorization
}

setApiAccessToken(getStoredAccessToken())

apiClient.interceptors.request.use((config) => {
    const accessToken = getStoredAccessToken()

    if (accessToken) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${accessToken}`
    }

    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
        config.headers = config.headers || {}

        if (typeof config.headers.delete === "function") {
            config.headers.delete("Content-Type")
            config.headers.delete("content-type")
        } else {
            delete config.headers["Content-Type"]
            delete config.headers["content-type"]
        }
    }

    return config
})
