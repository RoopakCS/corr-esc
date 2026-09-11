import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";
import { Incident } from "../models/Incident.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { runSlaBreachSweep } from "../services/slaSweeper.js";

const app = createApp();

describe("Ticket 07: Background SLA Sweeper & Supervisory Tier Escalation", () => {
  const orgSlug = "apex-tech";
  let adminToken: string;
  let staffToken: string;
  let supervisorToken: string;
  let complainantToken: string;
  let categoryId: string;
  let staffUserId: string;
  let supervisorUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Register organization with admin
    const regRes = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Apex Campus",
        slug: orgSlug,
        adminName: "Apex Admin",
        adminEmail: "admin@apex.edu",
        password: "SecureAdminPassword123!",
      });
    adminToken = regRes.body.token;
    adminUserId = regRes.body.admin.id;

    // 2. Register supervisor staff user
    const supRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Senior Supervisor John",
        email: "supervisor.john@apex.edu",
        password: "SupervisorPass123!",
        categoryPoolIds: [],
      });
    supervisorUserId = supRes.body.user.id;

    // 3. Register primary operational staff user
    const staffRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Operational Staff Alice",
        email: "alice.staff@apex.edu",
        password: "StaffPassword123!",
        categoryPoolIds: [],
      });
    staffUserId = staffRes.body.user.id;
    staffToken = (
      await request(app)
        .post(`/api/v1/orgs/${orgSlug}/auth/login`)
        .send({ email: "alice.staff@apex.edu", password: "StaffPassword123!" })
    ).body.token;

    // 4. Create Category with explicit tierTargets configuration
    const catRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Campus Maintenance",
        baseSlaHours: 8,
        floorHours: 1,
        contractionFactor: 0.3,
        tierTargets: [
          {
            tier: 1,
            supervisorRole: "Supervisor",
            roleOrUserId: supervisorUserId,
            slaHours: 4,
          },
          {
            tier: 2,
            supervisorRole: "Director",
            roleOrUserId: adminUserId,
            slaHours: 2,
          },
        ],
      });
    categoryId = catRes.body.category.id;

    // Attach staff to the category pool
    await User.findByIdAndUpdate(staffUserId, {
      $push: { categoryPoolIds: categoryId },
    });

    // 5. Register Complainant
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Student Complainant",
        email: "student@apex.edu",
        password: "StudentPassword123!",
      });
    complainantToken = compRes.body.token;
  });

  it("sweeper detects breached active incidents and atomically increments escalationTier while preserving primary assignee", async () => {
    // 1. Submit a complaint creating an incident
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Main transformer power outage",
        description: "Entire lab building has no electricity and backup inverter failed.",
        locationContext: "Engineering Block B, Ground Floor Electrical Room",
      });
    const incidentId = compRes.body.incident.id;

    // 2. Primary staff claims the incident
    const claimRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/claim`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(claimRes.status).toBe(200);

    // Verify initial state: status is Assigned, escalationTier is 0, assigneeId is Alice
    const initialIncident = await Incident.findById(incidentId);
    expect(initialIncident?.status).toBe("Assigned");
    expect(initialIncident?.escalationTier).toBe(0);
    expect(initialIncident?.assigneeId?.toString()).toBe(staffUserId);
    expect(initialIncident?.supervisorId).toBeUndefined();

    // 3. Virtual Clock: Move time past the initial deadline
    const initialDeadline = new Date(initialIncident!.slaDeadline);
    const virtualSweepTime = new Date(initialDeadline.getTime() + 1000 * 60); // 1 minute after deadline

    // 4. Run sweeper with virtual timestamp
    const sweepResult = await runSlaBreachSweep(virtualSweepTime);
    expect(sweepResult.breachedCount).toBeGreaterThanOrEqual(1);
    expect(sweepResult.escalatedIncidents).toContain(incidentId);

    // 5. Verify database mutations on Incident document:
    const escalatedIncident = await Incident.findById(incidentId);
    // Escalation tier atomically incremented
    expect(escalatedIncident?.escalationTier).toBe(1);
    // Status maintained independently (orthogonal status per ADR 0002)
    expect(escalatedIncident?.status).toBe("Assigned");
    // Primary assignee remains intact (primary assignee accountability preserved per ADR 0005)
    expect(escalatedIncident?.assigneeId?.toString()).toBe(staffUserId);
    // Designated supervisor attached from category tierTargets
    expect(escalatedIncident?.supervisorId?.toString()).toBe(supervisorUserId);
    // New SLA deadline assigned according to Tier 1 configuration (4 hours from breach time)
    const expectedNewDeadlineMin = new Date(virtualSweepTime.getTime() + 4 * 3600 * 1000 - 1000);
    const expectedNewDeadlineMax = new Date(virtualSweepTime.getTime() + 4 * 3600 * 1000 + 1000);
    expect(new Date(escalatedIncident!.slaDeadline).getTime()).toBeGreaterThanOrEqual(
      expectedNewDeadlineMin.getTime()
    );
    expect(new Date(escalatedIncident!.slaDeadline).getTime()).toBeLessThanOrEqual(
      expectedNewDeadlineMax.getTime()
    );
  });

  it("generates high-priority breach notifications for designated supervisor and organization admin", async () => {
    // Submit complaint
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Sewage leak in cafeteria basement",
        description: "Severe leak overflowing into prep area.",
        locationContext: "Dining Hall Basement",
      });
    const incidentId = compRes.body.incident.id;

    // Simulate SLA breach with virtual clock
    const initialIncident = await Incident.findById(incidentId);
    const virtualSweepTime = new Date(new Date(initialIncident!.slaDeadline).getTime() + 5000);

    // Run sweeper
    await runSlaBreachSweep(virtualSweepTime);

    // Verify notifications were created
    const notifications = await Notification.find({ incidentId });
    expect(notifications.length).toBeGreaterThanOrEqual(2);

    // Find notification for designated supervisor
    const supervisorNotif = notifications.find(
      (n) => n.recipientId.toString() === supervisorUserId
    );
    expect(supervisorNotif).toBeDefined();
    expect(supervisorNotif?.priority).toBe("high");
    expect(supervisorNotif?.type).toBe("ESCALATION_BREACH");
    expect(supervisorNotif?.isRead).toBe(false);

    // Find notification for organization admin
    const adminNotif = notifications.find(
      (n) => n.recipientId.toString() === adminUserId && n.type === "ESCALATION_BREACH"
    );
    expect(adminNotif).toBeDefined();
    expect(adminNotif?.priority).toBe("high");
    expect(adminNotif?.type).toBe("ESCALATION_BREACH");
  });

  it("handles multi-tier progression (Tier 1 -> Tier 2) on successive breaches", async () => {
    // Submit complaint
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Campus-wide fiber backbone severed",
        description: "All networking down across all academic zones.",
        locationContext: "Server Room A",
      });
    const incidentId = compRes.body.incident.id;

    const initialIncident = await Incident.findById(incidentId);
    // 1st breach: Escalate to Tier 1
    const sweep1Time = new Date(new Date(initialIncident!.slaDeadline).getTime() + 1000);
    await runSlaBreachSweep(sweep1Time);

    const tier1Incident = await Incident.findById(incidentId);
    expect(tier1Incident?.escalationTier).toBe(1);
    expect(tier1Incident?.supervisorId?.toString()).toBe(supervisorUserId);

    // 2nd breach: Virtual time moves past the Tier 1 deadline
    const sweep2Time = new Date(new Date(tier1Incident!.slaDeadline).getTime() + 1000);
    await runSlaBreachSweep(sweep2Time);

    const tier2Incident = await Incident.findById(incidentId);
    expect(tier2Incident?.escalationTier).toBe(2);
    // Tier 2 target was adminUserId with 2 hours SLA
    expect(tier2Incident?.supervisorId?.toString()).toBe(adminUserId);
  });

  it("does not breach or escalate incidents whose deadline is still in the future or which are already resolved/closed", async () => {
    // 1. Future incident
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Flickering fluorescent tube in lecture hall",
        description: "Minor annoyance during lectures.",
        locationContext: "Hall 101",
      });
    const incidentId = compRes.body.incident.id;

    // 2. Incident that had breached deadline but was marked Resolved
    const compRes2 = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Broken chair leg",
        description: "Chair is wobbly.",
        locationContext: "Hall 102",
      });
    const resolvedIncidentId = compRes2.body.incident.id;
    await Incident.findByIdAndUpdate(resolvedIncidentId, {
      status: "Resolved",
      slaDeadline: new Date(Date.now() - 3600 * 1000), // In the past
    });

    // Run sweep at current time (future incident deadline is 8 hours away)
    const sweepResult = await runSlaBreachSweep(new Date());

    const unbreached = await Incident.findById(incidentId);
    expect(unbreached?.escalationTier).toBe(0);

    const resolved = await Incident.findById(resolvedIncidentId);
    expect(resolved?.escalationTier).toBe(0);
    expect(sweepResult.escalatedIncidents).not.toContain(incidentId);
    expect(sweepResult.escalatedIncidents).not.toContain(resolvedIncidentId);
  });

  it("surfaces supervisory incidents through the HTTP API seam", async () => {
    // Submit and breach incident
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Major water line pipe burst",
        description: "Flooding in student center.",
        locationContext: "Student Activity Center",
      });
    const incidentId = compRes.body.incident.id;
    const initialIncident = await Incident.findById(incidentId);
    await runSlaBreachSweep(new Date(new Date(initialIncident!.slaDeadline).getTime() + 10000));

    // Supervisor queries incidents
    const supIncidentsRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents?escalated=true`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(supIncidentsRes.status).toBe(200);
    const matched = supIncidentsRes.body.incidents.find((i: any) => i.id === incidentId);
    expect(matched).toBeDefined();
    expect(matched.escalationTier).toBe(1);
    expect(matched.supervisor).toBeDefined();
    expect(matched.supervisor.id).toBe(supervisorUserId);
    expect(matched.supervisor.name).toBe("Senior Supervisor John");
  });
});
