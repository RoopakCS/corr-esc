import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";

const app = createApp();

describe("Category Setup & Dynamic SLA Configuration", () => {
  let adminToken: string;
  let orgSlug: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Setup an initial organization and admin
    const orgRes = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Saveetha Campus",
        slug: "saveetha-campus",
        adminName: "Campus Admin",
        adminEmail: "admin@saveetha.ac.in",
        password: "SecurePassword123!",
      });

    adminToken = orgRes.body.token;
    orgSlug = orgRes.body.organization.slug;
  });

  it("allows Admin to create a category with custom SLA and escalation tiers", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Electrical",
        baseSlaHours: 24,
        floorHours: 2,
        contractionFactor: 0.2,
        tierTargets: [
          { tier: 1, supervisorRole: "Supervisor" },
          { tier: 2, supervisorRole: "Director" },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.category).toMatchObject({
      name: "Electrical",
      baseSlaHours: 24,
      floorHours: 2,
      contractionFactor: 0.2,
      tierTargets: [
        { tier: 1, supervisorRole: "Supervisor" },
        { tier: 2, supervisorRole: "Director" },
      ],
    });
    expect(res.body.category).toHaveProperty("id");
  });

  it("safely handles special regex characters in category names without error", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "HVAC (Block-A / 2nd Floor)",
        baseSlaHours: 12,
        floorHours: 1,
        contractionFactor: 0.15,
      });

    expect(res.status).toBe(201);
    expect(res.body.category.name).toBe("HVAC (Block-A / 2nd Floor)");
  });

  it("lists all categories for the organization when authenticated", async () => {
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Plumbing",
        baseSlaHours: 12,
        floorHours: 1,
        contractionFactor: 0.25,
      });

    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Network & Wi-Fi",
        baseSlaHours: 8,
        floorHours: 0.5,
        contractionFactor: 0.3,
      });

    const res = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(2);
    expect(res.body.categories.map((c: any) => c.name)).toContain("Plumbing");
    expect(res.body.categories.map((c: any) => c.name)).toContain("Network & Wi-Fi");
  });

  it("denies unauthenticated access to category listing", async () => {
    const res = await request(app).get(`/api/v1/orgs/${orgSlug}/categories`);
    expect(res.status).toBe(401);
  });

  it("rejects invalid SLA parameter ranges (floorHours >= baseSlaHours)", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Invalid Category",
        baseSlaHours: 10,
        floorHours: 12, // Invalid: floor cannot exceed base SLA
        contractionFactor: 0.2,
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/floor.*less than.*base/i);
  });

  it("rejects invalid contraction factor (< 0 or >= 1)", async () => {
    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Invalid Factor",
        baseSlaHours: 24,
        floorHours: 2,
        contractionFactor: 1.5, // Invalid: must be between 0 and 1
      });

    expect(res.status).toBe(400);
  });

  it("rejects duplicate category names within the same organization", async () => {
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Carpentry",
        baseSlaHours: 48,
        floorHours: 6,
        contractionFactor: 0.15,
      });

    const res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Carpentry",
        baseSlaHours: 36,
        floorHours: 4,
        contractionFactor: 0.2,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/category.*already exists/i);
  });

  it("allows Admin to update an existing category's SLA configuration", async () => {
    const createRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "HVAC / Air Conditioning",
        baseSlaHours: 24,
        floorHours: 3,
        contractionFactor: 0.2,
      });

    const categoryId = createRes.body.category.id;

    const updateRes = await request(app)
      .put(`/api/v1/orgs/${orgSlug}/categories/${categoryId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "HVAC / Air Conditioning",
        baseSlaHours: 18,
        floorHours: 2,
        contractionFactor: 0.25,
        tierTargets: [{ tier: 1, supervisorRole: "Estate Supervisor" }],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.category).toMatchObject({
      name: "HVAC / Air Conditioning",
      baseSlaHours: 18,
      floorHours: 2,
      contractionFactor: 0.25,
      tierTargets: [{ tier: 1, supervisorRole: "Estate Supervisor" }],
    });
  });

  it("prevents non-admin users from creating or modifying categories", async () => {
    // Register another user without Admin role or unauthenticated
    const resUnauth = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .send({
        name: "Unauthorized Category",
        baseSlaHours: 24,
        floorHours: 2,
        contractionFactor: 0.2,
      });

    expect(resUnauth.status).toBe(401);

    // Register a second org
    const otherOrgRes = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Other Organization",
        slug: "other-org",
        adminName: "Other Admin",
        adminEmail: "other@org.com",
        password: "password123",
      });

    const otherToken = otherOrgRes.body.token;

    // Admin from other org cannot modify categories in saveetha-campus
    const crossRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({
        name: "Cross Org Category",
        baseSlaHours: 24,
        floorHours: 2,
        contractionFactor: 0.2,
      });

    expect(crossRes.status).toBe(403);
  });
});
