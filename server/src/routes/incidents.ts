import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Incident, IIncident, IncidentStatus } from "../models/Incident.js";
import { Complaint, IComplaint } from "../models/Complaint.js";
import { User } from "../models/User.js";
import { verifyAuth, requireOrgAccess } from "../middleware/auth.js";

export const incidentsRouter = Router({ mergeParams: true });

function toIdString(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val._id) return val._id.toString();
  return val.toString();
}

function formatIncident(incident: IIncident | any) {
  return {
    id: incident._id ? incident._id.toString() : incident.id,
    categoryId: toIdString(incident.categoryId),
    category: incident.categoryId?.name
      ? {
          id: toIdString(incident.categoryId),
          name: incident.categoryId.name,
          baseSlaHours: incident.categoryId.baseSlaHours,
        }
      : undefined,
    status: incident.status,
    escalationTier: incident.escalationTier,
    assigneeId: incident.assigneeId ? toIdString(incident.assigneeId) : undefined,
    assignee: incident.assigneeId?.name
      ? {
          id: toIdString(incident.assigneeId),
          name: incident.assigneeId.name,
          email: incident.assigneeId.email,
        }
      : undefined,
    supervisorId: incident.supervisorId ? toIdString(incident.supervisorId) : undefined,
    supervisor: incident.supervisorId?.name
      ? {
          id: toIdString(incident.supervisorId),
          name: incident.supervisorId.name,
          email: incident.supervisorId.email,
        }
      : undefined,
    corroborationCount: incident.corroborationCount,
    slaDeadline: incident.slaDeadline,
    gracePeriodExpiresAt: incident.gracePeriodExpiresAt,
    reopenCount: incident.reopenCount,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

function formatComplaint(complaint: IComplaint | any) {
  return {
    id: complaint._id.toString(),
    title: complaint.title,
    description: complaint.description,
    locationContext: complaint.locationContext,
    photoUrl: complaint.photoUrl,
    complainantId: toIdString(complaint.complainantId),
    categoryId: toIdString(complaint.categoryId),
    incidentId: toIdString(complaint.incidentId),
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
  };
}

// GET /api/v1/orgs/:slug/incidents
incidentsRouter.get(
  "/",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Staff" && req.user?.role !== "Admin") {
      res.status(403).json({ message: "Staff or Admin access required to view incident queue" });
      return;
    }

    const organization = req.organization;
    const filterQuery: any = { organizationId: organization._id };

    if (req.user.role === "Staff") {
      const staffUser = await User.findOne({
        _id: req.user.userId,
        organizationId: organization._id,
      });

      if (!staffUser) {
        res.status(403).json({ message: "Staff user record not found" });
        return;
      }

      filterQuery.categoryId = { $in: staffUser.categoryPoolIds };
    }

    if (req.query.status) {
      filterQuery.status = req.query.status;
    }

    const incidents = await Incident.find(filterQuery)
      .populate("categoryId")
      .populate("assigneeId")
      .populate("supervisorId")
      .sort({ slaDeadline: 1 });

    res.status(200).json({
      incidents: incidents.map(formatIncident),
    });
  }
);

// GET /api/v1/orgs/:slug/incidents/:id
incidentsRouter.get(
  "/:id",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Staff" && req.user?.role !== "Admin") {
      res.status(403).json({ message: "Staff or Admin access required" });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid incident ID" });
      return;
    }

    const incident = await Incident.findOne({
      _id: id,
      organizationId: req.organization._id,
    })
      .populate("categoryId")
      .populate("assigneeId")
      .populate("supervisorId");

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    // If Staff, ensure category is in their assigned pool or they are assignee
    if (req.user.role === "Staff") {
      const staffUser = await User.findOne({
        _id: req.user.userId,
        organizationId: req.organization._id,
      });

      const hasPoolAccess = staffUser?.categoryPoolIds.some(
        (catId) => catId.toString() === incident.categoryId._id.toString()
      );
      const isAssignee = incident.assigneeId && toIdString(incident.assigneeId) === req.user.userId;

      if (!hasPoolAccess && !isAssignee) {
        res.status(403).json({ message: "Not authorized for this category pool" });
        return;
      }
    }

    const complaints = await Complaint.find({
      incidentId: incident._id,
      organizationId: req.organization._id,
    }).sort({ createdAt: 1 });

    res.status(200).json({
      incident: formatIncident(incident),
      complaints: complaints.map(formatComplaint),
    });
  }
);

// PATCH /api/v1/orgs/:slug/incidents/:id/claim
incidentsRouter.patch(
  "/:id/claim",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Staff") {
      res.status(403).json({ message: "Staff access required to claim incidents" });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid incident ID" });
      return;
    }

    const staffUser = await User.findOne({
      _id: req.user.userId,
      organizationId: req.organization._id,
    });

    if (!staffUser) {
      res.status(403).json({ message: "Staff user not found" });
      return;
    }

    // Atomically find incident with status New matching staff's category pool and assign to staff
    const incident = await Incident.findOneAndUpdate(
      {
        _id: id,
        organizationId: req.organization._id,
        categoryId: { $in: staffUser.categoryPoolIds },
        status: "New",
      },
      {
        $set: {
          assigneeId: new mongoose.Types.ObjectId(req.user.userId),
          status: "Assigned",
        },
      },
      { new: true }
    )
      .populate("categoryId")
      .populate("assigneeId")
      .populate("supervisorId");

    if (!incident) {
      // Determine precise cause of failure for feedback
      const existing = await Incident.findOne({
        _id: id,
        organizationId: req.organization._id,
      });

      if (!existing) {
        res.status(404).json({ message: "Incident not found" });
        return;
      }

      const hasPoolAccess = staffUser.categoryPoolIds.some(
        (cId) => cId.toString() === existing.categoryId.toString()
      );

      if (!hasPoolAccess) {
        res.status(403).json({ message: "Not authorized for this category pool" });
        return;
      }

      res.status(400).json({ message: "Incident is already claimed or not in New status" });
      return;
    }

    res.status(200).json({
      incident: formatIncident(incident),
    });
  }
);

const updateStatusSchema = z.object({
  status: z.literal("In Progress"),
});

// PATCH /api/v1/orgs/:slug/incidents/:id/status
incidentsRouter.patch(
  "/:id/status",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Staff" && req.user?.role !== "Admin") {
      res.status(403).json({ message: "Staff or Admin access required" });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid incident ID" });
      return;
    }

    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: "Invalid status transition",
        errors: parseResult.error.format(),
      });
      return;
    }

    const { status: targetStatus } = parseResult.data;

    const incident = await Incident.findOne({
      _id: id,
      organizationId: req.organization._id,
    });

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    // Ensure staff is the assignee
    if (req.user.role === "Staff") {
      const isAssignee =
        incident.assigneeId && incident.assigneeId.toString() === req.user.userId;

      if (!isAssignee) {
        res.status(403).json({
          message: "Only assigned staff or admin can transition status",
        });
        return;
      }
    }

    // Validate status transition
    if (targetStatus === "In Progress") {
      if (incident.status !== "Assigned" && incident.status !== "In Progress") {
        res.status(400).json({
          message: `Cannot transition to In Progress from status ${incident.status}`,
        });
        return;
      }
    }

    incident.status = targetStatus as IncidentStatus;
    await incident.save();

    await incident.populate("categoryId");
    await incident.populate("assigneeId");
    await incident.populate("supervisorId");

    res.status(200).json({
      incident: formatIncident(incident),
    });
  }
);
