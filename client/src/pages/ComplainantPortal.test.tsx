import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ComplainantPortal } from "./ComplainantPortal.js";
import * as api from "../services/api.js";

vi.mock("../components/NotificationCenter.js", () => ({
  NotificationCenter: () => <div data-testid="notification-center">Notifs</div>,
}));

const mockCategories: api.Category[] = [
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
  {
    id: "cat-electrical",
    name: "Electrical",
    baseSlaHours: 24,
    floorHours: 4,
    contractionFactor: 0.2,
    tierTargets: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const mockComplaints: api.Complaint[] = [
  {
    id: "comp-1",
    title: "Leaking Sink in Room 204",
    description: "Cold water faucet leaking heavily onto floor.",
    locationContext: "Science Block, 2nd Floor",
    photoUrl: "https://example.com/sink.jpg",
    complainantId: "user-1",
    categoryId: "cat-plumbing",
    categoryName: "Plumbing",
    incidentId: "inc-1",
    incident: {
      id: "inc-1",
      status: "Resolved",
      escalationTier: 0,
      corroborationCount: 2,
      slaDeadline: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      gracePeriodExpiresAt: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
      reopenCount: 0,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function renderPortal() {
  return render(
    <MemoryRouter initialEntries={["/org/saveetha-campus/portal"]}>
      <Routes>
        <Route path="/org/:slug/portal" element={<ComplainantPortal />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ComplainantPortal Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem("corr_esc_token", "test-token");
    vi.spyOn(api, "getCategories").mockResolvedValue(mockCategories);
    vi.spyOn(api, "getMyComplaints").mockResolvedValue(mockComplaints);
  });

  it("renders portal header, categories chips, and active complaints feed", async () => {
    renderPortal();

    await waitFor(() => {
      expect(screen.getByText(/Complainant Portal/i)).toBeInTheDocument();
      expect(screen.getAllByText("Leaking Sink in Room 204")[0]).toBeInTheDocument();
      expect(screen.getByText(/Science Block, 2nd Floor/i)).toBeInTheDocument();
    });

    // Check category chip rendering
    expect(screen.getByRole("button", { name: /Plumbing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Electrical/i })).toBeInTheDocument();
  });

  it("displays high-priority Resolution Verification banner when an incident is in Resolved status", async () => {
    renderPortal();

    await waitFor(() => {
      expect(
        screen.getByText(/Resolution Verification Grace Period/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Yes, Verified/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Still Not Fixed/i })
      ).toBeInTheDocument();
    });
  });

  it("allows user to verify resolution and calls confirmIncidentResolution", async () => {
    const confirmSpy = vi.spyOn(api, "confirmIncidentResolution").mockResolvedValue({
      id: "inc-1",
      categoryId: "cat-plumbing",
      status: "Closed",
      escalationTier: 0,
      corroborationCount: 2,
      slaDeadline: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderPortal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Yes, Verified/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Yes, Verified/i }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith("saveetha-campus", "inc-1");
    });
  });

  it("allows user to contest resolution with feedback, reopening the incident", async () => {
    const contestSpy = vi.spyOn(api, "contestIncident").mockResolvedValue({
      id: "inc-1",
      categoryId: "cat-plumbing",
      status: "In Progress",
      escalationTier: 1,
      corroborationCount: 2,
      slaDeadline: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    renderPortal();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Still Not Fixed/i })).toBeInTheDocument();
    });

    const feedbackInput = screen.getByPlaceholderText(
      /Optional explanation of why the issue is still not fixed/i
    );
    expect(feedbackInput).toBeInTheDocument();

    fireEvent.change(feedbackInput, {
      target: { value: "Water is still dripping from pipe beneath." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Still Not Fixed/i }));

    await waitFor(() => {
      expect(contestSpy).toHaveBeenCalledWith(
        "saveetha-campus",
        "inc-1",
        "Water is still dripping from pipe beneath."
      );
    });
  });

  it("renders photo thumbnail preview and allows removing the photo URL", async () => {
    renderPortal();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/https:\/\/example\.com\/photo\.jpg/i)).toBeInTheDocument();
    });

    const photoInput = screen.getByPlaceholderText(/https:\/\/example\.com\/photo\.jpg/i);
    fireEvent.change(photoInput, {
      target: { value: "https://images.unsplash.com/sample-pipe.jpg" },
    });

    // Preview thumbnail should render
    const previewImg = screen.getByAltText(/Attachment preview/i);
    expect(previewImg).toBeInTheDocument();
    expect(previewImg).toHaveAttribute("src", "https://images.unsplash.com/sample-pipe.jpg");

    // Click remove button
    const removeBtn = screen.getByRole("button", { name: /Remove photo/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByAltText(/Attachment preview/i)).not.toBeInTheDocument();
    expect(photoInput).toHaveValue("");
  });
});
