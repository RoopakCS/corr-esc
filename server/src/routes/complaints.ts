import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Complaint, IComplaint } from "../models/Complaint.js";
import { Incident, IIncident } from "../models/Incident.js";
import { Category } from "../models/Category.js";
import { verifyAuth, requireOrgAccess } from "../middleware/auth.js";

export const complaintsRouter = Router({ mergeParams: true });

const createComplaintSchema = z.object({
  categoryId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid category ID",
  }),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().min(5, "Description must be at least 5 characters"),
  locationContext: z.string().optional().default(""),
  photoUrl: z.string().url("Invalid photo URL").optional().or(z.literal("")),
});

function toIdString(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (val._id) return val._id.toString();
  return val.toString();
}

function formatComplaint(complaint: IComplaint, incident?: IIncident | any, category?: any) {
  const categoryDoc = category || complaint.categoryId;
  const incidentDoc = incident || complaint.incidentId;

  return {
    id: complaint._id.toString(),
    title: complaint.title,
    description: complaint.description,
    locationContext: complaint.locationContext,
    photoUrl: complaint.photoUrl,
    complainantId: complaint.complainantId.toString(),
    categoryId: toIdString(categoryDoc),
    categoryName: categoryDoc?.name,
    incidentId: toIdString(incidentDoc),
    incident: incidentDoc && incidentDoc.status
      ? {
          id: toIdString(incidentDoc),
          status: incidentDoc.status,
          escalationTier: incidentDoc.escalationTier,
          corroborationCount: incidentDoc.corroborationCount,
          slaDeadline: incidentDoc.slaDeadline,
        }
      : undefined,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
  };
}

function formatIncident(incident: IIncident) {
  return {
    id: incident._id.toString(),
    categoryId: incident.categoryId.toString(),
    status: incident.status,
    escalationTier: incident.escalationTier,
    corroborationCount: incident.corroborationCount,
    slaDeadline: incident.slaDeadline,
    createdAt: incident.createdAt,
    updatedAt: incident.updatedAt,
  };
}

// POST /api/v1/orgs/:slug/complaints
complaintsRouter.post(
  "/",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const parseResult = createComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0]?.message || "Validation failed";
      res.status(400).json({
        message: firstError,
        errors: parseResult.error.format(),
      });
      return;
    }

    const { categoryId, title, description, locationContext, photoUrl } =
      parseResult.data;

    const category = await Category.findOne({
      _id: categoryId,
      organizationId: req.organization._id,
    });

    if (!category) {
      res.status(404).json({ message: "Category not found in this organization" });
      return;
    }

    // Dynamic baseline SLA deadline calculation
    const slaDeadline = new Date(Date.now() + category.baseSlaHours * 3600 * 1000);

    // Create operational incident
    const incident = await Incident.create({
      organizationId: req.organization._id,
      categoryId: category._id,
      status: "New",
      escalationTier: 0,
      corroborationCount: 1,
      slaDeadline,
    });

    // Create complaint attached to incident
    const complaint = await Complaint.create({
      organizationId: req.organization._id,
      incidentId: incident._id,
      complainantId: new mongoose.Types.ObjectId(req.user!.userId),
      categoryId: category._id,
      title: title.trim(),
      description: description.trim(),
      locationContext: locationContext ? locationContext.trim() : "",
      photoUrl: photoUrl || undefined,
    });

    res.status(201).json({
      complaint: formatComplaint(complaint, incident, category),
      incident: formatIncident(incident),
    });
  }
);

// GET /api/v1/orgs/:slug/complaints/my
complaintsRouter.get(
  "/my",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const complaints = await Complaint.find({
      organizationId: req.organization._id,
      complainantId: new mongoose.Types.ObjectId(req.user!.userId),
    })
      .populate("incidentId")
      .populate("categoryId")
      .sort({ createdAt: -1 });

    res.status(200).json({
      complaints: complaints.map((complaint) =>
        formatComplaint(complaint, complaint.incidentId, complaint.categoryId)
      ),
    });
  }
);

// GET /api/v1/orgs/:slug/complaints/:id
complaintsRouter.get(
  "/:id",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid complaint ID" });
      return;
    }

    const complaint = await Complaint.findOne({
      _id: id,
      organizationId: req.organization._id,
    })
      .populate("incidentId")
      .populate("categoryId");

    if (!complaint) {
      res.status(404).json({ message: "Complaint not found" });
      return;
    }

    // Enforce blind isolation: complainants cannot view others' complaints
    if (
      req.user?.role === "Complainant" &&
      complaint.complainantId.toString() !== req.user.userId
    ) {
      res.status(403).json({ message: "Not authorized to view this complaint" });
      return;
    }

    res.status(200).json({
      complaint: formatComplaint(complaint, complaint.incidentId, complaint.categoryId),
    });
  }
);
