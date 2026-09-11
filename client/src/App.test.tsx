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
      if (urlStr.includes("/staff")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ staff: [] }),
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

  it("allows staff to view assigned category pool, inspect complaints, claim incident, and transition to In Progress", async () => {
    localStorage.setItem("corr_esc_token", "mock-staff-token");
    window.history.pushState({}, "Staff Dashboard", "/org/saveetha-campus/staff/dashboard");

    let currentIncident: any = {
      id: "inc-999",
      categoryId: "cat-plumbing",
      category: {
        id: "cat-plumbing",
        name: "Plumbing",
        baseSlaHours: 12,
      },
      status: "New",
      escalationTier: 0,
      corroborationCount: 2,
      slaDeadline: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mockComplaints: any[] = [
      {
        id: "comp-1",
        title: "Main pipe leak",
        description: "Water leaking heavily in hallway",
        locationContext: "Academic Block A, 1st Floor",
        photoUrl: "https://example.com/leak.png",
        categoryId: "cat-plumbing",
        incidentId: "inc-999",
        createdAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(global, "fetch").mockImplementation((url, options) => {
      const urlStr = url.toString();
      const method = (options as any)?.method || "GET";

      if (urlStr.endsWith("/incidents") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incidents: [currentIncident] }),
        } as Response);
      }

      if (urlStr.endsWith("/incidents/inc-999") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              incident: currentIncident,
              complaints: mockComplaints,
            }),
        } as Response);
      }

      if (urlStr.includes("/incidents/inc-999/claim") && method === "PATCH") {
        currentIncident = {
          ...currentIncident,
          status: "Assigned",
          assignee: { id: "staff-1", name: "Ramesh Kumar", email: "ramesh@saveetha.ac.in" },
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incident: currentIncident }),
        } as Response);
      }

      if (urlStr.includes("/incidents/inc-999/status") && method === "PATCH") {
        currentIncident = {
          ...currentIncident,
          status: "In Progress",
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incident: currentIncident }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr} ${method}`));
    });

    render(<App />);

    // Check staff portal loaded
    await waitFor(() => {
      expect(screen.getByText(/Operational Incident Pool/i)).toBeInTheDocument();
      expect(screen.getByText(/Plumbing/i)).toBeInTheDocument();
      expect(screen.getByText(/Tier 0 Responsibility/i)).toBeInTheDocument();
    });

    // Click "View Details & Complaints"
    fireEvent.click(screen.getByRole("button", { name: /View Details & Complaints/i }));

    // Modal opens with complaint details
    await waitFor(() => {
      expect(screen.getByText(/Attached Corroborating Complaints/i)).toBeInTheDocument();
      expect(screen.getByText("Main pipe leak")).toBeInTheDocument();
      expect(screen.getByText(/Academic Block A, 1st Floor/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Claim Incident/i })).toBeInTheDocument();
    });

    // Claim the incident
    fireEvent.click(screen.getByRole("button", { name: /Claim Incident/i }));

    // Status transitions to Assigned, then button becomes "Start Work (In Progress)"
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Work \(In Progress\)/i })).toBeInTheDocument();
    });

    // Start work
    fireEvent.click(screen.getByRole("button", { name: /Start Work \(In Progress\)/i }));

    // Status transitions to In Progress
    await waitFor(() => {
      expect(screen.getByText(/Work Currently In Progress/i)).toBeInTheDocument();
    });
  });

  it("allows staff to view suggested corroborations and merge a candidate complaint into the incident", async () => {
    localStorage.setItem("corr_esc_token", "mock-staff-jwt");
    localStorage.setItem("user_role", "Staff");
    localStorage.setItem("user_id", "staff-1");
    window.history.pushState({}, "Staff Dashboard", "/org/saveetha-campus/staff/dashboard");

    let currentIncident = {
      id: "inc-999",
      categoryId: "cat-plumb",
      category: { id: "cat-plumb", name: "Plumbing", baseSlaHours: 12 },
      status: "Assigned" as const,
      escalationTier: 0,
      corroborationCount: 1,
      slaDeadline: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      assigneeId: "staff-1",
      assignee: { id: "staff-1", name: "Ramesh Kumar", email: "ramesh@saveetha.ac.in" },
    };

    const comp1 = {
      id: "comp-1",
      title: "Main pipe leak",
      description: "Severe pipe leakage in washroom",
      locationContext: "Academic Block A, 1st Floor",
      createdAt: new Date().toISOString(),
      incidentId: "inc-999",
      categoryId: "cat-plumb",
    };

    const comp2 = {
      id: "comp-2",
      title: "Water leaking heavily from ceiling",
      description: "Continuous water dripping in washroom 101",
      locationContext: "Academic Block A, 1st Floor",
      photoUrl: "https://example.com/leak2.jpg",
      createdAt: new Date().toISOString(),
      incidentId: "inc-1000",
      categoryId: "cat-plumb",
    };

    let attached = [comp1];

    vi.spyOn(global, "fetch").mockImplementation((url, options) => {
      const urlStr = url.toString();
      const method = (options as any)?.method || "GET";

      if (urlStr.endsWith("/incidents") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incidents: [currentIncident] }),
        } as Response);
      }

      if (urlStr.endsWith("/incidents/inc-999") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              incident: currentIncident,
              complaints: attached,
            }),
        } as Response);
      }

      if (urlStr.includes("/corroboration-suggestions") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              suggestions: [
                {
                  complaint: comp2,
                  similarityScore: 0.85,
                  sourceIncidentId: "inc-1000",
                },
              ],
            }),
        } as Response);
      }

      if (urlStr.includes("/incidents/inc-999/merge") && method === "POST") {
        currentIncident = {
          ...currentIncident,
          corroborationCount: 2,
        };
        attached = [comp1, comp2];
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              incident: currentIncident,
              complaints: attached,
            }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr} ${method}`));
    });

    render(<App />);

    // Check staff portal loaded
    await waitFor(() => {
      expect(screen.getByText(/Operational Incident Pool/i)).toBeInTheDocument();
      expect(screen.getByText(/Plumbing/i)).toBeInTheDocument();
    });

    // Open details
    fireEvent.click(screen.getByRole("button", { name: /View Details & Complaints/i }));

    // Verify suggested corroborations rendered
    await waitFor(() => {
      expect(screen.getByText(/Suggested Corroborations/i)).toBeInTheDocument();
      expect(screen.getByText(/85% Match/i)).toBeInTheDocument();
      expect(screen.getByText("Water leaking heavily from ceiling")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Merge Corroboration/i })).toBeInTheDocument();
    });

    // Merge the suggested corroboration
    fireEvent.click(screen.getByRole("button", { name: /Merge Corroboration/i }));

    // Check corroboration count updated to 2 and both complaints attached
    await waitFor(() => {
      expect(screen.getByText(/Attached Corroborating Complaints \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Corroborating complaint successfully merged/i)).toBeInTheDocument();
    });
  });

  it("renders live visual countdown timer with color warnings and SLA contraction audit timeline in incident details", async () => {
    localStorage.setItem("corr_esc_token", "fake-token");
    localStorage.setItem(
      "corr_user",
      JSON.stringify({
        id: "staff-1",
        email: "plumber@campus.edu",
        role: "Staff",
        organizationId: "org-1",
      })
    );

    window.history.pushState({}, "Staff Portal", "/org/campus/staff/dashboard");

    const now = Date.now();
    // 10 hours total duration, 1 hour remaining (< 25% remaining -> amber warning)
    const createdAt = new Date(now - 9 * 3600 * 1000).toISOString();
    const slaDeadline = new Date(now + 1 * 3600 * 1000).toISOString();

    const incidentWithAudit = {
      id: "inc-audit-1",
      categoryId: { id: "cat-1", name: "Plumbing" },
      status: "In Progress" as const,
      escalationTier: 0,
      corroborationCount: 2,
      createdAt,
      slaDeadline,
      updatedAt: new Date().toISOString(),
      contractionAudit: [
        {
          id: "audit-1",
          complaintId: "comp-1",
          complaintTitle: "Basement flooding from ruptured line",
          previousDeadline: new Date(now + 3 * 3600 * 1000).toISOString(),
          newDeadline: new Date(now + 3 * 3600 * 1000).toISOString(),
          contractedMs: 0,
          corroborationCount: 1,
          createdAt: createdAt,
        },
        {
          id: "audit-2",
          complaintId: "comp-2",
          complaintTitle: "Heavy water leak in ground restroom",
          previousDeadline: new Date(now + 3 * 3600 * 1000).toISOString(),
          newDeadline: slaDeadline,
          contractedMs: 2 * 3600 * 1000,
          corroborationCount: 2,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    vi.spyOn(global, "fetch").mockImplementation((url: string | URL | Request, init?: any) => {
      const urlStr = url.toString();
      const method = init?.method || "GET";

      if (urlStr.includes("/api/v1/orgs/campus/incidents/inc-audit-1/corroboration-suggestions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ suggestions: [] }),
        } as Response);
      }

      if (urlStr.includes("/api/v1/orgs/campus/incidents/inc-audit-1") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              incident: incidentWithAudit,
              complaints: [
                {
                  id: "comp-1",
                  title: "Basement flooding from ruptured line",
                  description: "Severe flooding",
                  locationContext: "Basement",
                  createdAt,
                },
                {
                  id: "comp-2",
                  title: "Heavy water leak in ground restroom",
                  description: "Water on floor",
                  locationContext: "Ground Floor",
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
        } as Response);
      }

      if (urlStr.includes("/api/v1/orgs/campus/incidents") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incidents: [incidentWithAudit] }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr} ${method}`));
    });

    render(<App />);

    // 1. Check countdown timer renders on the incident card with warning severity (< 25% remaining)
    await waitFor(() => {
      expect(screen.getByText(/Operational Incident Pool/i)).toBeInTheDocument();
      const timer = screen.getByTestId("countdown-timer");
      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute("data-severity", "warning");
      expect(screen.getByText(/< 25% Time Remaining/i)).toBeInTheDocument();
    });

    // 2. Open incident details modal
    fireEvent.click(screen.getByRole("button", { name: /View Details & Complaints/i }));

    // 3. Verify SLA Contraction Audit Timeline displays with both baseline and contraction events
    await waitFor(() => {
      expect(screen.getByTestId("audit-timeline")).toBeInTheDocument();
      expect(screen.getByText(/SLA Contraction Audit Timeline \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText("Baseline SLA Established")).toBeInTheDocument();
      expect(screen.getByText("Initial Complaint")).toBeInTheDocument();
      expect(screen.getByText("Corroboration #2 Attached")).toBeInTheDocument();
      expect(screen.getByText(/-2h Contracted/i)).toBeInTheDocument();
      expect(screen.getByText(/Basement flooding from ruptured line/i)).toBeInTheDocument();
      expect(screen.getByText(/Heavy water leak in ground restroom/i)).toBeInTheDocument();
    });
  });

  it("highlights escalated incidents requiring supervisory oversight, supervisory filters, and dual assignee/supervisor accountability", async () => {
    localStorage.setItem("corr_esc_token", "mock-staff-jwt");
    localStorage.setItem("user_role", "Staff");
    localStorage.setItem("user_id", "staff-alice");
    window.history.pushState({}, "Staff Dashboard", "/org/campus/staff/dashboard");

    const escalatedIncident = {
      id: "inc-escalated-1",
      categoryId: "cat-elec",
      category: { id: "cat-elec", name: "Power Systems", baseSlaHours: 8 },
      status: "Assigned" as const,
      escalationTier: 1,
      corroborationCount: 3,
      slaDeadline: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      assigneeId: "staff-alice",
      assignee: { id: "staff-alice", name: "Alice Staff", email: "alice@campus.edu" },
      supervisorId: "sup-john",
      supervisor: { id: "sup-john", name: "John Supervisor", email: "john@campus.edu" },
      contractionAudit: [],
    };

    vi.spyOn(global, "fetch").mockImplementation((url: string | URL | Request, init?: any) => {
      const urlStr = url.toString();
      const method = init?.method || "GET";

      if (urlStr.includes("/api/v1/orgs/campus/incidents/inc-escalated-1/corroboration-suggestions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ suggestions: [] }),
        } as Response);
      }

      if (urlStr.includes("/api/v1/orgs/campus/incidents/inc-escalated-1") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              incident: escalatedIncident,
              complaints: [
                {
                  id: "comp-esc-1",
                  title: "High voltage breaker trip",
                  description: "Total blackout across research labs",
                  locationContext: "Substation Alpha",
                  createdAt: new Date().toISOString(),
                },
              ],
            }),
        } as Response);
      }

      if (urlStr.includes("/api/v1/orgs/campus/incidents") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incidents: [escalatedIncident] }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr} ${method}`));
    });

    render(<App />);

    // 1. Verify card renders Supervisory Oversight Required warning
    await waitFor(() => {
      expect(screen.getByText(/Supervisory Oversight Required \(Tier 1\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Assignee: Alice Staff/i)).toBeInTheDocument();
      expect(screen.getByText(/Supervisor: John Supervisor/i)).toBeInTheDocument();
    });

    // 2. Verify supervisory filter tab exists and works
    const supervisoryTab = screen.getByRole("button", { name: /Supervisory Oversight \(1\)/i });
    expect(supervisoryTab).toBeInTheDocument();
    fireEvent.click(supervisoryTab);

    // 3. Open details modal
    fireEvent.click(screen.getByRole("button", { name: /View Details & Complaints/i }));

    // 4. Verify modal shows supervisory oversight banner and dual accountability
    await waitFor(() => {
      expect(
        screen.getByText(/Tier 1 Escalation — Supervisory Oversight Active/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Primary assignee remains responsible for hands-on execution/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Alice Staff")).toBeInTheDocument();
      expect(screen.getByText("John Supervisor")).toBeInTheDocument();
    });
  });

  it("allows complainant to view resolution verification prompt and contest resolution to reopen incident with penalty", async () => {
    localStorage.clear();
    localStorage.setItem("corr_esc_token", "mock-complainant-jwt");
    localStorage.setItem("user_role", "Complainant");
    localStorage.setItem("user_id", "comp-user-1");
    window.history.pushState({}, "Complainant Portal", "/org/campus/portal");

    let mockIncident: {
      id: string;
      status: "New" | "Assigned" | "In Progress" | "Resolved" | "Closed";
      escalationTier: number;
      corroborationCount: number;
      slaDeadline: string;
      gracePeriodExpiresAt: string;
      reopenCount: number;
      createdAt: string;
      contractionAudit: never[];
    } = {
      id: "inc-resolved-1",
      status: "Resolved",
      escalationTier: 0,
      corroborationCount: 2,
      slaDeadline: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      gracePeriodExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      reopenCount: 0,
      createdAt: new Date().toISOString(),
      contractionAudit: [],
    };

    const mockComplaint = {
      id: "comp-1",
      title: "Elevator Door Jammed",
      description: "Elevator doors repeatedly jamming on floor 2",
      locationContext: "Central Library",
      photoUrl: "",
      complainantId: "comp-user-1",
      categoryId: "cat-lift",
      categoryName: "Elevators",
      incidentId: "inc-resolved-1",
      incident: mockIncident,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    vi.spyOn(global, "fetch").mockImplementation((url: string | URL | Request, init?: any) => {
      const urlStr = url.toString();
      const method = init?.method || "GET";

      if (urlStr.includes("/api/v1/orgs/campus/complaints/my") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ complaints: [{ ...mockComplaint, incident: mockIncident }] }),
        } as Response);
      }

      if (urlStr.includes("/api/v1/orgs/campus/categories") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ categories: [{ id: "cat-lift", name: "Elevators" }] }),
        } as Response);
      }

      if (
        urlStr.includes("/api/v1/orgs/campus/incidents/inc-resolved-1/contest") &&
        method === "POST"
      ) {
        mockIncident = {
          ...mockIncident,
          status: "In Progress",
          escalationTier: 1,
          reopenCount: 1,
        };
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ incident: mockIncident }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr} ${method}`));
    });

    render(<App />);

    // 1. Verify prompt renders in Complainant Portal
    await waitFor(() => {
      expect(
        screen.getByText(/Staff reported this issue resolved\. Is it fixed for you\?/i)
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Yes, Verified/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Still Not Fixed/i })).toBeInTheDocument();
    });

    // 2. Click "Still Not Fixed"
    fireEvent.click(screen.getByRole("button", { name: /Still Not Fixed/i }));

    // 3. Verify contested reopen request sent and UI updates
    await waitFor(() => {
      expect(screen.getByText(/Incident marked as 'Still Not Fixed'/i)).toBeInTheDocument();
    });
  });

  it("renders notification bell with unread badge and allows viewing, marking as read, and bulk marking all as read in drawer", async () => {
    // Setup localStorage for Complainant
    localStorage.setItem("corr_esc_token", "mock-comp-token");
    window.history.pushState({}, "", "/org/campus/portal");

    let notifications = [
      {
        id: "notif-1",
        organizationId: "org-1",
        recipientId: "user-comp",
        incidentId: "inc-1",
        type: "complaint_submitted",
        title: "Complaint Received",
        message: "Your complaint has been logged.",
        priority: "normal" as const,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
      {
        id: "notif-2",
        organizationId: "org-1",
        recipientId: "user-comp",
        incidentId: "inc-1",
        type: "sla_contracted",
        title: "SLA Contracted: Corroboration Added",
        message: "Deadline contracted due to corroborating complaint.",
        priority: "high" as const,
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.spyOn(global, "fetch").mockImplementation((url, options) => {
      const urlStr = url.toString();
      const method = options?.method || "GET";

      if (urlStr.includes("/complaints/my")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ complaints: [] }),
        } as Response);
      }

      if (urlStr.includes("/categories")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ categories: [] }),
        } as Response);
      }

      if (urlStr.includes("/notifications/mark-all-read") && method === "POST") {
        notifications = notifications.map((n) => ({ ...n, isRead: true }));
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ message: "All notifications marked as read" }),
        } as Response);
      }

      if (urlStr.match(/\/notifications\/[^/]+\/read/) && method === "PATCH") {
        const idMatch = urlStr.match(/\/notifications\/([^/]+)\/read/);
        const targetId = idMatch ? idMatch[1] : "";
        notifications = notifications.map((n) =>
          n.id === targetId ? { ...n, isRead: true } : n
        );
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ notification: { id: targetId, isRead: true } }),
        } as Response);
      }

      if (urlStr.includes("/notifications")) {
        const unreadCount = notifications.filter((n) => !n.isRead).length;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              notifications,
              unreadCount,
            }),
        } as Response);
      }

      return Promise.reject(new Error(`Unhandled URL: ${urlStr} ${method}`));
    });

    render(<App />);

    // 1. Verify unread badge count is displayed
    await waitFor(() => {
      expect(screen.getByTestId("notification-unread-badge")).toHaveTextContent("2");
    });

    // 2. Click bell to open notification drawer
    fireEvent.click(screen.getByTestId("notification-bell"));

    await waitFor(() => {
      expect(screen.getByTestId("notification-drawer")).toBeInTheDocument();
      expect(screen.getByText("Complaint Received")).toBeInTheDocument();
      expect(screen.getByText("SLA Contracted: Corroboration Added")).toBeInTheDocument();
    });

    // 3. Mark single notification as read
    const markReadBtn = screen.getByTestId("mark-read-notif-1");
    fireEvent.click(markReadBtn);

    await waitFor(() => {
      expect(screen.getByTestId("notification-unread-badge")).toHaveTextContent("1");
    });

    // 4. Mark all as read
    const markAllBtn = screen.getByTestId("mark-all-read-btn");
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("notification-unread-badge")).not.toBeInTheDocument();
    });
  });
});


