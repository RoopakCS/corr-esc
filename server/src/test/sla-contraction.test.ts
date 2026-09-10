import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { setupTestDb, clearTestDb, teardownTestDb } from "./setup.js";
import { createApp } from "../app.js";
import { Incident } from "../models/Incident.js";

const app = createApp();

describe("Ticket 06: Dynamic SLA Contraction Engine & Visual Countdown Timer", () => {
  const orgSlug = "mec-campus";
  let adminToken: string;
  let staffToken: string;
  let complainantToken: string;
  let standardCategoryId: string;
  let aggressiveCategoryId: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // 1. Register organization
    const regRes = await request(app)
      .post("/api/v1/orgs")
      .send({
        organizationName: "Madras Engineering College",
        slug: orgSlug,
        adminName: "Campus Admin",
        adminEmail: "admin@mec.edu",
        password: "AdminPassword123!",
      });
    adminToken = regRes.body.token;

    // 2. Create Standard Category: 10h base SLA, 2h floor, contraction factor 0.20
    const cat1Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Network Infrastructure",
        baseSlaHours: 10,
        floorHours: 2,
        contractionFactor: 0.2,
      });
    standardCategoryId = cat1Res.body.category.id;

    // 3. Create Aggressive Contraction Category: 4h base SLA, 2h floor, contraction factor 0.80
    const cat2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/categories`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Power Systems",
        baseSlaHours: 4,
        floorHours: 2,
        contractionFactor: 0.8,
      });
    aggressiveCategoryId = cat2Res.body.category.id;

    // 4. Provision Staff member assigned to both categories
    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/staff`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Devon Network Ops",
        email: "devon@mec.edu",
        password: "StaffPassword123!",
        categoryPoolIds: [standardCategoryId, aggressiveCategoryId],
      });

    const staffLoginRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/login`)
      .send({
        email: "devon@mec.edu",
        password: "StaffPassword123!",
      });
    staffToken = staffLoginRes.body.token;

    // 5. Register Complainant
    const compUserRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/auth/register`)
      .send({
        name: "Alice Researcher",
        email: "alice@mec.edu",
        password: "ComplainantPassword123!",
      });
    complainantToken = compUserRes.body.token;
  });

  it("calculates mathematical contraction accurately using (1 - alpha^k) and logs audit events", async () => {
    // 1. Submit primary complaint in Network Infrastructure (base 10h, floor 2h, alpha 0.20)
    const beforeSubmit = Date.now();
    const comp1Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: standardCategoryId,
        title: "Main router in CS block offline",
        description: "Network switch in Server Room 102 lost power and fiber link is down",
        locationContext: "CS Block Server Room 102",
      });

    expect(comp1Res.status).toBe(201);
    const incidentId = comp1Res.body.incident.id;
    const initialDeadlineMs = new Date(comp1Res.body.incident.slaDeadline).getTime();

    // Base SLA is 10 hours
    const tenHoursMs = 10 * 3600 * 1000;
    expect(initialDeadlineMs - beforeSubmit).toBeGreaterThanOrEqual(tenHoursMs - 2000);
    expect(initialDeadlineMs - beforeSubmit).toBeLessThanOrEqual(tenHoursMs + 2000);

    // 2. Submit second complaint (candidate)
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: standardCategoryId,
        title: "No internet in CS faculty lounge",
        description: "Wi-Fi access point down because switch is powered off in room 102",
        locationContext: "CS Block 1st Floor",
      });
    const candidate2Id = comp2Res.body.complaint.id;

    // 3. Merge complaint 2 into primary incident (corroborationCount: 1 -> 2)
    // Formula: alpha = 0.2, k = 2 => alpha^2 = 0.04 => multiplier = 0.96 (contracts by 4%)
    const merge1Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: candidate2Id });

    expect(merge1Res.status).toBe(200);
    const incidentAfterMerge1 = merge1Res.body.incident;
    expect(incidentAfterMerge1.corroborationCount).toBe(2);

    const deadline1Ms = new Date(incidentAfterMerge1.slaDeadline).getTime();
    expect(deadline1Ms).toBeLessThan(initialDeadlineMs);

    // Expected remaining time calculation:
    // currentRemainingMs ~ 10h
    // contractedRemainingMs = currentRemainingMs * (1 - 0.04) = currentRemainingMs * 0.96
    // Contracted amount should be ~ 4% of 10h = ~ 0.4h = 1,440,000 ms (24 minutes)
    const contraction1Ms = initialDeadlineMs - deadline1Ms;
    const expectedContraction1Ms = tenHoursMs * 0.04;
    expect(Math.abs(contraction1Ms - expectedContraction1Ms)).toBeLessThan(5000); // within 5 seconds tolerance

    // Verify audit log has recorded the event
    expect(incidentAfterMerge1.contractionAudit).toBeDefined();
    expect(incidentAfterMerge1.contractionAudit.length).toBeGreaterThanOrEqual(1);
    const latestAudit1 = incidentAfterMerge1.contractionAudit[incidentAfterMerge1.contractionAudit.length - 1];
    expect(latestAudit1.complaintId).toBe(candidate2Id);
    expect(latestAudit1.complaintTitle).toBe("No internet in CS faculty lounge");
    expect(latestAudit1.corroborationCount).toBe(2);
    expect(latestAudit1.contractedMs).toBeGreaterThan(0);
    expect(Math.abs(latestAudit1.contractedMs - expectedContraction1Ms)).toBeLessThan(5000);

    // 4. Submit third complaint and merge (corroborationCount: 2 -> 3)
    // Formula: alpha = 0.2, k = 3 => alpha^3 = 0.008 => multiplier = 0.992 (contracts by 0.8%)
    const comp3Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: standardCategoryId,
        title: "Lab 3 cannot reach gateway",
        description: "Complainants cannot connect to network switch down in room 102",
        locationContext: "CS Block Lab 3",
      });
    const candidate3Id = comp3Res.body.complaint.id;

    const merge2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: candidate3Id });

    expect(merge2Res.status).toBe(200);
    const incidentAfterMerge2 = merge2Res.body.incident;
    expect(incidentAfterMerge2.corroborationCount).toBe(3);

    const deadline2Ms = new Date(incidentAfterMerge2.slaDeadline).getTime();
    expect(deadline2Ms).toBeLessThan(deadline1Ms);

    // Contraction for k=3 should be smaller than for k=2 (decaying marginal contraction)
    const contraction2Ms = deadline1Ms - deadline2Ms;
    expect(contraction2Ms).toBeLessThan(contraction1Ms);

    // Verify audit log has 2 contraction events
    expect(incidentAfterMerge2.contractionAudit.length).toBeGreaterThanOrEqual(2);
    const latestAudit2 = incidentAfterMerge2.contractionAudit[incidentAfterMerge2.contractionAudit.length - 1];
    expect(latestAudit2.complaintId).toBe(candidate3Id);
    expect(latestAudit2.corroborationCount).toBe(3);
    expect(Math.abs(latestAudit2.contractedMs - contraction2Ms)).toBeLessThanOrEqual(2);
  });

  it("strictly enforces the hard safety floor (cannot contract below now + floorHours)", async () => {
    // Aggressive category: baseSlaHours: 4, floorHours: 2, contractionFactor: 0.8
    // With alpha = 0.8, at k = 2: alpha^2 = 0.64 => multiplier = 1 - 0.64 = 0.36
    // If remaining is ~4h, remaining * 0.36 = 1.44h.
    // 1.44h is less than floorHours (2h).
    // The engine must clamp the new remaining time to exactly floorHours (2h)!
    const comp1Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: aggressiveCategoryId,
        title: "Transformer sparking in substation",
        description: "Heavy sparks and smoke emitting from the main distribution transformer",
        locationContext: "Substation Yard North",
      });

    const incidentId = comp1Res.body.incident.id;

    // Submit candidate complaint
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: aggressiveCategoryId,
        title: "Power outage after transformer spark",
        description: "Entire north wing lost power after loud pop from substation transformer",
        locationContext: "North Wing Academic Block",
      });

    const candidateId = comp2Res.body.complaint.id;

    const beforeMerge = Date.now();
    const mergeRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: candidateId });

    expect(mergeRes.status).toBe(200);
    const newDeadlineMs = new Date(mergeRes.body.incident.slaDeadline).getTime();

    // Floor is 2 hours. New deadline must be at least now + 2 hours (within 2s tolerance)
    const twoHoursMs = 2 * 3600 * 1000;
    const remainingMs = newDeadlineMs - beforeMerge;
    expect(remainingMs).toBeGreaterThanOrEqual(twoHoursMs - 2000);
    expect(remainingMs).toBeLessThanOrEqual(twoHoursMs + 2000);

    // Audit log should show contraction was clamped
    const audit = mergeRes.body.incident.contractionAudit[mergeRes.body.incident.contractionAudit.length - 1];
    expect(audit.newDeadline).toBe(mergeRes.body.incident.slaDeadline);
    expect(audit.contractedMs).toBeGreaterThan(0);
  });

  it("never extends an incident deadline under any condition", async () => {
    // Create an incident and artificially set its deadline to less than floorHours
    const compRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: standardCategoryId,
        title: "Ethernet wall port broken",
        description: "Pins bent in wall jack",
        locationContext: "Room 101",
      });

    const incidentId = compRes.body.incident.id;

    // Artificially update deadline to 1 hour from now (floor is 2 hours)
    const oneHourFromNow = new Date(Date.now() + 1 * 3600 * 1000);
    await Incident.findByIdAndUpdate(incidentId, { slaDeadline: oneHourFromNow });

    // Submit candidate complaint to merge
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: standardCategoryId,
        title: "Broken RJ45 wall jack",
        description: "Ethernet jack pins damaged in room 101",
        locationContext: "Room 101",
      });

    const mergeRes = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: comp2Res.body.complaint.id });

    expect(mergeRes.status).toBe(200);
    const resultingDeadlineMs = new Date(mergeRes.body.incident.slaDeadline).getTime();

    // Resulting deadline must NOT extend to floor (2h); must stay at or below 1 hour from now
    expect(resultingDeadlineMs).toBeLessThanOrEqual(oneHourFromNow.getTime() + 1000);
  });

  it("surfaces contraction audit timeline via GET incident details endpoint", async () => {
    // 1. Submit primary complaint
    const comp1Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: standardCategoryId,
        title: "Wi-Fi dropping frequently",
        description: "Signal drops every 5 minutes across block 1",
        locationContext: "Block 1",
      });

    const incidentId = comp1Res.body.incident.id;

    // 2. Submit second complaint and merge
    const comp2Res = await request(app)
      .post(`/api/v1/orgs/${orgSlug}/complaints`)
      .set("Authorization", `Bearer ${complainantToken}`)
      .send({
        categoryId: standardCategoryId,
        title: "Intermittent wireless disconnection",
        description: "Block 1 wireless keeps disconnecting",
        locationContext: "Block 1",
      });

    await request(app)
      .post(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}/merge`)
      .set("Authorization", `Bearer ${staffToken}`)
      .send({ complaintId: comp2Res.body.complaint.id });

    // 3. Fetch incident details
    const detailsRes = await request(app)
      .get(`/api/v1/orgs/${orgSlug}/incidents/${incidentId}`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(detailsRes.status).toBe(200);
    expect(detailsRes.body.incident.contractionAudit).toBeDefined();
    expect(detailsRes.body.incident.contractionAudit.length).toBeGreaterThanOrEqual(1);

    const auditEntry = detailsRes.body.incident.contractionAudit[0];
    expect(auditEntry).toHaveProperty("complaintTitle");
    expect(auditEntry).toHaveProperty("previousDeadline");
    expect(auditEntry).toHaveProperty("newDeadline");
    expect(auditEntry).toHaveProperty("contractedMs");
    expect(auditEntry).toHaveProperty("corroborationCount");
    expect(auditEntry).toHaveProperty("createdAt");
  });
});
