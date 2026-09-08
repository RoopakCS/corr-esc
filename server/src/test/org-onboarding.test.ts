import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";

const app = createApp();

describe("Ticket 01: Project Foundation & Organization Onboarding", () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("registers a new organization with initial admin account and returns auth token", async () => {
    const res = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Saveetha Campus",
        slug: "saveetha-campus",
        adminName: "Campus Admin",
        adminEmail: "admin@saveetha.ac.in",
        password: "SecurePassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    expect(res.body.organization).toMatchObject({
      name: "Saveetha Campus",
      slug: "saveetha-campus",
    });
    expect(res.body.admin).toMatchObject({
      name: "Campus Admin",
      email: "admin@saveetha.ac.in",
      role: "Admin",
    });
    expect(res.body.admin).not.toHaveProperty("passwordHash");
  });

  it("rejects registration when organization slug already exists", async () => {
    await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "First Org",
        slug: "duplicate-slug",
        adminName: "Admin One",
        adminEmail: "admin1@org.com",
        password: "password123",
      });

    const res = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Second Org",
        slug: "duplicate-slug",
        adminName: "Admin Two",
        adminEmail: "admin2@org.com",
        password: "password123",
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/slug already in use/i);
  });

  it("authenticates admin via login endpoint and returns valid JWT scoped to organization", async () => {
    await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Alpha Org",
        slug: "alpha-org",
        adminName: "Alpha Admin",
        adminEmail: "admin@alpha.com",
        password: "AlphaSecretPassword!",
      });

    const loginRes = await request(app)
      .post("/api/v1/orgs/alpha-org/auth/login")
      .send({
        email: "admin@alpha.com",
        password: "AlphaSecretPassword!",
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("token");
    expect(loginRes.body.user).toMatchObject({
      name: "Alpha Admin",
      email: "admin@alpha.com",
      role: "Admin",
    });

    const badLoginRes = await request(app)
      .post("/api/v1/orgs/alpha-org/auth/login")
      .send({
        email: "admin@alpha.com",
        password: "WrongPassword!",
      });

    expect(badLoginRes.status).toBe(401);
  });

  it("allows authenticated admin to access their organization dashboard", async () => {
    const regRes = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Beta Organization",
        slug: "beta-org",
        adminName: "Beta Admin",
        adminEmail: "admin@beta.com",
        password: "BetaPassword123!",
      });

    const token = regRes.body.token;

    const dashRes = await request(app)
      .get("/api/v1/orgs/beta-org/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.organization).toMatchObject({
      name: "Beta Organization",
      slug: "beta-org",
    });
  });

  it("denies unauthenticated access to admin dashboard", async () => {
    const res = await request(app).get("/api/v1/orgs/any-org/admin/dashboard");
    expect(res.status).toBe(401);
  });

  it("denies access when user token belongs to a different organization (cross-organization isolation)", async () => {
    // Org A
    const orgARes = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Org A",
        slug: "org-a",
        adminName: "Admin A",
        adminEmail: "admin@orga.com",
        password: "passwordA123",
      });

    // Org B
    await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Org B",
        slug: "org-b",
        adminName: "Admin B",
        adminEmail: "admin@orgb.com",
        password: "passwordB123",
      });

    const tokenA = orgARes.body.token;

    // Admin A tries to access Org B's dashboard
    const crossRes = await request(app)
      .get("/api/v1/orgs/org-b/admin/dashboard")
      .set("Authorization", `Bearer ${tokenA}`);

    expect(crossRes.status).toBe(403);
    expect(crossRes.body.message).toMatch(/cross-organization access forbidden/i);
  });
});
