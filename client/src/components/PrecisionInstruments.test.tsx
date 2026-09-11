import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountdownTimer } from "./CountdownTimer.js";
import { AuditTimeline } from "./AuditTimeline.js";

describe("Precision SLA Instruments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("CountdownTimer", () => {
    function setupTimer(nowIso: string, deadlineIso: string, createdIso?: string, compact = false) {
      vi.setSystemTime(new Date(nowIso).getTime());
      render(<CountdownTimer deadline={deadlineIso} createdAt={createdIso} compact={compact} />);
      return screen.getByTestId("countdown-timer");
    }

    it("renders safe severity with tabular monospace font and formatted duration", () => {
      const timer = setupTimer(
        "2026-09-11T12:00:00Z",
        "2026-09-11T20:00:00Z", // 8h remaining of 10h (80% remaining -> safe)
        "2026-09-11T10:00:00Z"
      );

      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute("data-severity", "safe");
      expect(timer).toHaveAttribute("role", "timer");
      expect(screen.getByText("Safe SLA")).toBeInTheDocument();
      expect(screen.getByText("08:00:00")).toBeInTheDocument();
      expect(timer.querySelector(".font-mono")).toBeInTheDocument();
    });

    it("renders warning severity with amber styling when under 25% time remains", () => {
      const timer = setupTimer(
        "2026-09-11T19:00:00Z",
        "2026-09-11T20:00:00Z", // 1h remaining of 10h (10% remaining -> warning)
        "2026-09-11T10:00:00Z"
      );

      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute("data-severity", "warning");
      expect(screen.getByText(/< 25% Time Remaining/i)).toBeInTheDocument();
      expect(screen.getByText("01:00:00")).toBeInTheDocument();
    });

    it("renders breached severity when time is expired", () => {
      const timer = setupTimer(
        "2026-09-11T21:00:00Z",
        "2026-09-11T20:00:00Z", // expired -> breached
        "2026-09-11T10:00:00Z"
      );

      expect(timer).toHaveAttribute("data-severity", "breached");
      expect(screen.getByText(/SLA Breached/i)).toBeInTheDocument();
      expect(screen.getByText(/00:00:00 \(Breached\)/i)).toBeInTheDocument();
    });

    it("renders compact mode with pill format and aria live attributes", () => {
      const timer = setupTimer(
        "2026-09-11T12:00:00Z",
        "2026-09-11T14:00:00Z",
        undefined,
        true
      );

      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute("role", "timer");
      expect(timer).toHaveAttribute("aria-live", "polite");
      expect(screen.getByText("02:00:00")).toBeInTheDocument();
    });

    it("formats multi-day remaining durations with padded days", () => {
      const timer = setupTimer(
        "2026-09-11T12:00:00Z",
        "2026-09-13T16:30:15Z" // 2 days, 4h, 30m, 15s
      );

      expect(timer).toBeInTheDocument();
      expect(screen.getByText("02d 04:30:15")).toBeInTheDocument();
    });
  });

  describe("AuditTimeline", () => {
    it("renders empty state with Baseline SLA Active message", () => {
      render(<AuditTimeline entries={[]} />);

      expect(screen.getByText("Baseline SLA Active")).toBeInTheDocument();
      expect(screen.getByText(/No corroboration contractions recorded yet/i)).toBeInTheDocument();
    });

    it("renders populated contraction timeline with baseline, relative timestamps, and corroboration events", () => {
      vi.setSystemTime(new Date("2026-09-11T12:00:00Z").getTime());

      const entries = [
        {
          id: "audit-1",
          complaintId: "comp-1",
          complaintTitle: "Main Water Pipe Leak",
          previousDeadline: "2026-09-11T18:00:00Z",
          newDeadline: "2026-09-11T18:00:00Z",
          contractedMs: 0,
          corroborationCount: 1,
          createdAt: "2026-09-11T10:00:00Z", // 2h ago
        },
        {
          id: "audit-2",
          complaintId: "comp-2",
          complaintTitle: "Washroom Flooding 2F",
          previousDeadline: "2026-09-11T18:00:00Z",
          newDeadline: "2026-09-11T16:00:00Z",
          contractedMs: 2 * 3600 * 1000,
          corroborationCount: 2,
          createdAt: "2026-09-11T11:30:00Z", // 30m ago
        },
      ];

      render(<AuditTimeline entries={entries} />);

      expect(screen.getByTestId("audit-timeline")).toBeInTheDocument();
      expect(screen.getByText("SLA Contraction Audit Timeline (2)")).toBeInTheDocument();
      expect(screen.getByText("Baseline SLA Established")).toBeInTheDocument();
      expect(screen.getByText("Initial Complaint")).toBeInTheDocument();
      expect(screen.getByText("Corroboration #2 Attached")).toBeInTheDocument();
      expect(screen.getByText("-2h Contracted")).toBeInTheDocument();
      expect(screen.getByText(/Main Water Pipe Leak/i)).toBeInTheDocument();
      expect(screen.getByText(/Washroom Flooding 2F/i)).toBeInTheDocument();
      expect(screen.getByText(/2h ago/i)).toBeInTheDocument();
      expect(screen.getByText(/30m ago/i)).toBeInTheDocument();
    });
  });
});
