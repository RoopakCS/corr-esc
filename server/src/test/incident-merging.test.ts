import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";
import { Incident } from "../models/Incident.js";
import { Complaint } from "../models/Complaint.js";

const app = createApp();

describe("Ticket 05: Token Similarity Suggestions & Manual Incident Merging", () => {
  const orgSlug = "saveetha-engineering";
  let adminToken: string;
  let staffToken: string;
  let otherStaffToken: string;
  let complainantToken: string;
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

    // 2. Create Plumbing Category (12h base SLA, floor 2h, contraction factor 0.25)
    const plumbCatRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Plumbing",
        baseSlaHours: 12,
        floorHours: 2,
        contractionFactor: 0.25,
      });
    plumbingCategoryId = plumbCatRes.body.category.id;

    // 3. Create Electrical Category (24h base SLA, floor 4h, contraction factor 0.20)
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

    // 4. Provision Staff assigned to Plumbing pool
    const staffRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Ramesh Staff",
        email: "ramesh@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [plumbingCategoryId],
      });
    const staffLogin = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "ramesh@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    staffToken = staffLogin.body.token;

    // 5. Provision Staff assigned only to Electrical pool
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Karthik Electrician",
        email: "karthik@saveetha.ac.in",
        password: "StaffPassword123!",
        categoryPoolIds: [electricalCategoryId],
      });
    const otherStaffLogin = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "karthik@saveetha.ac.in",
        password: "StaffPassword123!",
      });
    otherStaffToken = otherStaffLogin.body.token;

    // 6. Register a Complainant
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Complainant Ananya",
        email: "ananya@saveetha.ac.in",
        password: "Pass123456!",
      });
    complainantToken = compRes.body.token;
  });

  it("computes token similarity and returns suggested corroborations for an incident", async () => {
    // Submit primary complaint 1 in Plumbing
    const comp1Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Severe pipe burst and water leaking",
        description: "Large pipe burst in 2nd floor restroom causing severe flooding",
        locationContext: "Engineering Block 2, Restroom 204",
      });
    const primaryIncidentId = comp1Res.body.incident.id;

    // Submit complaint 2 with high lexical overlap in Plumbing (same problem reported independently)
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Flooding from pipe burst",
        description: "Restroom 204 has water leaking and pipe burst on second floor",
        locationContext: "Block 2 2nd floor restroom",
      });
    const candidateComplaintId = comp2Res.body.complaint.id;

    // Submit complaint 3 in Plumbing with completely different tokens (low overlap)
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Clogged drainage sink",
        description: "Kitchen cafeteria sink basin does not drain water",
        locationContext: "Main Canteen Ground Floor",
      });

    // Submit complaint 4 in Electrical category (should NOT be suggested even with similar words)
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: electricalCategoryId,
        title: "Power socket sparking near water",
        description: "Electrical switchboard sparking near water leak area",
        locationContext: "Block 2 Restroom 204",
      });

    // Fetch suggested corroborations as assigned staff
    const suggestionsRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents/${primaryIncidentId}/corroboration-suggestions`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(suggestionsRes.status).toBe(200);
    expect(suggestionsRes.body.suggestions).toBeDefined();
    // High similarity complaint 2 should be suggested
    expect(suggestionsRes.body.suggestions.length).toBeGreaterThanOrEqual(1);
    const topSuggestion = suggestionsRes.body.suggestions[0];
    expect(topSuggestion.complaint.id).toBe(candidateComplaintId);
    expect(topSuggestion.similarityScore).toBeGreaterThanOrEqual(0.2);
    expect(topSuggestion.sourceIncidentId).toBe(comp2Res.body.incident.id);
  });

  it("merges a suggested complaint into parent incident, updating corroborationCount and contracting SLA deadline", async () => {
    // 1. Submit primary complaint
    const comp1Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Water pipe leakage in lab",
        description: "Water dripping from overhead ceiling pipe in mechanical lab",
        locationContext: "Tech Park Lab 102",
      });
    const parentIncidentId = comp1Res.body.incident.id;
    const initialDeadline = new Date(comp1Res.body.incident.slaDeadline).getTime();

    // 2. Submit second complaint (provisional incident created)
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Ceiling pipe leaking water",
        description: "Constant dripping from overhead pipe onto tables in lab 102",
        locationContext: "Tech Park Lab 102",
      });
    const candidateComplaintId = comp2Res.body.complaint.id;
    const candidateIncidentId = comp2Res.body.incident.id;

    // 3. Staff merges complaint 2 into parent incident
    const mergeRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${parentIncidentId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: candidateComplaintId });

    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.incident.id).toBe(parentIncidentId);
    expect(mergeRes.body.incident.corroborationCount).toBe(2);

    // Verify SLA deadline contracted
    const contractedDeadline = new Date(mergeRes.body.incident.slaDeadline).getTime();
    expect(contractedDeadline).toBeLessThan(initialDeadline);

    // Verify complaint now points to parent incident
    const updatedComp = await Complaint.findById(candidateComplaintId);
    expect(updatedComp?.incidentId.toString()).toBe(parentIncidentId);

    // Verify redundant provisional incident was removed/archived
    const oldIncident = await Incident.findById(candidateIncidentId);
    expect(oldIncident).toBeNull();

    // Verify incident details show 2 attached complaints
    const detailRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents/${parentIncidentId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.complaints).toHaveLength(2);
  });

  it("allows staff to manually search and merge arbitrary open complaints in the same category", async () => {
    // 1. Submit primary complaint
    const comp1 = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Valve leak in south wing",
        description: "Valve is loose",
        locationContext: "South Wing",
      });
    const parentIncidentId = comp1.body.incident.id;

    // 2. Submit second complaint with different phrasing
    const comp2 = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Water tap broken",
        description: "Tap cannot be shut off completely",
        locationContext: "South Wing 1st floor",
      });
    const secondComplaintId = comp2.body.complaint.id;

    // 3. Search merge candidates with query "tap"
    const searchRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents/${parentIncidentId}/merge-candidates?search=tap`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.candidates).toBeDefined();
    expect(searchRes.body.candidates.some((c: any) => c.id === secondComplaintId)).toBe(true);

    // 4. Manually merge the found candidate
    const manualMergeRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${parentIncidentId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: secondComplaintId });

    expect(manualMergeRes.status).toBe(200);
    expect(manualMergeRes.body.incident.corroborationCount).toBe(2);
  });

  it("prevents unauthorized staff or cross-organization merges", async () => {
    // Create plumbing complaint & incident
    const comp1 = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Main pipeline rupture",
        description: "Pipeline rupture flooding basement",
      });
    const parentIncidentId = comp1.body.incident.id;

    const comp2 = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: plumbingCategoryId,
        title: "Basement water flood",
        description: "Water rising in basement",
      });
    const candidateComplaintId = comp2.body.complaint.id;

    // Electrical staff (otherStaffToken) attempts to merge Plumbing incident -> 403
    const forbiddenMerge = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${parentIncidentId}/merge`)
      .set("Authorization", `Bearer ${otherStaffToken}`)
      .send({ complaintId: candidateComplaintId });

    expect(forbiddenMerge.status).toBe(403);
    expect(forbiddenMerge.body.message).toMatch(/not authorized for this category pool/i);
  });
});
