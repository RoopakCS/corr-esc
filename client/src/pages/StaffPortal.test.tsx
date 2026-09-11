import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { StaffPortal } from "./StaffPortal.js";
import * as api from "../services/api.js";

vi.mock("../components/NotificationCenter.js", () => ({
  NotificationCenter: () => <div data-testid="notification-center">Notifs</div>,
}));

const mockStaffMembers: api.StaffMember[] = [
  {
    id: "staff-1",
    name: "Ramesh Kumar",
    email: "ramesh@saveetha.ac.in",
    role: "Staff",
    categoryPoolIds: ["cat-plumbing"],
    categoryPools: [{ id: "cat-plumbing", name: "Plumbing" }],
    createdAt: new Date().toISOString(),
  },
  {
    id: "staff-2",
    name: "Suresh Patel",
    email: "suresh@saveetha.ac.in",
    role: "Staff",
    categoryPoolIds: ["cat-plumbing"],
    categoryPools: [{ id: "cat-plumbing", name: "Plumbing" }],
    createdAt: new Date().toISOString(),
  },
];

const mockIncidents: api.IncidentItem[] = [
  {
    id: "inc-101",
    categoryId: "cat-plumbing",
    category: {
      id: "cat-plumbing",
      name: "Plumbing",
      baseSlaHours: 12,
    },
    status: "New",
    escalationTier: 0,
    corroborationCount: 1,
    slaDeadline: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "inc-102",
    categoryId: "cat-plumbing",
    category: {
      id: "cat-plumbing",
      name: "Plumbing",
      baseSlaHours: 12,
    },
    status: "Assigned",
    escalationTier: 1,
    corroborationCount: 3,
    slaDeadline: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    assigneeId: "staff-1",
    assignee: {
      id: "staff-1",
      name: "Ramesh Kumar",
      email: "ramesh@saveetha.ac.in",
    },
    supervisorId: "sup-1",
    supervisor: {
      id: "sup-1",
      name: "Dr. Ananya Supervisor",
      email: "ananya@saveetha.ac.in",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockComplaints: api.Complaint[] = [
  {
    id: "comp-1",
    title: "Leaking Pipe in Science Wing",
    description: "Main line leak causing puddles near Room 102",
    locationContext: "Science Wing, Ground Floor",
    photoUrl: "https://example.com/leak.jpg",
    complainantId: "user-comp-1",
    categoryId: "cat-plumbing",
    categoryName: "Plumbing",
    incidentId: "inc-101",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderStaffPortal() {
  return render(
    <MemoryRouter initialEntries={["/org/saveetha-campus/staff/dashboard"]}>
      <Routes>
        <Route path="/org/:slug/staff/dashboard" element={<StaffPortal />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("StaffPortal Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("corr_esc_token", "test-staff-token");
    vi.spyOn(api, "getIncidents").mockResolvedValue(mockIncidents);
    vi.spyOn(api, "getStaff").mockResolvedValue(mockStaffMembers);
    vi.spyOn(api, "getIncidentDetails").mockResolvedValue({
      incident: mockIncidents[0],
      complaints: mockComplaints,
    });
    vi.spyOn(api, "getCorroborationSuggestions").mockResolvedValue([]);
    vi.spyOn(api, "getMergeCandidates").mockResolvedValue([]);
  });

  it("renders operational pool header, category pool metadata, and quick triage metrics", async () => {
    renderStaffPortal();

    await waitFor(() => {
      expect(screen.getByText(/Operational Incident Pool/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Plumbing/i)[0]).toBeInTheDocument();
      expect(screen.getByText(/Tier 0 Responsibility/i)).toBeInTheDocument();
    });

    // Quick triage metrics should reflect incident counts
    expect(screen.getByText(/Total Active/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Unassigned/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Pool Items/i)).toBeInTheDocument();
  });

  it("filters incidents by queue status and supervisory oversight tabs", async () => {
    renderStaffPortal();

    await waitFor(() => {
      expect(screen.getByText(/Supervisory Oversight \(1\)/i)).toBeInTheDocument();
    });

    // Click supervisory filter
    const supervisoryTab = screen.getByRole("button", { name: /Supervisory Oversight \(1\)/i });
    fireEvent.click(supervisoryTab);

    // Only escalated incident should be visible in pool
    expect(screen.getByText(/Supervisory Oversight Required \(Tier 1\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tier 0 Responsibility/i)).not.toBeInTheDocument();
  });

  it("opens split-pane slide-over drawer when clicking View Details & Complaints", async () => {
    renderStaffPortal();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /View Details & Complaints/i })[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /View Details & Complaints/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Attached Corroborating Complaints/i)).toBeInTheDocument();
      expect(screen.getByText("Leaking Pipe in Science Wing")).toBeInTheDocument();
      expect(screen.getByText(/Science Wing, Ground Floor/i)).toBeInTheDocument();
    });
  });

  it("renders dual accountability pills and supervisory reassignment on escalated incident drawer", async () => {
    vi.spyOn(api, "getIncidentDetails").mockResolvedValue({
      incident: mockIncidents[1],
      complaints: mockComplaints,
    });

    renderStaffPortal();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /View Details & Complaints/i })[1]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /View Details & Complaints/i })[1]);

    await waitFor(() => {
      expect(
        screen.getByText(/Tier 1 Escalation — Supervisory Oversight Active/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Ramesh Kumar")).toBeInTheDocument();
      expect(screen.getByText("Dr. Ananya Supervisor")).toBeInTheDocument();
      expect(screen.getByLabelText(/Reassign to Staff Member/i)).toBeInTheDocument();
    });
  });

  it("displays suggested corroborations with match percentage and handles merging", async () => {
    const candidateComplaint: api.Complaint = {
      id: "comp-2",
      title: "Second pipe burst in corridor",
      description: "Water spraying from ceiling pipe",
      locationContext: "Corridor 102",
      complainantId: "user-comp-2",
      categoryId: "cat-plumbing",
      incidentId: "inc-candidate",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(api, "getCorroborationSuggestions").mockResolvedValue([
      {
        complaint: candidateComplaint,
        similarityScore: 0.88,
        sourceIncidentId: "inc-candidate",
      },
    ]);

    const mergeSpy = vi.spyOn(api, "mergeComplaintIntoIncident").mockResolvedValue({
      incident: {
        ...mockIncidents[0],
        corroborationCount: 2,
      },
      complaints: [mockComplaints[0], candidateComplaint],
    });

    renderStaffPortal();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /View Details & Complaints/i })[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /View Details & Complaints/i })[0]);

    await waitFor(() => {
      expect(screen.getByText(/Suggested Corroborations/i)).toBeInTheDocument();
      expect(screen.getByText(/88% Match/i)).toBeInTheDocument();
      expect(screen.getByText("Second pipe burst in corridor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Merge Corroboration/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Merge Corroboration/i }));

    await waitFor(() => {
      expect(mergeSpy).toHaveBeenCalledWith("saveetha-campus", "inc-101", "comp-2");
    });
  });

  it("supports incident claiming and advancing status to In Progress and Resolved", async () => {
    const claimSpy = vi.spyOn(api, "claimIncident").mockResolvedValue({
      ...mockIncidents[0],
      status: "Assigned",
      assigneeId: "staff-1",
      assignee: { id: "staff-1", name: "Ramesh Kumar", email: "ramesh@saveetha.ac.in" },
    });

    renderStaffPortal();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /View Details & Complaints/i })[0]).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /View Details & Complaints/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Claim Incident/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Claim Incident/i }));

    await waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith("saveetha-campus", "inc-101");
    });
  });
});
