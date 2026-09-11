import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";
import { Notification } from "../models/Notification.js";

const app = createApp();

describe("Ticket 09: Persistent In-App Notification Center & Activity Feed", () => {
  const orgSlug = "apex-campus";
  let adminToken: string;
  let adminUserId: string;
  let staffToken: string;
  let staffUserId: string;
  let complainantToken: string;
  let complainantUserId: string;
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
    adminUserId = regRes.body.admin.id;

    // 2. Create Category
    const catRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Campus Maintenance",
        baseSlaHours: 12,
        floorHours: 2,
        contractionFactor: 0.2,
      });
    categoryId = catRes.body.category.id;

    // 3. Provision staff member
    const staffRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Field Staff Bob",
        email: "bob@apex.edu",
        password: "StaffPassword123!",
        categoryPoolIds: [categoryId],
      });
    staffUserId = staffRes.body.user.id;

    const staffLoginRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "bob@apex.edu",
        password: "StaffPassword123!",
      });
    staffToken = staffLoginRes.body.token;

    // 4. Register complainant
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Complainant Alice",
        email: "alice@apex.edu",
        password: "ComplainantPass123!",
      });
    complainantToken = compRes.body.token;
    complainantUserId = compRes.body.user.id;
  });

  it("generates structured notification upon complaint submission and returns in notification feed", async () => {
    const submitRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Water leak in washroom",
        description: "Flooding near main auditorium washroom sink.",
        locationContext: "Ground Floor Block A",
      });

    expect(submitRes.status).toBe(201);
    incidentId = submitRes.body.incident.id;
    complaintId = submitRes.body.complaint.id;

    // Complainant should have an unread submission confirmation notification
    const compNotifRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(compNotifRes.status).toBe(200);
    expect(compNotifRes.body.unreadCount).toBeGreaterThanOrEqual(1);
    expect(compNotifRes.body.notifications.length).toBeGreaterThanOrEqual(1);

    const subNotif = compNotifRes.body.notifications[0];
    expect(subNotif.title).toMatch(/complaint.*received|acknowledged|submitted/i);
    expect(subNotif.isRead).toBe(false);
    expect(subNotif.incidentId).toBe(incidentId);

    // Admin should also receive new incident notification
    const adminNotifRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminNotifRes.status).toBe(200);
    expect(adminNotifRes.body.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it("allows marking a single notification as read, updating unread count", async () => {
    // Submit complaint to generate notification
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Broken window handle",
        description: "Handle snapped off during window opening.",
      });

    const notifRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(notifRes.body.unreadCount).toBe(1);
    const notifId = notifRes.body.notifications[0].id;

    // Mark as read
    const readRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/notifications/${notifId}/read`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.notification.isRead).toBe(true);

    // Check unread count is now 0
    const updatedNotifRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(updatedNotifRes.body.unreadCount).toBe(0);
  });

  it("allows marking all notifications as read in bulk", async () => {
    // Generate 2 notifications for complainant
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Complaint 1",
        description: "First complaint description",
      });

    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Complaint 2",
        description: "Second complaint description",
      });

    const initialCheck = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(initialCheck.body.unreadCount).toBe(2);

    // Call mark-all-read
    const bulkRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/notifications/mark-all-read`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(bulkRes.status).toBe(200);

    const postCheck = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(postCheck.body.unreadCount).toBe(0);
    expect(postCheck.body.notifications.every((n: any) => n.isRead)).toBe(true);
  });

  it("generates notification for attached complainant when staff claims incident", async () => {
    const submitRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Power outage in lab",
        description: "Circuit tripped during experiment.",
      });
    const incId = submitRes.body.incident.id;

    // Staff claims the incident
    const claimRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incId}/claim`)
      .set("Authorization", `Bearer ${staffToken}`);
    expect(claimRes.status).toBe(200);

    // Complainant should receive assignment notification
    const compNotifRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${complainantToken}`);

    const assignmentNotif = compNotifRes.body.notifications.find(
      (n: any) => n.type === "incident_assigned" || n.title.includes("Assigned")
    );
    expect(assignmentNotif).toBeDefined();
    expect(assignmentNotif.message).toMatch(/Bob/i);
  });

  it("generates notification for complainant and assignee when complaints are merged", async () => {
    // 1. Submit initial complaint and claim it
    const submit1 = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "AC leaking in hall",
        description: "AC unit dropping water on carpet.",
      });
    const incId = submit1.body.incident.id;

    await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incId}/claim`)
      .set("Authorization", `Bearer ${staffToken}`);

    // 2. Register second complainant and submit corroboration
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Complainant Bob",
        email: "bob_comp@apex.edu",
        password: "ComplainantPass123!",
      });
    const comp2Token = comp2Res.body.token;

    const submit2 = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${comp2Token}`)
      .send({
        categoryId,
        title: "Water dripping from AC in hall",
        description: "Ceiling AC unit is dripping water rapidly.",
      });
    const comp2ComplaintId = submit2.body.complaint.id;

    // 3. Staff merges complaint 2 into incident 1
    const mergeRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: comp2ComplaintId });
    expect(mergeRes.status).toBe(200);

    // 4. Check complainant 2 received notification of corroboration merge
    const comp2Notifs = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${comp2Token}`);

    const mergeNotif = comp2Notifs.body.notifications.find(
      (n: any) => n.type === "complaint_merged" || n.title.includes("Corroborat")
    );
    expect(mergeNotif).toBeDefined();

    // 5. Check assigned staff received notification of dynamic SLA contraction
    const staffNotifs = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/notifications`)
      .set("Authorization", `Bearer ${staffToken}`);

    const contractionNotif = staffNotifs.body.notifications.find(
      (n: any) => n.type === "sla_contracted" || n.title.includes("Contracted")
    );
    expect(contractionNotif).toBeDefined();
  });

  it("provides an SSE event stream endpoint for real-time dashboard updates", async () => {
    const http = await import("http");
    const server = app.listen(0);
    const port = (server.address() as any).port;

    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        `http://localhost:${port}/api/v1/orgs/${orgSlug}/events?token=${complainantToken}`,
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
          res.on("data", (chunk: Buffer) => {
            const dataStr = chunk.toString();
            if (dataStr.includes("connected")) {
              req.destroy();
              server.close(() => resolve());
            }
          });
        }
      );

      req.on("error", (err: any) => {
        if (err.code === "ECONNRESET" || err.message?.includes("socket hang up")) {
          server.close(() => resolve());
        } else {
          server.close(() => reject(err));
        }
      });
    });
  });
});
