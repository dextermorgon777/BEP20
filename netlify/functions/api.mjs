import serverless from "serverless-http"
import app from "../../backend/server.js"

export const handler = serverless(app)
export const config = { timeout: 26 }   // see warning in #7