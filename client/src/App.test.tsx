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
});
