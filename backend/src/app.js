import express from "express"
import cors from "cors"
import helmet from "helmet"
import morgan from "morgan"

import { env } from "./config/env.js"
import systemRoutes from "./modules/system/system.routes.js"
import { AppError } from "./shared/errors/AppError.js"
import { errorHandler } from "./shared/middleware/errorHandler.js"
import { notFound } from "./shared/middleware/notFound.js"
import { requestContext } from "./shared/middleware/requestContext.js"

const allowedOrigins = new Set(
    env.CLIENT_URL.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
)

const app = express()

app.disable("x-powered-by")
app.set("trust proxy", 1)

app.use(requestContext)

app.use(
    helmet({
        crossOriginResourcePolicy: false,
    }),
)

app.use(
    cors({
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true)
            }

            return callback(
                new AppError({
                    statusCode: 403,
                    code: "CORS_ORIGIN_DENIED",
                    messageKey: "errors.corsOriginDenied",
                }),
            )
        },
        credentials: true,
    }),
)

app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }))
app.use(express.urlencoded({ extended: false, limit: env.REQUEST_BODY_LIMIT }))

app.use(
    morgan(
        env.NODE_ENV === "production"
            ? "combined"
            : ":method :url :status :response-time ms",
    ),
)

app.use("/api/v1", systemRoutes)

app.use(notFound)
app.use(errorHandler)

export default app