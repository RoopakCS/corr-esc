import express, { Express } from "express";
import cors from "cors";
import { orgsRouter } from "./routes/orgs.js";
import { categoriesRouter } from "./routes/categories.js";
import { complaintsRouter } from "./routes/complaints.js";

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mount Organization & Auth routes
  app.use("/api/v1/orgs", orgsRouter);
  app.use("/api/v1/orgs/:slug/categories", categoriesRouter);
  app.use("/api/v1/orgs/:slug/complaints", complaintsRouter);

  return app;
}
