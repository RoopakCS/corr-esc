import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App.js";

describe("Frontend Client App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("renders organization registration page on default root route", () => {
    render(<App />);
    expect(screen.getByText(/CORR-ESC/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/e\.g\. Saveetha Campus/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Organization/i })
    ).toBeInTheDocument();
  });

  it("submits organization registration and displays admin dashboard with category management", async () => {
    const mockOrgResponse = {
      organization: {
        id: "org-123",
        name: "Saveetha Campus",
        slug: "saveetha-campus",
        createdAt: new Date().toISOString(),
      },
      admin: {
        id: "admin-123",
        name: "Campus Admin",
        email: "admin@saveetha.ac.in",
        role: "Admin",
      },
      token: "mock-jwt-token",
    };

    const mockDashboardResponse = {
      organization: mockOrgResponse.organization,
      admin: {
        id: "admin-123",
        name: "Campus Admin",
        email: "admin@saveetha.ac.in",
        role: "Admin" as const,
      },
    };

    const mockCategoriesResponse = {
      categories: [
        {
          id: "cat-1",
          name: "Electrical",
          baseSlaHours: 24,
          floorHours: 2,
          contractionFactor: 0.2,
          tierTargets: [{ tier: 1, targetRole: "Supervisor" }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    vi.spyOn(global, "fetch").mockImplementation((url) => {
      const urlStr = url.toString();
      if (urlStr.endsWith("/api/v1/orgs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOrgResponse),
        } as Response);
      }
      if (urlStr.includes("/admin/dashboard")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDashboardResponse),
        } as Response);
      }
      if (urlStr.includes("/categories")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCategoriesResponse),
        } as Response);
      }
      return Promise.reject(new Error(`Unhandled URL: ${urlStr}`));
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Saveetha Campus/i), {
      target: { value: "Saveetha Campus" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Dr\. Hemavathy/i), {
      target: { value: "Campus Admin" },
    });
    fireEvent.change(screen.getByPlaceholderText(/admin@organization\.com/i), {
      target: { value: "admin@saveetha.ac.in" },
    });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: "SecurePass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Create Organization/i }));

    await waitFor(() => {
      expect(screen.getByText(/Welcome back, Campus Admin/i)).toBeInTheDocument();
      expect(screen.getByText(/Organization Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Electrical/i)).toBeInTheDocument();
      expect(screen.getByText(/Base SLA/i)).toBeInTheDocument();
      expect(screen.getByText("24h")).toBeInTheDocument();
    });
  });

  it("registers a complainant and allows blind complaint submission with incident SLA display", async () => {
    // Navigate directly to complainant registration
    window.history.pushState({}, "Register Complainant", "/org/saveetha-campus/register");

    const mockRegisterResponse = {
      token: "mock-complainant-token",
      user: {
        id: "user-comp-1",
        name: "Priya Complainant",
        email: "priya@saveetha.ac.in",
        role: "Complainant",
        organizationId: "org-123",
      },
    };

    const mockCategoriesResponse = {
      categories: [
        {
          id: "cat-plumbing",
          name: "Plumbing",
          baseSlaHours: 12,
          floorHours: 2,
          contractionFactor: 0.15,
          tierTargets: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    let complaintsList: any[] = [];

    const mockIncident = {
      id: "inc-100",
      status: "New",
      escalationTier: 0,
      corroborationCount: 1,
      slaDeadline: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
    };

    vi.spyOn(global, "fetch").mockImplementation((url, options) => {
      const urlStr = url.toString();
      const method = (options as any)?.method || "GET";

      if (urlStr.includes("/auth/register") && method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockRegisterResponse),
        } as Response);
      }

      if (urlStr.includes("/categories")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCategoriesResponse),
        } as Response);
      }

      if (urlStr.includes("/complaints/my")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ complaints: complaintsList }),
        } as Response);
      }

      if (urlStr.endsWith("/complaints") && method === "POST") {
        const body = JSON.parse((options as any).body);
        const createdComplaint = {
          id: "comp-1",
          title: body.title,
          description: body.description,
          locationContext: body.locationContext || "",
          photoUrl: body.photoUrl,
          complainantId: "user-comp-1",
          categoryId: body.categoryId,
          categoryName: "Plumbing",
          incidentId: mockIncident.id,
          incident: mockIncident,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        complaintsList = [createdComplaint];

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              complaint: createdComplaint,
              incident: mockIncident,
            }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr} ${method}`));
    });

    render(<App />);

    expect(screen.getByText(/Complainant Registration/i)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. John Doe/i), {
      target: { value: "Priya Complainant" },
    });
    fireEvent.change(screen.getByPlaceholderText(/you@domain\.com/i), {
      target: { value: "priya@saveetha.ac.in" },
    });
    const passwordInputs = screen.getAllByPlaceholderText(/••••••••/i);
    fireEvent.change(passwordInputs[0], {
      target: { value: "SecurePass123!" },
    });
    fireEvent.change(passwordInputs[1], {
      target: { value: "SecurePass123!" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Create Complainant Account/i })
    );

    // Wait for portal to load
    await waitFor(() => {
      expect(screen.getByText(/Complainant Portal/i)).toBeInTheDocument();
      expect(screen.getByText(/No complaints filed yet/i)).toBeInTheDocument();
    });

    // Fill and submit complaint
    fireEvent.change(screen.getByPlaceholderText(/Brief summary of the complaint/i), {
      target: { value: "Broken tap in Restroom 3F" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/e\.g\. Block C, 3rd Floor, Room 304/i),
      {
        target: { value: "Academic Block B, 3rd Floor" },
      }
    );
    fireEvent.change(
      screen.getByPlaceholderText(
        /Provide full details regarding what happened and needs attention\.\.\./i
      ),
      {
        target: {
          value: "The water tap is leaking continuously since morning causing overflow.",
        },
      }
    );

    fireEvent.click(screen.getByRole("button", { name: /Submit Complaint/i }));

    // Verify complaint card appears with Incident and SLA metadata
    await waitFor(() => {
      expect(screen.getByText("Broken tap in Restroom 3F")).toBeInTheDocument();
      expect(screen.getByText(/Academic Block B, 3rd Floor/i)).toBeInTheDocument();
      expect(screen.getByText("New")).toBeInTheDocument();
      expect(screen.getByText("Tier 0")).toBeInTheDocument();
      expect(screen.getByText(/Corroboration count:/i)).toBeInTheDocument();
      expect(screen.getByText(/SLA Deadline:/i)).toBeInTheDocument();
    });
  });
});

