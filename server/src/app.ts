import express, { Express } from "express";
import cors from "cors";
import { orgsRouter } from "./routes/orgs.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mount Organization & Auth routes
  app.use("/api/v1/orgs", orgsRouter);

  return app;
}
