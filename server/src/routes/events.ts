import { Router, Request, Response } from "express";
import { verifyAuth, requireOrgAccess } from "../middleware/auth.js";
import { registerClient } from "../services/realtime.js";

export const eventsRouter = Router({ mergeParams: true });

// GET /api/v1/orgs/:slug/events
eventsRouter.get(
  "/",
  verifyAuth,
  requireOrgAccess,
  (req: Request, res: Response): void => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const orgId = req.organization._id.toString();
    const userId = req.user!.userId;

    registerClient(orgId, userId, res);
  }
);
