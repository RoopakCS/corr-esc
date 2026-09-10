import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";

const app = createApp();

describe("Complaint Ingestion & Blind Ingestion Workflow", () => {
  let orgSlug: string;
  let adminToken: string;
  let categoryId: string;
  let complainantToken: string;
  let complainantId: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Setup Organization & Admin
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Saveetha Campus",
        slug: "saveetha-campus",
        adminName: "Campus Admin",
        adminEmail: "admin@saveetha.ac.in",
        password: "SecurePassword123!",
      });

    orgSlug = orgRes.body.organization.slug;
    adminToken = orgRes.body.token;

    // 2. Setup a Category with 24h base SLA, 2h floor, 0.2 decay
    const catRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Plumbing",
        baseSlaHours: 24,
        floorHours: 2,
        contractionFactor: 0.2,
      });

    categoryId = catRes.body.category.id;

    // 3. Register a Complainant under the organization
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "John Complainant",
        email: "john@saveetha.ac.in",
        password: "ComplainantPassword123!",
      });

    complainantToken = compRes.body.token;
    complainantId = compRes.body.user.id;
  });

  it("allows complainant to self-register under an organization slug", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Alice Complainant",
        email: "alice@saveetha.ac.in",
        password: "AlicePassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.user).toMatchObject({
      name: "Alice Complainant",
      email: "alice@saveetha.ac.in",
      role: "Complainant",
    });
  });

  it("rejects duplicate complainant registration with same email in same organization", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Duplicate John",
        email: "john@saveetha.ac.in",
        password: "AnotherPassword123!",
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/email.*already registered/i);
  });

  it("submits a complaint, automatically creates an operational incident, and assigns initial SLA deadline", async () => {
    const beforeTime = Date.now();

    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Water leakage in washroom",
        description: "The second floor washroom sink is constantly leaking and flooding the floor.",
        locationContext: "Block B, 2nd floor, common washroom near stairs",
        photoUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("complaint");
    expect(res.body).toHaveProperty("incident");

    // Verify complaint structure
    expect(res.body.complaint).toMatchObject({
      title: "Water leakage in washroom",
      description: "The second floor washroom sink is constantly leaking and flooding the floor.",
      locationContext: "Block B, 2nd floor, common washroom near stairs",
      photoUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      complainantId,
    });

    // Verify automatically provisioned incident
    expect(res.body.incident).toMatchObject({
      status: "New",
      corroborationCount: 1,
      escalationTier: 0,
      categoryId,
    });

    // Verify initial SLA deadline is approx now + 24 hours (86,400,000 ms)
    const deadlineTime = new Date(res.body.incident.slaDeadline).getTime();
    const expectedDeadline = beforeTime + 24 * 3600 * 1000;
    // Within 5 seconds tolerance
    expect(Math.abs(deadlineTime - expectedDeadline)).toBeLessThan(5000);
  });

  it("lists personal complaints for authenticated complainant with linked incident status", async () => {
    // Submit 2 complaints
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Leaking tap 1",
        description: "First tap is leaking",
      });

    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Leaking tap 2",
        description: "Second tap is leaking",
      });

    const res = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/complaints/my`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(res.status).toBe(200);
    expect(res.body.complaints).toHaveLength(2);
    expect(res.body.complaints[0]).toHaveProperty("incident");
    expect(res.body.complaints[0].incident.status).toBe("New");
  });

  it("enforces blind submission: complainant cannot view another complainant's complaint", async () => {
    // Complainant 1 submits complaint
    const submitRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId,
        title: "Private room socket broken",
        description: "Room 101 plug point sparking",
      });

    const complaintId = submitRes.body.complaint.id;

    // Register Complainant 2
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Bob Complainant",
        email: "bob@saveetha.ac.in",
        password: "BobPassword123!",
      });

    const comp2Token = comp2Res.body.token;

    // Complainant 2 attempts to fetch Complainant 1's complaint directly
    const viewRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${comp2Token}`);

    expect(viewRes.status).toBe(403);
    expect(viewRes.body.message).toMatch(/not authorized to view this complaint/i);

    // Complainant 1 CAN view their own complaint
    const ownerRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/complaints/${complaintId}`)
      .set("Authorization", `Bearer ${complainantToken}`);

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.complaint.id).toBe(complaintId);
  });

  it("denies unauthenticated complaint submission", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .send({
        categoryId,
        title: "Unauthorized complaint",
        description: "Should fail with 401",
      });

    expect(res.status).toBe(401);
  });
});
