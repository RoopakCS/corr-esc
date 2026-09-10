import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";

const app = createApp();

describe("Ticket 04: Staff Provisioning & Category Pool Incident Queue", () => {
  let orgSlug = "saveetha-engineering";
  let adminToken: string;
  let plumbingCategoryId: string;
  let electricalCategoryId: string;

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
        organizationName: "Saveetha Engineering",
        slug: orgSlug,
        adminName: "Dean Academic",
        adminEmail: "dean@saveetha.ac.in",
        password: "AdminPassword123!",
      });
    adminToken = regRes.body.token;

    // 2. Create Plumbing Category (12h base SLA)
    const plumbCatRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Plumbing",
        baseSlaHours: 12,
        floorHours: 2,
        contractionFactor: 0.15,
      });
    plumbingCategoryId = plumbCatRes.body.category.id;

    // 3. Create Electrical Category (24h base SLA)
    const elecCatRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Electrical",
        baseSlaHours: 24,
        floorHours: 4,
        contractionFactor: 0.2,
      });
    electricalCategoryId = elecCatRes.body.category.id;
  });

  it("allows Admin to provision Staff accounts assigned to specific Category Pools", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Ramesh Kumar",
        email: "ramesh@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: "Ramesh Kumar",
      email: "ramesh@saveetha.ac.in",
      role: "Staff",
    });
    expect(res.body.user.categoryPoolIds).toContain(plumbingCategoryId);
    expect(res.body.user.categoryPoolIds).not.toContain(electricalCategoryId);

    // List staff
    const listRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.staff).toHaveLength(1);
    expect(listRes.body.staff[0].name).toBe("Ramesh Kumar");
    expect(listRes.body.staff[0].categoryPools[0].name).toBe("Plumbing");
  });

  it("denies non-admin from provisioning staff", async () => {
    // Register complainant
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Complainant Priya",
        email: "priya@saveetha.ac.in",
        password: "Pass123456!",
      });
    const complainantToken = compRes.body.token;

    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        name: "Malicious Staff",
        email: "malicious@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/admin access required/i);
  });

  it("filters staff incident dashboard strictly by assigned category pools", async () => {
    // 1. Provision Plumbing Staff
    const staffRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Ramesh Plumbing Staff",
        email: "plumber@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });
    expect(staffRes.status).toBe(201);

    // 2. Staff login
    const loginRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "plumber@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    const staffToken = loginRes.body.token;
    expect(loginRes.body.user.role).toBe("Staff");

    // 3. Register complainant and file 1 Plumbing complaint and 1 Electrical complaint
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Karthik Complainant",
        email: "karthik@saveetha.ac.in",
        password: "ComplainantPass123!",
      });
    const compToken = compRes.body.token;

    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${compToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Pipe Burst in Lab 2",
        description: "Water leaking all over lab equipment",
        locationContext: "Lab 202, Ground Floor",
      });

    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${compToken}`)
      .send({
        categoryId: electricalCategoryId,
        title: "Power Socket Sparking",
        description: "Sparking occurred when plugging in projector",
        locationContext: "Seminar Hall A",
      });

    // 4. Staff fetches incident queue: should ONLY see Plumbing incident
    const queueRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.incidents).toHaveLength(1);
    expect(queueRes.body.incidents[0].categoryId).toBe(plumbingCategoryId);
    expect(queueRes.body.incidents[0].status).toBe("New");

    // 5. Admin fetches incident queue: should see BOTH incidents
    const adminQueueRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(adminQueueRes.status).toBe(200);
    expect(adminQueueRes.body.incidents).toHaveLength(2);
  });

  it("allows staff to view incident details with all attached complaints", async () => {
    // Provision staff
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Ramesh Staff",
        email: "ramesh.view@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });

    const staffLogin = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "ramesh.view@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    const staffToken = staffLogin.body.token;

    // Submit complaint
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Arun Complainant",
        email: "arun@saveetha.ac.in",
        password: "Pass123456!",
      });

    const complaintRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${compRes.body.token}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Leaking valve",
        description: "Continuous drip in washroom",
        locationContext: "Block 3, 2nd floor",
        photoUrl: "https://example.com/leak.jpg",
      });

    const incidentId = complaintRes.body.incident.id;

    // Fetch incident details as staff
    const detailRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.incident.id).toBe(incidentId);
    expect(detailRes.body.incident.status).toBe("New");
    expect(detailRes.body.complaints).toHaveLength(1);
    expect(detailRes.body.complaints[0]).toMatchObject({
      title: "Leaking valve",
      description: "Continuous drip in washroom",
      locationContext: "Block 3, 2nd floor",
      photoUrl: "https://example.com/leak.jpg",
    });
  });

  it("allows staff member to claim an unassigned incident, setting status to Assigned and assigneeId to self", async () => {
    // 1. Provision staff
    const staffUserRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Suresh Assignee",
        email: "suresh@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });
    const staffUserId = staffUserRes.body.user.id;

    const staffLogin = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "suresh@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    const staffToken = staffLogin.body.token;

    // 2. Submit complaint -> creates New incident
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Deepa Complainant",
        email: "deepa@saveetha.ac.in",
        password: "Pass123456!",
      });

    const submitRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${compRes.body.token}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Clogged drainage",
        description: "Backflow in main sink",
      });

    const incidentId = submitRes.body.incident.id;

    // 3. Staff claims incident
    const claimRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/claim`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send();

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.incident.status).toBe("Assigned");
    expect(claimRes.body.incident.assigneeId).toBe(staffUserId);

    // 4. Verify complainant sees updated status on /my
    const compMyRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/complaints/my`)
      .set("Authorization", `Bearer ${compRes.body.token}`);

    expect(compMyRes.body.complaints[0].incident.status).toBe("Assigned");
  });

  it("allows assigned staff member to transition incident status from Assigned to In Progress", async () => {
    // 1. Provision staff
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Vijay Tech",
        email: "vijay@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });

    const staffLogin = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "vijay@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    const staffToken = staffLogin.body.token;

    // 2. Complainant files complaint
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Meena Complainant",
        email: "meena@saveetha.ac.in",
        password: "Pass123456!",
      });

    const submitRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${compRes.body.token}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Restroom Tap Broken",
        description: "Needs washer replacement",
      });

    const incidentId = submitRes.body.incident.id;

    // 3. Claim incident
    await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/claim`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send();

    // 4. Transition to In Progress
    const progressRes = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ status: "In Progress" });

    expect(progressRes.status).toBe(200);
    expect(progressRes.body.incident.status).toBe("In Progress");

    // 5. Complainant tracking reflects In Progress
    const compCheck = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/complaints/my`)
      .set("Authorization", `Bearer ${compRes.body.token}`);

    expect(compCheck.body.complaints[0].incident.status).toBe("In Progress");
  });

  it("prevents unassigned staff or staff not matching category pool from claiming or transitioning incidents", async () => {
    // Staff 1 assigned to Electrical ONLY
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Mani Electrical",
        email: "mani@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [electricalCategoryId],
      });

    const staff1Login = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "mani@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    const staff1Token = staff1Login.body.token;

    // Staff 2 assigned to Plumbing
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Ganesh Plumbing",
        email: "ganesh@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });

    const staff2Login = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "ganesh@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    const staff2Token = staff2Login.body.token;

    // Create Plumbing incident
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Test Complainant",
        email: "test@saveetha.ac.in",
        password: "Pass123456!",
      });

    const submitRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${compRes.body.token}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Pipe crack",
        description: "Water leaking",
      });

    const incidentId = submitRes.body.incident.id;

    // Staff 1 (Electrical) attempts to claim Plumbing incident -> 403 Forbidden
    const invalidClaim = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/claim`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send();

    expect(invalidClaim.status).toBe(403);
    expect(invalidClaim.body.message).toMatch(/not authorized for this category pool/i);

    // Staff 2 (Plumbing) claims Plumbing incident -> 200 OK
    const validClaim = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/claim`)
      .set("Authorization", `Bearer ${staff2Token}`)
      .send();
    expect(validClaim.status).toBe(200);

    // Staff 1 attempts to transition status -> 403 Forbidden (not assigned to it)
    const invalidStatus = await request(app)
      .patch(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/status`)
      .set("Authorization", `Bearer ${staff1Token}`)
      .send({ status: "In Progress" });

    expect(invalidStatus.status).toBe(403);
    expect(invalidStatus.body.message).toMatch(/only assigned staff or admin can transition status/i);
  });
});
