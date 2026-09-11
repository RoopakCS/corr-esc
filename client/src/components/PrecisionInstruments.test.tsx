import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountdownTimer } from "./CountdownTimer.js";
import { AuditTimeline } from "./AuditTimeline.js";

describe("Ticket 02: Precision Instruments", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("CountdownTimer", () => {
    it("renders safe severity with tabular monospace font and formatted duration", () => {
      const now = new Date("2026-09-11T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const createdAt = new Date("2026-09-11T10:00:00Z").toISOString();
      const deadline = new Date("2026-09-11T20:00:00Z").toISOString(); // 8h remaining of 10h (80% remaining -> normal/safe)

      render(<CountdownTimer deadline={deadline} createdAt={createdAt} />);

      const timer = screen.getByTestId("countdown-timer");
      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute("data-severity", "normal");
      expect(screen.getByText("Normal")).toBeInTheDocument();
      expect(screen.getByText("08:00:00")).toBeInTheDocument();
      expect(timer.querySelector(".font-mono")).toBeInTheDocument();
    });

    it("renders warning severity with amber styling when under 25% time remains", () => {
      const now = new Date("2026-09-11T19:00:00Z").getTime();
      vi.setSystemTime(now);

      const createdAt = new Date("2026-09-11T10:00:00Z").toISOString();
      const deadline = new Date("2026-09-11T20:00:00Z").toISOString(); // 1h remaining of 10h (10% remaining -> warning)

      render(<CountdownTimer deadline={deadline} createdAt={createdAt} />);

      const timer = screen.getByTestId("countdown-timer");
      expect(timer).toBeInTheDocument();
      expect(timer).toHaveAttribute("data-severity", "warning");
      expect(screen.getByText(/< 25% Time Remaining/i)).toBeInTheDocument();
      expect(screen.getByText("01:00:00")).toBeInTheDocument();
    });

    it("renders imminent / breached severity when time is expired", () => {
      const now = new Date("2026-09-11T21:00:00Z").getTime();
      vi.setSystemTime(now);

      const createdAt = new Date("2026-09-11T10:00:00Z").toISOString();
      const deadline = new Date("2026-09-11T20:00:00Z").toISOString(); // expired

      render(<CountdownTimer deadline={deadline} createdAt={createdAt} />);

      const timer = screen.getByTestId("countdown-timer");
      expect(timer).toHaveAttribute("data-severity", "imminent");
      expect(screen.getByText(/Imminent Breach/i)).toBeInTheDocument();
      expect(screen.getByText(/00:00:00 \(Breached\)/i)).toBeInTheDocument();
    });

    it("renders compact mode with pill format", () => {
      const now = new Date("2026-09-11T12:00:00Z").getTime();
      vi.setSystemTime(now);

      const deadline = new Date("2026-09-11T14:00:00Z").toISOString();

      render(<CountdownTimer deadline={deadline} compact={true} />);

      const timer = screen.getByTestId("countdown-timer");
      expect(timer).toBeInTheDocument();
      expect(screen.getByText("02:00:00")).toBeInTheDocument();
    });
  });

  describe("AuditTimeline", () => {
    it("renders empty state with Baseline SLA Active message", () => {
      render(<AuditTimeline entries={[]} />);

      expect(screen.getByText("Baseline SLA Active")).toBeInTheDocument();
      expect(screen.getByText(/No corroboration contractions recorded yet/i)).toBeInTheDocument();
    });

    it("renders populated contraction timeline with baseline and corroboration events", () => {
      const entries = [
        {
          id: "audit-1",
          complaintId: "comp-1",
          complaintTitle: "Main Water Pipe Leak",
          previousDeadline: "2026-09-11T18:00:00Z",
          newDeadline: "2026-09-11T18:00:00Z",
          contractedMs: 0,
          corroborationCount: 1,
          createdAt: "2026-09-11T10:00:00Z",
        },
        {
          id: "audit-2",
          complaintId: "comp-2",
          complaintTitle: "Washroom Flooding 2F",
          previousDeadline: "2026-09-11T18:00:00Z",
          newDeadline: "2026-09-11T16:00:00Z",
          contractedMs: 2 * 3600 * 1000,
          corroborationCount: 2,
          createdAt: "2026-09-11T11:30:00Z",
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
    });
  });
});
