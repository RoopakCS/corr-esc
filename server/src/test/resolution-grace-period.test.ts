import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";
import { Incident } from "../models/Incident.js";
import { Notification } from "../models/Notification.js";
import { runSlaBreachSweep } from "../services/slaSweeper.js";

const app = createApp();

describe("Ticket 08: Resolution Grace Period & Reopen Escalation Penalty", () => {
  const orgSlug = "apex-campus";
  let adminToken: string;
  let staffToken: string;
  let otherStaffToken: string;
  let complainantToken: string;
  let otherComplainantToken: string;
  let supervisorUserId: string;
  let categoryId: string;
  let incidentId: string;
  let complaintId: string;

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
        adminName: "Campus Admin",
        adminEmail: "admin@apex.edu",
        password: "AdminPassword123!",
      });
    adminToken = regRes.body.token;

    // 2. Register supervisor user
    const supRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Tier 1 Supervisor Sarah",
        email: "supervisor.sarah@apex.edu",
        password: "SupervisorPass123!",
        categoryPoolIds: [],
      });
    supervisorUserId = supRes.body.user.id;

    // 3. Register Category with Tier 1 Supervisor
    const catRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Campus Maintenance",
        baseSlaHours: 12,
        floorHours: 2,
        contractionFactor: 0.2,
        tierTargets: [
          {
            tier: 1,
            targetRole: "Supervisor",
            roleOrUserId: supervisorUserId,
            slaHours: 6,
          },
        ],
      });
    categoryId = catRes.body.category.id;

    // 4. Provision assigned staff member
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Field Staff Bob",
        email: "bob@apex.edu",
        password: "StaffPassword123!",
        categoryPoolIds: [categoryId],
      });
    const staffLoginRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "bob@apex.edu",
        password: "StaffPassword123!",
      });
    staffToken = staffLoginRes.body.token;

    // 5. Provision unassigned staff member
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Other Staff Charlie",
        email: "charlie@apex.edu",
        password: "StaffPassword123!",
        categoryPoolIds: [categoryId],
      });
    const otherStaffLoginRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "charlie@apex.edu",
        password: "StaffPassword123!",
      });
    otherStaffToken = otherStaffLoginRes.body.token;

    // 6. Register attached complainant
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Complainant Alice",
        email: "alice@apex.edu",
        password: "ComplainantPass123!",
      });
    complainantToken = compRes.body.token;

    // 7. Register another complainant not attached to this incident
    const otherCompRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Unrelated Complainant Dave",
        email: "dave@apex.edu",
        password: "ComplainantPass123!",
      });
    otherComplainantToken = otherCompRes.body.token;

    // 8. Submit complaint and create incident
    const submitRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Broken Corridor Lighting",
        description: "Third floor corridor lights are flickering and completely out near room 302.",
        locationContext: "North Wing Floor 3",
      });
    complaintId = submitRes.body.complaint.id;
    incidentId = submitRes.body.incident.id;

    // 9. Staff claims incident and sets status to In Progress
    await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/claim`)
      .set("Authorization", `Bearer ${staffToken}`);

    await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "In Progress" });
  });

  it("transitions incident from In Progress to Resolved, sets 24-hour grace period, and notifies attached complainants", async () => {
    const beforeResolve = Date.now();

    const resolveRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Resolved" });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.incident.status).toBe("Resolved");
    expect(resolveRes.body.incident.gracePeriodExpiresAt).toBeDefined();

    const graceExpiry = new Date(resolveRes.body.incident.gracePeriodExpiresAt).getTime();
    const expectedExpiryMin = beforeResolve + 24 * 3600 * 1000 - 5000;
    const expectedExpiryMax = beforeResolve + 24 * 3600 * 1000 + 5000;
    expect(graceExpiry).toBeGreaterThanOrEqual(expectedExpiryMin);
    expect(graceExpiry).toBeLessThanOrEqual(expectedExpiryMax);

    // Verify verification notification created for attached complainant Alice
    const notifications = await Notification.find({
      incidentId: new mongoose.Types.ObjectId(incidentId),
    });

    const verificationNotification = notifications.find(
      (n) => n.title.includes("Resolution") || n.message.includes("verify")
    );
    expect(verificationNotification).toBeDefined();
    expect(verificationNotification?.recipientId.toString()).toBeDefined();

    // Verify cannot transition to Resolved directly from New or Assigned
    const freshSubmit = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Leaking Faucet",
        description: "Water leaking steadily in ground floor washroom.",
      });
    const freshIncidentId = freshSubmit.body.incident.id;

    const invalidResolveRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${freshIncidentId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "Resolved" });

    expect(invalidResolveRes.status).toBe(400);
  });

  it("allows attached complainant to contest resolution via 'Still Not Fixed', reopening incident with +1 escalation penalty and urgent supervisor alert", async () => {
    // 1. Mark incident Resolved
    await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Resolved" });

    const beforeContest = await Incident.findById(incidentId);
    expect(beforeContest?.status).toBe("Resolved");
    expect(beforeContest?.escalationTier).toBe(0);
    expect(beforeContest?.reopenCount).toBe(0);

    // 2. Complainant Alice flags incident as 'Still Not Fixed'
    const contestRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/contest`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        feedback: "The light fixture is still buzzing and dark when switched on.",
      });

    expect(contestRes.status).toBe(200);
    expect(contestRes.body.incident.status).toBe("In Progress");
    expect(contestRes.body.incident.reopenCount).toBe(1);
    expect(contestRes.body.incident.escalationTier).toBe(1); // +1 escalation tier penalty
    expect(contestRes.body.incident.supervisorId).toBe(supervisorUserId);
    expect(contestRes.body.incident.gracePeriodExpiresAt).toBeUndefined();

    // 3. Verify urgent supervisor notification was generated
    const supervisorNotifications = await Notification.find({
      recipientId: new mongoose.Types.ObjectId(supervisorUserId),
      priority: "high",
    });
    expect(supervisorNotifications.length).toBeGreaterThan(0);
    expect(supervisorNotifications[0].title).toMatch(/reopened|contested|escalat/i);

    // 4. Verify unattached complainant cannot contest the incident
    const unauthorizedContest = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/contest`)
      .set("Authorization", `Bearer ${otherComplainantToken}`)
      .send({ feedback: "I am not attached to this incident" });

    expect([400, 403]).toContain(unauthorizedContest.status);
  });

  it("allows attached complainant to confirm resolution, transitioning status to Closed", async () => {
    // 1. Mark incident Resolved
    await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Resolved" });

    // 2. Complainant Alice confirms resolution
    const confirmRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/confirm-resolution`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.incident.status).toBe("Closed");

    const closedIncident = await Incident.findById(incidentId);
    expect(closedIncident?.status).toBe("Closed");
  });

  it("automatically transitions un-contested Resolved incidents to Closed upon 24-hour grace period expiry via sweeper", async () => {
    // 1. Mark incident Resolved
    const resolveRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Resolved" });

    const graceExpiry = new Date(resolveRes.body.incident.gracePeriodExpiresAt);

    // 2. Run sweeper at 23 hours (before grace period expires)
    const sweepAt23h = new Date(graceExpiry.getTime() - 3600 * 1000);
    const result23h = await runSlaBreachSweep(sweepAt23h);
    expect(result23h.closedIncidents || []).not.toContain(incidentId);

    const checkAt23h = await Incident.findById(incidentId);
    expect(checkAt23h?.status).toBe("Resolved");

    // 3. Run sweeper at 24 hours + 1 minute (after grace period expires)
    const sweepAt25h = new Date(graceExpiry.getTime() + 60 * 1000);
    const result25h = await runSlaBreachSweep(sweepAt25h);
    expect(result25h.closedIncidents).toContain(incidentId);

    const checkAt25h = await Incident.findById(incidentId);
    expect(checkAt25h?.status).toBe("Closed");
  });

  it("rejects contest requests if the 24-hour grace period has expired", async () => {
    // 1. Mark incident Resolved
    await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "Resolved" });

    // Simulate grace period expiry in DB
    const expiredTime = new Date(Date.now() - 1000);
    await Incident.findByIdAndUpdate(incidentId, {
      gracePeriodExpiresAt: expiredTime,
    });

    // 2. Try to contest after expiry
    const contestRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/contest`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({ feedback: "Contesting too late" });

    expect(contestRes.status).toBe(400);
    expect(contestRes.body.message).toMatch(/grace period has expired/i);
  });
});
