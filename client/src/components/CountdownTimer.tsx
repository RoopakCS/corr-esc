import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";

export interface CountdownTimerProps {
  deadline: string | Date;
  createdAt?: string | Date;
  compact?: boolean;
  showLabel?: boolean;
}

export type TimerSeverity = "normal" | "warning" | "imminent";

export function getTimerSeverity(
  remainingMs: number,
  totalDurationMs?: number
): TimerSeverity {
  // Red for imminent breach (< 5% time remaining or breached <= 0)
  if (remainingMs <= 0) {
    return "imminent";
  }

  if (totalDurationMs && totalDurationMs > 0) {
    const ratio = remainingMs / totalDurationMs;
    if (ratio < 0.05) {
      return "imminent";
    }
    // Amber for < 25% remaining
    if (ratio < 0.25) {
      return "warning";
    }
    // Green for normal
    return "normal";
  }

  return "normal";
}

export function formatCountdownTime(remainingMs: number): string {
  if (remainingMs <= 0) {
    return "00:00:00 (Breached)";
  }

  const totalSecs = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  deadline,
  createdAt,
  compact = false,
  showLabel = true,
}) => {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const deadlineMs = new Date(deadline).getTime();
  const createdMs = createdAt ? new Date(createdAt).getTime() : undefined;
  const remainingMs = deadlineMs - now;
  const totalDurationMs = createdMs ? Math.max(0, deadlineMs - createdMs) : undefined;

  const severity = getTimerSeverity(remainingMs, totalDurationMs);
  const formattedTime = formatCountdownTime(remainingMs);

  const themeMap: Record<
    TimerSeverity,
    {
      badgeBg: string;
      badgeText: string;
      dot: string;
      label: string;
      icon: React.ReactNode;
    }
  > = {
    normal: {
      badgeBg: "bg-emerald-500/10 border-emerald-500/30",
      badgeText: "text-emerald-400",
      dot: "bg-emerald-400 shadow-emerald-500/50",
      label: "Normal",
      icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />,
    },
    warning: {
      badgeBg: "bg-amber-500/10 border-amber-500/30",
      badgeText: "text-amber-400",
      dot: "bg-amber-400 shadow-amber-500/50",
      label: "< 25% Time Remaining",
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    },
    imminent: {
      badgeBg: "bg-red-500/10 border-red-500/30",
      badgeText: "text-red-400 animate-pulse",
      dot: "bg-red-400 shadow-red-500/50 animate-ping",
      label: "Imminent Breach",
      icon: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
    },
  };

  const theme = themeMap[severity];

  if (compact) {
    return (
      <div
        data-testid="countdown-timer"
        data-severity={severity}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium ${theme.badgeBg} ${theme.badgeText}`}
        title={`SLA: ${theme.label}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
        <span>{formattedTime}</span>
      </div>
    );
  }

  return (
    <div
      data-testid="countdown-timer"
      data-severity={severity}
      className={`rounded-xl p-3 border space-y-1.5 transition ${theme.badgeBg}`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1 font-sans">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {showLabel && <span>SLA Countdown:</span>}
        </span>
        <span
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${theme.badgeBg} ${theme.badgeText}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
          <span>{theme.label}</span>
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <div className={`text-base font-mono font-bold tracking-tight ${theme.badgeText}`}>
          {formattedTime}
        </div>
        <div className="text-[11px] text-slate-500 font-mono">
          {new Date(deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};
