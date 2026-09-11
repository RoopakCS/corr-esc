import mongoose, { Types } from "mongoose";
import { Incident, IncidentStatus } from "../models/Incident.js";
import { Complaint } from "../models/Complaint.js";
import { Category, ISupervisorTier } from "../models/Category.js";
import { User, IUser } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { broadcastOrgEvent } from "./realtime.js";

const ACTIVE_INCIDENT_STATUSES: IncidentStatus[] = [
  "New",
  "Assigned",
  "In Progress",
];

export interface BreachSweepResult {
  sweptAt: Date;
  breachedCount: number;
  escalatedIncidents: string[];
  closedCount: number;
  closedIncidents: string[];
  notificationsCreated: number;
}

async function findUserByTarget(
  organizationId: Types.ObjectId | string,
  target: string | undefined
): Promise<IUser | null> {
  if (!target) return null;
  const trimmed = target.trim();
  if (mongoose.Types.ObjectId.isValid(trimmed)) {
    const userById = await User.findOne({ _id: trimmed, organizationId });
    if (userById) return userById;
  }
  return User.findOne({
    organizationId,
    $or: [{ email: trimmed.toLowerCase() }, { name: trimmed }],
  });
}

export async function resolveSupervisor(
  organizationId: Types.ObjectId | string,
  tierTarget: ISupervisorTier | undefined
): Promise<IUser | null> {
  if (tierTarget?.roleOrUserId) {
    const user = await findUserByTarget(organizationId, tierTarget.roleOrUserId);
    if (user) return user;
  }

  if (tierTarget?.supervisorRole) {
    const user = await findUserByTarget(organizationId, tierTarget.supervisorRole);
    if (user) return user;
  }

  // Fallback: Organization Admin (top authority)
  return User.findOne({
    organizationId,
    role: "Admin",
  });
}

/**
 * Executes a single sweep cycle over active incidents, evaluating breached SLA deadlines,
 * atomically advancing escalation tiers, preserving the primary assignee, attaching the
 * designated supervisor, assigning a new deadline, and dispatching high-priority notifications.
 *
 * Accepts an optional referenceTime Date parameter to support deterministic virtual clock testing.
 */
export async function runSlaBreachSweep(
  referenceTime: Date = new Date()
): Promise<BreachSweepResult> {
  const breachedIncidents = await Incident.find({
    status: { $in: ACTIVE_INCIDENT_STATUSES },
    slaDeadline: { $lte: referenceTime },
  });

  const escalatedIds: string[] = [];
  let totalNotificationsCreated = 0;

  for (const incident of breachedIncidents) {
    const currentTier = incident.escalationTier;
    const category = await Category.findById(incident.categoryId);

    // Look up designated tier target from category configuration
    const hasConfiguredTiers = !!(category && category.tierTargets && category.tierTargets.length > 0);
    const maxConfiguredTier = hasConfiguredTiers
      ? Math.max(...category.tierTargets.map((t) => t.tier))
      : 5;

    const newTier = currentTier < maxConfiguredTier ? currentTier + 1 : maxConfiguredTier;

    let tierTarget: ISupervisorTier | undefined;
    if (category && category.tierTargets && category.tierTargets.length > 0) {
      tierTarget =
        category.tierTargets.find((t) => t.tier === newTier) ||
        category.tierTargets[category.tierTargets.length - 1];
    }

    // Resolve designated supervisor
    const supervisor = await resolveSupervisor(
      incident.organizationId,
      tierTarget
    );

    // Calculate new deadline for the escalated tier
    let newDeadline: Date;
    if (tierTarget?.slaHours && tierTarget.slaHours > 0) {
      newDeadline = new Date(
        referenceTime.getTime() + tierTarget.slaHours * 3600 * 1000
      );
    } else if (category?.baseSlaHours && category.baseSlaHours > 0) {
      newDeadline = new Date(
        referenceTime.getTime() + category.baseSlaHours * 3600 * 1000
      );
    } else {
      newDeadline = new Date(referenceTime.getTime() + 24 * 3600 * 1000);
    }

    // Atomically increment or update escalationTier and set new deadline + supervisor
    // Concurrency guard: match exact currentTier to avoid racing double increments
    const updateOps: any = {
      $set: {
        slaDeadline: newDeadline,
        escalationTier: newTier,
      },
    };

    if (supervisor) {
      updateOps.$set.supervisorId = supervisor._id;
    }

    // Note: assigneeId is intentionally untouched to preserve primary assignee accountability (ADR 0005)
    const updated = await Incident.findOneAndUpdate(
      {
        _id: incident._id,
        escalationTier: currentTier,
        status: { $in: ACTIVE_INCIDENT_STATUSES },
      },
      updateOps,
      { new: true }
    );

    if (!updated) {
      // Concurrently escalated or status transitioned by another process
      continue;
    }

    escalatedIds.push(updated._id.toString());

    // Generate high-priority breach notifications for designated supervisor, assignee, and org admins
    const recipientIds = new Set<string>();
    if (supervisor) {
      recipientIds.add(supervisor._id.toString());
    }
    if (incident.assigneeId) {
      recipientIds.add(incident.assigneeId.toString());
    }

    const admins = await User.find({
      organizationId: incident.organizationId,
      role: "Admin",
    });

    for (const admin of admins) {
      recipientIds.add(admin._id.toString());
    }

    for (const recipientId of recipientIds) {
      await Notification.create({
        organizationId: incident.organizationId,
        recipientId: new mongoose.Types.ObjectId(recipientId),
        incidentId: incident._id,
        type: "ESCALATION_BREACH",
        title: `[Tier ${newTier} Breach] SLA Exceeded for Incident #${incident._id
          .toString()
          .slice(-6)}`,
        message: `Incident in category "${
          category?.name || "Incident"
        }" breached its dynamic SLA deadline and escalated to Tier ${newTier}. Supervisory oversight assigned.`,
        priority: "high",
        isRead: false,
        createdAt: referenceTime,
      });
      totalNotificationsCreated += 1;
    }

    // Also notify attached complainants about the tier escalation
    const attachedComplaints = await Complaint.find({ incidentId: incident._id });
    const complainantIds = Array.from(
      new Set(attachedComplaints.map((c) => c.complainantId.toString()))
    );

    for (const compId of complainantIds) {
      await Notification.create({
        organizationId: incident.organizationId,
        recipientId: new mongoose.Types.ObjectId(compId),
        incidentId: incident._id,
        type: "incident_escalated",
        title: `Incident Escalated to Tier ${newTier}`,
        message: `Your complaint's incident in category "${
          category?.name || "Incident"
        }" has breached its SLA and has been escalated to Tier ${newTier} for higher supervisory oversight.`,
        priority: "high",
        isRead: false,
        createdAt: referenceTime,
      });
      totalNotificationsCreated += 1;
    }

    // Broadcast escalation event via SSE
    broadcastOrgEvent(incident.organizationId.toString(), "incident:escalated", {
      incidentId: updated._id.toString(),
      escalationTier: newTier,
      slaDeadline: newDeadline,
    });
  }

  // Sweep resolved incidents whose grace period has expired without contest
  const expiredResolved = await Incident.find({
    status: "Resolved",
    gracePeriodExpiresAt: { $lte: referenceTime },
  });

  const closedIncidents: string[] = [];
  for (const inc of expiredResolved) {
    const closed = await Incident.findOneAndUpdate(
      {
        _id: inc._id,
        status: "Resolved",
        gracePeriodExpiresAt: { $lte: referenceTime },
      },
      {
        $set: { status: "Closed" },
      },
      { new: true }
    );
    if (closed) {
      closedIncidents.push(closed._id.toString());
      broadcastOrgEvent(inc.organizationId.toString(), "incident:closed", {
        incidentId: closed._id.toString(),
      });
    }
  }

  return {
    sweptAt: referenceTime,
    breachedCount: escalatedIds.length,
    escalatedIncidents: escalatedIds,
    closedCount: closedIncidents.length,
    closedIncidents,
    notificationsCreated: totalNotificationsCreated,
  };
}

let sweeperTimer: NodeJS.Timeout | null = null;

export function startSlaSweeper(intervalMs: number = 30000): void {
  if (sweeperTimer) return;

  sweeperTimer = setInterval(() => {
    runSlaBreachSweep().catch((err) => {
      console.error("Error running SLA breach sweeper cycle:", err);
    });
  }, intervalMs);

  // Unref timer so it doesn't block graceful process exits in scripts
  if (sweeperTimer.unref) {
    sweeperTimer.unref();
  }
}

export function stopSlaSweeper(): void {
  if (sweeperTimer) {
    clearInterval(sweeperTimer);
    sweeperTimer = null;
  }
}
