import React from "react";
import { History, ArrowDownRight, Clock, CheckCircle2 } from "lucide-react";
import { ContractionAuditEntry } from "../services/api.js";

export interface AuditTimelineProps {
  entries?: ContractionAuditEntry[];
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

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ entries = [] }) => {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 text-center space-y-2">
        <History className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-xs font-semibold text-slate-300">Baseline SLA Active</p>
        <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
          No corroboration contractions recorded yet. Merging additional complaints will dynamically accelerate the SLA deadline and log audit events here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="audit-timeline">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-4 h-4 text-indigo-400" />
          <span>SLA Contraction Audit Timeline ({entries.length})</span>
        </h4>
        <span className="text-[11px] text-slate-500 font-mono">
          Mathematical decay: Remaining &times; (1 - &alpha;<sup>k</sup>)
        </span>
      </div>

      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
        {entries.map((entry, index) => {
          const isInitial = entry.contractedMs === 0 && entry.corroborationCount === 1;

          return (
            <div key={entry.id || `${entry.complaintId}-${index}`} className="relative group">
              {/* Step indicator dot */}
              <div
                className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                  isInitial
                    ? "bg-slate-900 border-slate-700 text-slate-400"
                    : "bg-indigo-950 border-indigo-500 text-indigo-400"
                }`}
              >
                {isInitial ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
              </div>

              {/* Event card */}
              <div className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 space-y-2 transition">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-white">
                      {isInitial ? (
                        "Baseline SLA Established"
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
                      <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-300 rounded-md text-[10px] font-semibold">
                        Initial Complaint
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md text-[10px] font-bold font-mono">
                        -{formatDuration(entry.contractedMs)} Contracted
                      </span>
                    )}
                    <div className="text-[10px] text-slate-500 font-mono mt-1">
                      {new Date(entry.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                {/* Deadline comparison */}
                <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono">
                  {!isInitial && (
                    <div className="flex items-center gap-1 text-slate-500 line-through">
                      <Clock className="w-3 h-3" />
                      <span>Prev: {new Date(entry.previousDeadline).toLocaleTimeString()}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-emerald-400 font-medium">
                    <Clock className="w-3 h-3 text-emerald-500" />
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
