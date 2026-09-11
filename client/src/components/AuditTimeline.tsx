import React from "react";
import { History, ArrowDownRight, Clock, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { ContractionAuditEntry } from "../services/api.js";

export interface AuditTimelineProps {
  entries?: ContractionAuditEntry[];
  className?: string;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0 && seconds > 0) parts.push(`${seconds}s`);
  return parts.join(" ") || "0m";
}

export function formatRelativeTime(dateInput: string | Date): string {
  const diffMs = Date.now() - new Date(dateInput).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "Just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({
  entries = [],
  className = "",
}) => {
  if (!entries || entries.length === 0) {
    return (
      <div className={`bg-obsidian-surface border border-obsidian-border rounded-xl p-6 text-center space-y-2 ${className}`}>
        <History className="w-8 h-8 text-slate-500 mx-auto" />
        <p className="text-xs font-semibold text-slate-200">Baseline SLA Active</p>
        <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
          No corroboration contractions recorded yet. Merging additional complaints will dynamically accelerate the SLA deadline and log audit events here.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="audit-timeline">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-4 h-4 text-indigo-400" />
          <span>SLA Contraction Audit Timeline ({entries.length})</span>
        </h4>
        <span className="text-[11px] text-slate-400 font-mono tabular-nums">
          Corroboration Engine
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-obsidian-border">
        {entries.map((entry, index) => {
          const isInitial = entry.contractedMs === 0 && entry.corroborationCount === 1;
          const isPenalty = entry.contractedMs < 0 || (entry.complaintTitle && entry.complaintTitle.toLowerCase().includes("reopen"));
          const isBreach = entry.complaintTitle && entry.complaintTitle.toLowerCase().includes("breach");

          let NodeIcon = <ArrowDownRight className="w-3 h-3 text-indigo-400" />;
          let nodeStyle = "bg-indigo-950/80 border-indigo-500 text-indigo-300 shadow-sm shadow-indigo-500/20";

          if (isInitial) {
            NodeIcon = <CheckCircle2 className="w-3 h-3 text-slate-400" />;
            nodeStyle = "bg-obsidian-surface border-obsidian-border text-slate-400";
          } else if (isPenalty) {
            NodeIcon = <AlertTriangle className="w-3 h-3 text-amber-400" />;
            nodeStyle = "bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/20";
          } else if (isBreach) {
            NodeIcon = <AlertCircle className="w-3 h-3 text-rose-400" />;
            nodeStyle = "bg-rose-950/80 border-rose-500 text-rose-300 shadow-sm shadow-rose-500/20";
          }

          return (
            <div key={entry.id || `${entry.complaintId}-${index}`} className="relative group">
              {/* Step indicator node */}
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${nodeStyle}`}
              >
                {NodeIcon}
              </div>

              {/* Event card */}
              <div className="bg-obsidian-surface border border-obsidian-border hover:border-obsidian-subtle rounded-xl p-3.5 space-y-2 transition-all duration-200 shadow-surface">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-slate-100">
                      {isInitial ? (
                        "Baseline SLA Established"
                      ) : isPenalty ? (
                        `Reopen Escalation Penalty Applied`
                      ) : isBreach ? (
                        `SLA Tier Escalation Breach`
                      ) : (
                        `Corroboration #${entry.corroborationCount} Attached`
                      )}
                    </span>
                    <p className="text-xs text-indigo-300 font-medium mt-0.5">
                      &ldquo;{entry.complaintTitle}&rdquo;
                    </p>
                  </div>

                  <div className="text-right">
                    {isInitial ? (
                      <span className="px-2 py-0.5 bg-obsidian-muted border border-obsidian-border text-slate-300 rounded-md text-[10px] font-semibold">
                        Initial Complaint
                      </span>
                    ) : isPenalty ? (
                      <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-md text-[10px] font-bold font-mono tabular-nums">
                        +1 Tier Penalty
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md text-[10px] font-bold font-mono tabular-nums">
                        -{formatDuration(entry.contractedMs)} Contracted
                      </span>
                    )}
                    <div className="text-[10px] text-slate-400 font-mono tabular-nums mt-1">
                      <span>{formatRelativeTime(entry.createdAt)}</span>
                      <span className="mx-1 text-slate-600">&bull;</span>
                      <span>
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deadline comparison */}
                <div className="pt-2 border-t border-obsidian-border/60 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                  {!isInitial && (
                    <div className="flex items-center gap-1 text-slate-400 line-through">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Prev: {new Date(entry.previousDeadline).toLocaleTimeString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>
                      {isInitial ? "Deadline: " : "New Deadline: "}
                      {new Date(entry.newDeadline).toLocaleTimeString()} (
                      {new Date(entry.newDeadline).toLocaleDateString()})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
