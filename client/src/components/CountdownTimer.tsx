import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

export interface CountdownTimerProps {
  deadline: string | Date;
  createdAt?: string | Date;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
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
  className = "",
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

  const ratio = totalDurationMs && totalDurationMs > 0
    ? Math.min(1, Math.max(0, remainingMs / totalDurationMs))
    : remainingMs <= 0 ? 0 : 1;

  const themeMap: Record<
    TimerSeverity,
    {
      badgeBg: string;
      badgeText: string;
      dot: string;
      barFill: string;
      label: string;
      icon: React.ReactNode;
    }
  > = {
    normal: {
      badgeBg: "bg-emerald-500/10 border-emerald-500/30",
      badgeText: "text-emerald-400",
      dot: "bg-emerald-400 shadow-sm shadow-emerald-500/50",
      barFill: "bg-emerald-500",
      label: "Normal",
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    },
    warning: {
      badgeBg: "bg-amber-500/10 border-amber-500/30",
      badgeText: "text-amber-400",
      dot: "bg-amber-400 shadow-sm shadow-amber-500/50",
      barFill: "bg-amber-500",
      label: "< 25% Time Remaining",
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
    },
    imminent: {
      badgeBg: "bg-rose-500/10 border-rose-500/30",
      badgeText: "text-rose-400 animate-pulse",
      dot: "bg-rose-400 shadow-sm shadow-rose-500/50 animate-ping",
      barFill: "bg-rose-500",
      label: "Imminent Breach",
      icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />,
    },
  };

  const theme = themeMap[severity];

  if (compact) {
    return (
      <div
        data-testid="countdown-timer"
        data-severity={severity}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-medium tabular-nums ${theme.badgeBg} ${theme.badgeText} ${className}`}
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
      className={`rounded-xl p-3.5 border space-y-2.5 bg-obsidian-surface/95 border-obsidian-border shadow-surface transition-all duration-smooth hover:border-obsidian-subtle ${className}`}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5 font-sans">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          {showLabel && <span className="font-medium text-slate-300">SLA Countdown:</span>}
        </span>
        <span
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border ${theme.badgeBg} ${theme.badgeText}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot}`} />
          <span>{theme.label}</span>
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <div className={`text-lg font-mono font-bold tracking-tight tabular-nums ${theme.badgeText}`}>
          {formattedTime}
        </div>
        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
          Target: {new Date(deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Progress Track */}
      {totalDurationMs !== undefined && (
        <div className="h-1.5 w-full bg-obsidian-muted rounded-full overflow-hidden border border-obsidian-border/60">
          <div
            className={`h-full transition-all duration-500 ${theme.barFill}`}
            style={{ width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};
