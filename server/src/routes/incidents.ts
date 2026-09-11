import { Router, Request, Response } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { Incident, IIncident, IncidentStatus } from "../models/Incident.js";
import { Complaint, IComplaint } from "../models/Complaint.js";
import { Category, ISupervisorTier } from "../models/Category.js";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { verifyAuth, requireOrgAccess } from "../middleware/auth.js";
import { computeComplaintSimilarity } from "../services/similarity.js";
import { calculateContractedDeadline } from "../services/sla.js";
import { resolveSupervisor } from "../services/slaSweeper.js";

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
    contractionAudit: (incident.contractionAudit || []).map((audit: any) => ({
      id: audit._id ? audit._id.toString() : undefined,
      complaintId: toIdString(audit.complaintId),
      complaintTitle: audit.complaintTitle,
      previousDeadline: audit.previousDeadline,
      newDeadline: audit.newDeadline,
      contractedMs: audit.contractedMs,
      corroborationCount: audit.corroborationCount,
      createdAt: audit.createdAt,
    })),
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

const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = ["New", "Assigned", "In Progress"];

async function checkCategoryPoolAccess(
  user: { userId: string; role: string },
  organizationId: mongoose.Types.ObjectId | string,
  categoryId: mongoose.Types.ObjectId | string | { _id: mongoose.Types.ObjectId | string },
  allowAssigneeId?: mongoose.Types.ObjectId | string | null,
  allowSupervisorId?: mongoose.Types.ObjectId | string | null
): Promise<boolean> {
  if (user.role === "Admin") return true;
  if (user.role !== "Staff") return false;

  const staffUser = await User.findOne({
    _id: user.userId,
    organizationId,
  });

  if (!staffUser) return false;

  const targetCatId =
    typeof categoryId === "object" && categoryId !== null && "_id" in categoryId
      ? (categoryId as any)._id.toString()
      : categoryId.toString();

  const hasPoolAccess = staffUser.categoryPoolIds.some(
    (cId) => cId.toString() === targetCatId
  );

  if (hasPoolAccess) return true;

  if (allowAssigneeId && toIdString(allowAssigneeId) === user.userId) {
    return true;
  }

  if (allowSupervisorId && toIdString(allowSupervisorId) === user.userId) {
    return true;
  }

  return false;
}

// GET /api/v1/orgs/:slug/incidents
incidentsRouter.get(
  "/",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Staff" && req.user?.role !== "Admin") {
      res.status(403).json({ message: "Staff or Admin access required to view incident pool" });
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

      filterQuery.$or = [
        { categoryId: { $in: staffUser.categoryPoolIds } },
        { assigneeId: staffUser._id },
        { supervisorId: staffUser._id },
      ];
    }

    if (req.query.status) {
      filterQuery.status = req.query.status;
    }

    if (req.query.escalated === "true") {
      filterQuery.escalationTier = { $gt: 0 };
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

    // If Staff, ensure category is in their assigned pool or they are assignee or supervisor
    const hasAccess = await checkCategoryPoolAccess(
      req.user,
      req.organization._id,
      incident.categoryId,
      incident.assigneeId,
      incident.supervisorId
    );

    if (!hasAccess) {
      res.status(403).json({ message: "Not authorized for this category pool" });
      return;
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
  status: z.enum(["In Progress", "Resolved", "Closed"]),
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
    } else if (targetStatus === "Resolved") {
      if (incident.status !== "In Progress" && incident.status !== "Resolved") {
        res.status(400).json({
          message: `Cannot transition to Resolved from status ${incident.status}`,
        });
        return;
      }
      // Halt active SLA timer and start 24-hour resolution grace period
      incident.gracePeriodExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);

      // Find all complaints attached to this incident and notify attached complainants
      const attachedComplaints = await Complaint.find({ incidentId: incident._id });
      const uniqueComplainantIds = Array.from(
        new Set(attachedComplaints.map((c) => c.complainantId.toString()))
      );

      for (const complainantId of uniqueComplainantIds) {
        await Notification.create({
          organizationId: req.organization._id,
          recipientId: new mongoose.Types.ObjectId(complainantId),
          incidentId: incident._id,
          type: "resolution_verification",
          title: "Resolution Verification Requested",
          message: `Staff reported this incident resolved. Please verify if it is fixed for you within the 24-hour grace period.`,
          priority: "normal",
          isRead: false,
        });
      }
    } else if (targetStatus === "Closed") {
      incident.gracePeriodExpiresAt = undefined;
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

const contestSchema = z.object({
  feedback: z.string().optional(),
  reason: z.string().optional(),
});

// POST /api/v1/orgs/:slug/incidents/:id/contest
incidentsRouter.post(
  "/:id/contest",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid incident ID" });
      return;
    }

    const incident = await Incident.findOne({
      _id: id,
      organizationId: req.organization._id,
    });

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    // Complainant must be attached to this incident, or Admin
    if (req.user?.role !== "Admin") {
      const isAttached = await Complaint.exists({
        incidentId: incident._id,
        complainantId: new mongoose.Types.ObjectId(req.user!.userId),
      });

      if (!isAttached) {
        res.status(403).json({
          message: "Only complainants attached to this incident or admins can contest resolution",
        });
        return;
      }
    }

    if (incident.status !== "Resolved") {
      res.status(400).json({
        message: `Only resolved incidents can be contested. Current status: ${incident.status}`,
      });
      return;
    }

    if (incident.gracePeriodExpiresAt && incident.gracePeriodExpiresAt < new Date()) {
      res.status(400).json({
        message: "Resolution grace period has expired",
      });
      return;
    }

    // Reopen incident with +1 escalation penalty
    const newTier = incident.escalationTier + 1;
    incident.status = "In Progress";
    incident.reopenCount = (incident.reopenCount || 0) + 1;
    incident.escalationTier = newTier;

    // Resume SLA timer: extend deadline by paused duration
    if (incident.gracePeriodExpiresAt) {
      const graceStartedAt = incident.gracePeriodExpiresAt.getTime() - 24 * 3600 * 1000;
      const pausedDuration = Math.max(0, Date.now() - graceStartedAt);
      incident.slaDeadline = new Date(incident.slaDeadline.getTime() + pausedDuration);
    }
    incident.gracePeriodExpiresAt = undefined;

    // Look up designated supervisor for the newly escalated tier
    const category = await Category.findById(incident.categoryId);
    let tierTarget: ISupervisorTier | undefined;
    if (category && category.tierTargets && category.tierTargets.length > 0) {
      tierTarget =
        category.tierTargets.find((t) => t.tier === newTier) ||
        category.tierTargets[category.tierTargets.length - 1];
    }

    const supervisor = await resolveSupervisor(incident.organizationId, tierTarget);
    if (supervisor) {
      incident.supervisorId = supervisor._id;
    }

    await incident.save();

    await incident.populate("categoryId");
    await incident.populate("assigneeId");
    await incident.populate("supervisorId");

    // Dispatch urgent alert to designated supervisor and admin
    const recipientsToAlert = new Set<string>();
    if (supervisor) {
      recipientsToAlert.add(supervisor._id.toString());
    }
    const adminUser = await User.findOne({
      organizationId: req.organization._id,
      role: "Admin",
    });
    if (adminUser) {
      recipientsToAlert.add(adminUser._id.toString());
    }

    for (const recipientId of recipientsToAlert) {
      await Notification.create({
        organizationId: req.organization._id,
        recipientId: new mongoose.Types.ObjectId(recipientId),
        incidentId: incident._id,
        type: "incident_reopened",
        title: "Escalated: Incident Contested & Reopened",
        message: `Incident in category "${
          (incident.categoryId as any)?.name || "Incident"
        }" was contested by a complainant. Status returned to In Progress with an immediate +1 escalation tier penalty (now Tier ${newTier}).`,
        priority: "high",
        isRead: false,
      });
    }

    res.status(200).json({
      incident: formatIncident(incident),
    });
  }
);

// POST /api/v1/orgs/:slug/incidents/:id/confirm-resolution
incidentsRouter.post(
  "/:id/confirm-resolution",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid incident ID" });
      return;
    }

    const incident = await Incident.findOne({
      _id: id,
      organizationId: req.organization._id,
    });

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    if (req.user?.role !== "Admin") {
      const isAttached = await Complaint.exists({
        incidentId: incident._id,
        complainantId: new mongoose.Types.ObjectId(req.user!.userId),
      });

      if (!isAttached) {
        res.status(403).json({
          message: "Only attached complainants or admin can confirm resolution",
        });
        return;
      }
    }

    if (incident.status !== "Resolved") {
      res.status(400).json({
        message: `Only resolved incidents can be confirmed. Current status: ${incident.status}`,
      });
      return;
    }

    incident.status = "Closed";
    incident.gracePeriodExpiresAt = undefined;
    await incident.save();

    await incident.populate("categoryId");
    await incident.populate("assigneeId");
    await incident.populate("supervisorId");

    res.status(200).json({
      incident: formatIncident(incident),
    });
  }
);

const reassignSchema = z.object({
  assigneeId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid assignee ID",
  }),
});

// PATCH /api/v1/orgs/:slug/incidents/:id/reassign
incidentsRouter.patch(
  "/:id/reassign",
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

    const parseResult = reassignSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: parseResult.error.errors[0]?.message || "Validation failed",
      });
      return;
    }

    const { assigneeId } = parseResult.data;

    // Verify target is a valid Staff user in this organization
    const targetStaff = await User.findOne({
      _id: assigneeId,
      organizationId: req.organization._id,
      role: "Staff",
    });

    if (!targetStaff) {
      res.status(400).json({
        message: "Target assignee must be a valid staff member in this organization",
      });
      return;
    }

    const incident = await Incident.findOne({
      _id: id,
      organizationId: req.organization._id,
    });

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    // Only Admin or the designated supervisor can reassign an incident
    const isSupervisor =
      incident.supervisorId && incident.supervisorId.toString() === req.user.userId;
    const isAdmin = req.user.role === "Admin";

    if (!isAdmin && !isSupervisor) {
      res.status(403).json({
        message: "Only the designated supervisor or an admin can reassign this incident",
      });
      return;
    }

    incident.assigneeId = targetStaff._id;
    if (incident.status === "New") {
      incident.status = "Assigned";
    }
    await incident.save();

    await incident.populate("categoryId");
    await incident.populate("assigneeId");
    await incident.populate("supervisorId");

    res.status(200).json({
      incident: formatIncident(incident),
    });
  }
);

// GET /api/v1/orgs/:slug/incidents/:id/corroboration-suggestions
incidentsRouter.get(
  "/:id/corroboration-suggestions",
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
    });

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    // Verify staff belongs to category pool
    const hasAccess = await checkCategoryPoolAccess(
      req.user,
      req.organization._id,
      incident.categoryId
    );

    if (!hasAccess) {
      res.status(403).json({ message: "Not authorized for this category pool" });
      return;
    }

    // Attached complaints for this parent incident
    const attachedComplaints = await Complaint.find({
      incidentId: incident._id,
      organizationId: req.organization._id,
    });

    if (attachedComplaints.length === 0) {
      res.status(200).json({ suggestions: [] });
      return;
    }

    // Candidate complaints from other active incidents in the same category
    const activeIncidents = await Incident.find({
      _id: { $ne: incident._id },
      organizationId: req.organization._id,
      categoryId: incident.categoryId,
      status: { $in: ACTIVE_INCIDENT_STATUSES },
    });

    const activeIncidentIds = activeIncidents.map((inc) => inc._id);

    const candidateComplaints = await Complaint.find({
      organizationId: req.organization._id,
      categoryId: incident.categoryId,
      incidentId: { $in: activeIncidentIds },
    });

    // Similarity threshold (default: 0.2)
    const threshold = req.query.threshold ? parseFloat(req.query.threshold as string) : 0.2;

    const suggestions: Array<{
      complaint: any;
      similarityScore: number;
      sourceIncidentId: string;
    }> = [];

    for (const candidate of candidateComplaints) {
      let maxScore = 0;
      for (const attached of attachedComplaints) {
        const score = computeComplaintSimilarity(attached, candidate);
        if (score > maxScore) {
          maxScore = score;
        }
      }

      if (maxScore >= threshold) {
        suggestions.push({
          complaint: formatComplaint(candidate),
          similarityScore: Math.round(maxScore * 100) / 100,
          sourceIncidentId: candidate.incidentId.toString(),
        });
      }
    }

    // Sort descending by similarityScore
    suggestions.sort((a, b) => b.similarityScore - a.similarityScore);

    res.status(200).json({ suggestions });
  }
);

// GET /api/v1/orgs/:slug/incidents/:id/merge-candidates
incidentsRouter.get(
  "/:id/merge-candidates",
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
    });

    if (!incident) {
      res.status(404).json({ message: "Incident not found" });
      return;
    }

    const hasAccess = await checkCategoryPoolAccess(
      req.user,
      req.organization._id,
      incident.categoryId
    );

    if (!hasAccess) {
      res.status(403).json({ message: "Not authorized for this category pool" });
      return;
    }

    const searchQuery = typeof req.query.search === "string" ? req.query.search.trim() : "";

    // Find other active incidents in the same category
    const activeIncidents = await Incident.find({
      _id: { $ne: incident._id },
      organizationId: req.organization._id,
      categoryId: incident.categoryId,
      status: { $in: ACTIVE_INCIDENT_STATUSES },
    });

    const activeIncidentIds = activeIncidents.map((inc) => inc._id);

    const queryFilter: any = {
      organizationId: req.organization._id,
      categoryId: incident.categoryId,
      incidentId: { $in: activeIncidentIds },
    };

    if (searchQuery) {
      const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      queryFilter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
        { locationContext: { $regex: escaped, $options: "i" } },
      ];
    }

    const candidateComplaints = await Complaint.find(queryFilter).sort({ createdAt: -1 }).limit(20);

    res.status(200).json({
      candidates: candidateComplaints.map(formatComplaint),
    });
  }
);

const mergeComplaintSchema = z.object({
  complaintId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid complaint ID",
  }),
});

// POST /api/v1/orgs/:slug/incidents/:id/merge
incidentsRouter.post(
  "/:id/merge",
  verifyAuth,
  requireOrgAccess,
  async (req: Request, res: Response): Promise<void> => {
    if (req.user?.role !== "Staff" && req.user?.role !== "Admin") {
      res.status(403).json({ message: "Staff or Admin access required to merge incidents" });
      return;
    }

    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: "Invalid incident ID" });
      return;
    }

    const parseResult = mergeComplaintSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        message: "Invalid merge payload",
        errors: parseResult.error.format(),
      });
      return;
    }

    const { complaintId } = parseResult.data;

    const incident = await Incident.findOne({
      _id: id,
      organizationId: req.organization._id,
    });

    if (!incident) {
      res.status(404).json({ message: "Target incident not found" });
      return;
    }

    if (incident.status === "Resolved" || incident.status === "Closed") {
      res.status(400).json({ message: "Cannot merge into a resolved or closed incident" });
      return;
    }

    // Verify staff belongs to category pool
    const hasAccess = await checkCategoryPoolAccess(
      req.user,
      req.organization._id,
      incident.categoryId
    );

    if (!hasAccess) {
      res.status(403).json({ message: "Not authorized for this category pool" });
      return;
    }

    const complaint = await Complaint.findOne({
      _id: complaintId,
      organizationId: req.organization._id,
    });

    if (!complaint) {
      res.status(404).json({ message: "Complaint not found" });
      return;
    }

    if (complaint.categoryId.toString() !== incident.categoryId.toString()) {
      res.status(400).json({ message: "Cannot merge complaint from a different category" });
      return;
    }

    if (complaint.incidentId.toString() === incident._id.toString()) {
      res.status(400).json({ message: "Complaint is already attached to this incident" });
      return;
    }

    const sourceIncidentId = complaint.incidentId;

    // 1. Reassign complaint to target incident
    complaint.incidentId = incident._id;
    await complaint.save();

    // 2. Dynamic SLA Contraction Calculation
    const newCorroborationCount = incident.corroborationCount + 1;
    const category = await Category.findById(incident.categoryId);
    let newDeadline = incident.slaDeadline;
    let auditEntry: any = null;

    if (category) {
      const now = new Date();
      const prevDeadline = incident.slaDeadline;
      const { newDeadline: calculatedDeadline, contractedMs } = calculateContractedDeadline(
        prevDeadline,
        now,
        category.floorHours,
        category.contractionFactor,
        newCorroborationCount
      );
      newDeadline = calculatedDeadline;

      auditEntry = {
        complaintId: complaint._id,
        complaintTitle: complaint.title,
        previousDeadline: prevDeadline,
        newDeadline: newDeadline,
        contractedMs: contractedMs,
        corroborationCount: newCorroborationCount,
        createdAt: now,
      };
    }

    // 3. Atomically update incident in MongoDB (ADR 0004)
    const updateOps: any = {
      $inc: { corroborationCount: 1 },
      $set: { slaDeadline: newDeadline },
    };
    if (auditEntry) {
      updateOps.$push = { contractionAudit: auditEntry };
    }

    const updatedIncident = await Incident.findOneAndUpdate(
      { _id: incident._id },
      updateOps,
      { new: true }
    );

    // 4. Clean up source provisional incident if all its complaints have been merged out
    if (sourceIncidentId && sourceIncidentId.toString() !== incident._id.toString()) {
      const remainingInSource = await Complaint.countDocuments({
        incidentId: sourceIncidentId,
      });

      if (remainingInSource === 0) {
        await Incident.findByIdAndDelete(sourceIncidentId);
      } else {
        await Incident.findByIdAndUpdate(sourceIncidentId, {
          corroborationCount: remainingInSource,
        });
      }
    }

    const incidentToReturn = updatedIncident || incident;
    await incidentToReturn.populate("categoryId");
    await incidentToReturn.populate("assigneeId");
    await incidentToReturn.populate("supervisorId");

    const attachedComplaints = await Complaint.find({ incidentId: incident._id });

    res.status(200).json({
      incident: formatIncident(incidentToReturn),
      complaints: attachedComplaints.map(formatComplaint),
    });
  }
);
