import mongoose from "mongoose"
import { env } from "./env.js"

let databaseState = "not-configured"

export async function connectDatabase() {
    if (!env.MONGO_URI) {
        console.warn("[mongo] MONGO_URI is not configured. Database connection is skipped.")
        return
    }

    mongoose.set("strictQuery", true)
    mongoose.set("autoIndex", env.NODE_ENV !== "production")

    mongoose.connection.on("connected", () => {
        databaseState = "connected"
        console.log("[mongo] connected")
    })

    mongoose.connection.on("disconnected", () => {
        databaseState = "disconnected"
        console.warn("[mongo] disconnected")
    })

    mongoose.connection.on("error", (error) => {
        databaseState = "error"
        console.error("[mongo] connection error:", error.message)
    })

    try {
        databaseState = "connecting"

        await mongoose.connect(env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
        })
    } catch (error) {
        databaseState = "error"
        throw error
    }
}

export async function disconnectDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect()
    }
}

export function getDatabaseHealth() {
    return {
        configured: Boolean(env.MONGO_URI),
        state: databaseState,
        readyState: mongoose.connection.readyState,
    }
}