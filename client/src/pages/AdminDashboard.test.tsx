import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AdminDashboard } from "./AdminDashboard.js";
import * as api from "../services/api.js";

vi.mock("../components/NotificationCenter.js", () => ({
  NotificationCenter: () => <div data-testid="notification-center">Notifs</div>,
}));

const mockDashboardResponse: api.DashboardResponse = {
  organization: {
    id: "org-123",
    name: "Saveetha Engineering College",
    slug: "saveetha-campus",
    createdAt: new Date().toISOString(),
  },
  admin: {
    id: "admin-123",
    name: "Dr. Hemavathy Admin",
    email: "admin@saveetha.ac.in",
    role: "Admin",
  },
};

const mockCategories: api.Category[] = [
  {
    id: "cat-1",
    name: "Electrical Power",
    baseSlaHours: 24,
    floorHours: 4,
    contractionFactor: 0.2,
    tierTargets: [
      { tier: 1, targetRole: "Electrical Supervisor", slaHours: 8 },
      { tier: 2, targetRole: "Campus Facilities Director", slaHours: 4 },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "cat-2",
    name: "Plumbing Systems",
    baseSlaHours: 12,
    floorHours: 2,
    contractionFactor: 0.15,
    tierTargets: [{ tier: 1, targetRole: "Sanitary Supervisor", slaHours: 4 }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockStaffList: api.StaffMember[] = [
  {
    id: "staff-1",
    name: "Ramesh Kumar",
    email: "ramesh@saveetha.ac.in",
    role: "Staff",
    categoryPoolIds: ["cat-1", "cat-2"],
    categoryPools: [
      { id: "cat-1", name: "Electrical Power" },
      { id: "cat-2", name: "Plumbing Systems" },
    ],
    createdAt: new Date().toISOString(),
  },
];

const mockEscalatedIncidents: api.IncidentItem[] = [
  {
    id: "inc-esc-1",
    categoryId: "cat-1",
    category: {
      id: "cat-1",
      name: "Electrical Power",
      baseSlaHours: 24,
    },
    status: "Assigned",
    escalationTier: 1,
    corroborationCount: 2,
    slaDeadline: new Date(Date.now() - 3600 * 1000).toISOString(),
    assigneeId: "staff-1",
    assignee: {
      id: "staff-1",
      name: "Ramesh Kumar",
      email: "ramesh@saveetha.ac.in",
    },
    supervisorId: "sup-1",
    supervisor: {
      id: "sup-1",
      name: "Dr. Suresh Supervisor",
      email: "suresh@saveetha.ac.in",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderAdminDashboard() {
  return render(
    <MemoryRouter initialEntries={["/org/saveetha-campus/admin/dashboard"]}>
      <Routes>
        <Route path="/org/:slug/admin/dashboard" element={<AdminDashboard />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminDashboard Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("corr_esc_token", "test-admin-token");
    vi.spyOn(api, "getAdminDashboard").mockResolvedValue(mockDashboardResponse);
    vi.spyOn(api, "getCategories").mockResolvedValue(mockCategories);
    vi.spyOn(api, "getStaff").mockResolvedValue(mockStaffList);
    vi.spyOn(api, "getIncidents").mockResolvedValue(mockEscalatedIncidents);
  });

  it("renders executive overview with organization profile, health metrics, and category SLA table", async () => {
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Dr. Hemavathy Admin/i)).toBeInTheDocument();
      expect(screen.getByText(/Organization Active/i)).toBeInTheDocument();
      expect(screen.getAllByText("Saveetha Engineering College").length).toBeGreaterThan(0);
      expect(screen.getByText(/Electrical Power/i)).toBeInTheDocument();
      expect(screen.getByText(/Plumbing Systems/i)).toBeInTheDocument();
    });

    // Check Base SLA formatting
    expect(screen.getAllByText(/Base SLA/i).length).toBeGreaterThan(0);
    expect(screen.getByText("24h")).toBeInTheDocument();
    expect(screen.getByText("12h")).toBeInTheDocument();
  });

  it("allows switching between Categories, Staff & Category Pools, and Supervisory Escalations tabs", async () => {
    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Problem Categories \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Staff & Category Pools \(1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Supervisory Escalations \(1\)/i)).toBeInTheDocument();
    });

    // Switch to Staff tab
    fireEvent.click(screen.getByText(/Staff & Category Pools \(1\)/i));
    expect(screen.getByText("Ramesh Kumar")).toBeInTheDocument();
    expect(screen.getByText("ramesh@saveetha.ac.in")).toBeInTheDocument();

    // Switch to Escalations tab
    fireEvent.click(screen.getByText(/Supervisory Escalations \(1\)/i));
    expect(screen.getByText(/Tier 1 Escalation/i)).toBeInTheDocument();
    expect(screen.getByText("Dr. Suresh Supervisor")).toBeInTheDocument();
  });

  it("opens category modal with validation bounds and tier target builder", async () => {
    const createCatSpy = vi.spyOn(api, "createCategory").mockResolvedValue({
      id: "cat-3",
      name: "Network & IT",
      baseSlaHours: 8,
      floorHours: 1,
      contractionFactor: 0.25,
      tierTargets: [{ tier: 1, targetRole: "IT Supervisor", slaHours: 2 }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add Category/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Category/i }));

    expect(screen.getByText("Add Problem Category")).toBeInTheDocument();
    expect(screen.getByLabelText(/Category Name/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Category Name/i), {
      target: { value: "Network & IT" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save Category/i }));

    await waitFor(() => {
      expect(createCatSpy).toHaveBeenCalled();
    });
  });

  it("opens staff provisioning modal and handles adding new staff member to category pools", async () => {
    const createStaffSpy = vi.spyOn(api, "createStaff").mockResolvedValue({
      id: "staff-2",
      name: "Suresh Staff",
      email: "suresh@saveetha.ac.in",
      role: "Staff",
      categoryPoolIds: ["cat-1"],
      categoryPools: [{ id: "cat-1", name: "Electrical Power" }],
      createdAt: new Date().toISOString(),
    });

    renderAdminDashboard();

    await waitFor(() => {
      expect(screen.getByText(/Staff & Category Pools \(1\)/i)).toBeInTheDocument();
    });

    // Switch to staff tab
    fireEvent.click(screen.getByText(/Staff & Category Pools \(1\)/i));

    fireEvent.click(screen.getByRole("button", { name: /Provision Staff/i }));

    expect(screen.getByText("Provision Staff Member")).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Full Name/i), {
      target: { value: "Suresh Staff" },
    });
    fireEvent.change(screen.getByLabelText(/Email Address/i), {
      target: { value: "suresh@saveetha.ac.in" },
    });
    fireEvent.change(screen.getByLabelText(/Initial Password/i), {
      target: { value: "StaffPass123!" },
    });

    const submitButtons = screen.getAllByRole("button", { name: /Provision Staff/i });
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(createStaffSpy).toHaveBeenCalled();
    });
  });
});
