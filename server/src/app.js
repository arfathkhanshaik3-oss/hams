import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { apiRouter } from "./routes/index.js";

const clientDist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "client",
  "dist",
);

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // When deployed behind a reverse proxy (Nginx, Render, ...) set TRUST_PROXY=1 so req.ip and rate limits are correct
  if (process.env.TRUST_PROXY || env.isProd)
    app.set("trust proxy", Number(process.env.TRUST_PROXY) || 1);

  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use("/api", apiLimiter, apiRouter);

  // One-address deployment: if the client was built (client/dist exists), Express also serves the website.
  if (fs.existsSync(path.join(clientDist, "index.html"))) {
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get(/^\/(?!api\/|socket\.io\/).*/, (_req, res) =>
      res.sendFile(path.join(clientDist, "index.html")),
    );
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
