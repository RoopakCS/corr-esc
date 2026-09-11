import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getIncidents,
  getIncidentDetails,
  claimIncident,
  updateIncidentStatus,
  getCorroborationSuggestions,
  getMergeCandidates,
  mergeComplaintIntoIncident,
  reassignIncident,
  getStaff,
  clearToken,
  IncidentItem,
  Complaint,
  SuggestedCorroboration,
  StaffMember,
} from "../services/api.js";
import {
  Layers,
  LogOut,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Image as ImageIcon,
  UserCheck,
  Play,
  X,
  FileText,
  Shield,
  ArrowRight,
  GitMerge,
  Search,
  Sparkles,
  Clock,
  CheckCircle,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { CountdownTimer } from "../components/CountdownTimer.js";
import { AuditTimeline } from "../components/AuditTimeline.js";
import { NotificationCenter } from "../components/NotificationCenter.js";

export type IncidentFilter =
  | "all"
  | "new"
  | "assigned"
  | "in_progress"
  | "breached"
  | "escalated";

export function StaffPortal() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<IncidentFilter>("all");

  // Incident Details Split-Pane Drawer
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);
  const [attachedComplaints, setAttachedComplaints] = useState<Complaint[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Suggested Corroborations & Manual Merging
  const [suggestions, setSuggestions] = useState<SuggestedCorroboration[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Complaint[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState(false);
  const [mergingComplaintId, setMergingComplaintId] = useState<string | null>(null);

  // Supervisory Reassignment
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [selectedReassignee, setSelectedReassignee] = useState<string>("");
  const [reassignLoading, setReassignLoading] = useState(false);

  const loadIncidents = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      return;
    }
    try {
      const data = await getIncidents(slug);
      setIncidents(data);
      getStaff(slug).then(setAvailableStaff).catch(() => {});
    } catch (err: any) {
      if (err.message?.includes("Authentication") || err.message?.includes("token")) {
        navigate(`/org/${slug}/login`);
      } else {
        setError(err.message || "Failed to load incident pool");
      }
    } finally {
      setLoading(false);
    }
  }, [slug, navigate]);

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  // Handle ESC key to dismiss inspection drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedIncident) {
        setSelectedIncident(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIncident]);

  const handleLogout = () => {
    clearToken();
    navigate(`/org/${slug}/login`);
  };

  const fetchSuggestions = async (incidentId: string) => {
    if (!slug) return;
    setLoadingSuggestions(true);
    try {
      const data = await getCorroborationSuggestions(slug, incidentId);
      setSuggestions(data);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearchCandidates = async (query: string) => {
    if (!slug || !selectedIncident) return;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchingCandidates(true);
    try {
      const candidates = await getMergeCandidates(slug, selectedIncident.id, query);
      setSearchResults(candidates);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchingCandidates(false);
    }
  };

  const handleMerge = async (complaintId: string) => {
    if (!slug || !selectedIncident) return;
    setMergingComplaintId(complaintId);
    setDetailsError(null);

    try {
      const result = await mergeComplaintIntoIncident(slug, selectedIncident.id, complaintId);
      setSelectedIncident(result.incident);
      setAttachedComplaints(result.complaints);
      setActionSuccess(
        "Corroborating complaint successfully merged! SLA deadline dynamically contracted."
      );
      await loadIncidents();
      await fetchSuggestions(selectedIncident.id);
      if (searchQuery.trim()) {
        await handleSearchCandidates(searchQuery);
      }
    } catch (err: any) {
      setDetailsError(err.message || "Failed to merge complaint");
    } finally {
      setMergingComplaintId(null);
    }
  };

  const openDetails = async (incident: IncidentItem) => {
    if (!slug) return;
    setSelectedIncident(incident);
    setDetailsError(null);
    setLoadingDetails(true);
    setSearchQuery("");
    setSearchResults([]);

    try {
      const details = await getIncidentDetails(slug, incident.id);
      setSelectedIncident(details.incident);
      setAttachedComplaints(details.complaints);
      await fetchSuggestions(incident.id);
    } catch (err: any) {
      setDetailsError(err.message || "Failed to fetch incident details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleClaim = async (incidentId: string) => {
    if (!slug) return;
    setActionLoading(true);
    setDetailsError(null);

    try {
      const updated = await claimIncident(slug, incidentId);
      setSelectedIncident(updated);
      setActionSuccess("Incident successfully claimed and assigned to you.");
      await loadIncidents();
    } catch (err: any) {
      setDetailsError(err.message || "Failed to claim incident");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWork = async (incidentId: string) => {
    if (!slug) return;
    setActionLoading(true);
    setDetailsError(null);

    try {
      const updated = await updateIncidentStatus(slug, incidentId, "In Progress");
      setSelectedIncident(updated);
      setActionSuccess("Incident status transitioned to In Progress.");
      await loadIncidents();
    } catch (err: any) {
      setDetailsError(err.message || "Failed to update incident status");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async (incidentId: string) => {
    if (!slug) return;
    setActionLoading(true);
    setDetailsError(null);

    try {
      const updated = await updateIncidentStatus(slug, incidentId, "Resolved");
      setSelectedIncident(updated);
      setActionSuccess("Incident marked as Resolved. 24-hour verification grace period initiated.");
      await loadIncidents();
    } catch (err: any) {
      setDetailsError(err.message || "Failed to mark incident as resolved");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReassign = async (incidentId: string) => {
    if (!slug || !selectedReassignee) return;
    setReassignLoading(true);
    setDetailsError(null);

    try {
      const updated = await reassignIncident(slug, incidentId, selectedReassignee);
      setSelectedIncident(updated);
      setActionSuccess("Incident successfully reassigned to staff member.");
      setSelectedReassignee("");
      await loadIncidents();
    } catch (err: any) {
      setDetailsError(err.message || "Failed to reassign incident");
    } finally {
      setReassignLoading(false);
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "New":
        return "bg-sky-500/15 text-sky-300 border-sky-500/30";
      case "Assigned":
        return "bg-amber-500/15 text-amber-300 border-amber-500/30";
      case "In Progress":
        return "bg-status-cobalt-bg text-status-cobalt border-status-cobalt-border";
      case "Resolved":
        return "bg-status-safe-bg text-status-safe border-status-safe-border";
      case "Closed":
        return "bg-slate-800 text-slate-400 border-slate-700";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700";
    }
  };

  const filteredIncidents = incidents.filter((incident) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "new") return incident.status === "New";
    if (activeFilter === "assigned") return incident.status === "Assigned";
    if (activeFilter === "in_progress") return incident.status === "In Progress";
    if (activeFilter === "escalated") return incident.escalationTier > 0;
    if (activeFilter === "breached") {
      return (
        new Date(incident.slaDeadline).getTime() < now &&
        incident.status !== "Closed" &&
        incident.status !== "Resolved"
      );
    }
    return true;
  });

  // Triage quick metrics
  const totalCount = incidents.length;
  const unassignedCount = incidents.filter((i) => i.status === "New").length;
  const assignedCount = incidents.filter((i) => i.status === "Assigned").length;
  const inProgressCount = incidents.filter((i) => i.status === "In Progress").length;
  const escalatedCount = incidents.filter((i) => i.escalationTier > 0).length;
  const now = Date.now();
  const breachedCount = incidents.filter(
    (i) => new Date(i.slaDeadline).getTime() < now && i.status !== "Closed" && i.status !== "Resolved"
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-9 w-9 border-2 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="text-xs text-slate-400 font-mono">Synchronizing incident pool telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-slate-100 flex flex-col font-sans">
      {/* Sticky Operational Cockpit Navbar */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 p-2 rounded-xl shadow-glowViolet/30">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-none">
                Operational Incident Pool
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Staff Cockpit
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">/org/{slug} (Category Pools)</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <NotificationCenter
            slug={slug || ""}
            onRealtimeEvent={() => {
              loadIncidents();
              if (selectedIncident) {
                getIncidentDetails(slug || "", selectedIncident.id)
                  .then((res) => {
                    setSelectedIncident(res.incident);
                    setAttachedComplaints(res.complaints);
                  })
                  .catch(() => {});
              }
            }}
            onNotificationClick={(notif) => {
              if (notif.incidentId) {
                const found = incidents.find((inc) => inc.id === notif.incidentId);
                if (found) {
                  openDetails(found);
                } else if (slug) {
                  getIncidentDetails(slug, notif.incidentId)
                    .then((res) => {
                      openDetails(res.incident);
                    })
                    .catch(() => {});
                }
              }
            }}
          />
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl border border-obsidian-border bg-obsidian-elevated hover:bg-obsidian-hover pressable transition-all duration-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Operational Cockpit */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-status-breached-bg border border-status-breached-border flex items-start space-x-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-status-breached mt-0.5 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-red-200 font-medium">{error}</p>
          </div>
        )}

        {!selectedIncident && actionSuccess && (
          <div className="p-4 rounded-xl bg-status-safe-bg border border-status-safe-border flex items-start space-x-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-status-safe mt-0.5 flex-shrink-0" />
            <p className="text-xs sm:text-sm text-emerald-200 font-medium">{actionSuccess}</p>
          </div>
        )}

        {/* Operational Pool Header & Quick Triage Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-xl p-3.5 space-y-1 shadow-surface">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Active
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                {totalCount}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Pool Items</span>
            </div>
          </div>

          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-xl p-3.5 space-y-1 shadow-surface">
            <span className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider block">
              Unassigned
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-sky-300">
                {unassignedCount}
              </span>
              <span className="text-[10px] text-sky-400/70 font-mono">Claimable</span>
            </div>
          </div>

          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-xl p-3.5 space-y-1 shadow-surface">
            <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider block">
              In Progress
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-indigo-300">
                {inProgressCount}
              </span>
              <span className="text-[10px] text-indigo-400/70 font-mono">Active Work</span>
            </div>
          </div>

          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-xl p-3.5 space-y-1 shadow-surface">
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">
              SLA Breached
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-300">
                {breachedCount}
              </span>
              <span className="text-[10px] text-rose-400/70 font-mono">Overdue</span>
            </div>
          </div>

          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-xl p-3.5 space-y-1 shadow-surface col-span-2 sm:col-span-1">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
              Supervisory
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-300">
                {escalatedCount}
              </span>
              <span className="text-[10px] text-amber-400/70 font-mono">Tier &ge; 1</span>
            </div>
          </div>
        </div>

        {/* Segmented Status Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-obsidian-border pb-4">
          <div className="inline-flex p-1 bg-obsidian-surface border border-obsidian-border rounded-xl gap-1 flex-wrap">
            {[
              { id: "all" as IncidentFilter, label: `All (${totalCount})` },
              { id: "new" as IncidentFilter, label: `Unassigned (${unassignedCount})` },
              { id: "assigned" as IncidentFilter, label: `Assigned (${assignedCount})` },
              { id: "in_progress" as IncidentFilter, label: `In Progress (${inProgressCount})` },
              { id: "breached" as IncidentFilter, label: `Impending Breaches (${breachedCount})` },
              { id: "escalated" as IncidentFilter, label: `Supervisory Oversight (${escalatedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold pressable transition-all duration-200 focus-ring ${
                  activeFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-glowViolet"
                    : "text-slate-400 hover:text-slate-200 hover:bg-obsidian-hover"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>Pre-filtered by your category pool permissions</span>
          </div>
        </div>

        {/* Incident Cards Pool Grid */}
        {filteredIncidents.length === 0 ? (
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-12 text-center space-y-3 shadow-surface">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-base sm:text-lg font-bold text-slate-200">Incident Pool Clear</h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
              There are no active incidents matching this filter in your assigned category pools.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredIncidents.map((incident) => (
              <div
                key={incident.id}
                className={`bg-obsidian-surface/95 border rounded-2xl p-5 shadow-surface flex flex-col justify-between space-y-4 transition-all duration-200 hover:border-obsidian-subtle ${
                  incident.escalationTier > 0
                    ? "border-rose-500/50 shadow-glowBreached/20"
                    : "border-obsidian-border"
                }`}
              >
                <div className="space-y-3.5">
                  {/* Category Chip & Status Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-md bg-obsidian-elevated text-indigo-300 border border-obsidian-border font-mono font-medium">
                      {incident.category?.name || "Category Pool"}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getStatusBadgeClass(
                        incident.status
                      )}`}
                    >
                      {incident.status}
                    </span>
                  </div>

                  {/* Supervisory Oversight Required Banner (when escalated) */}
                  {incident.escalationTier > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span>Supervisory Oversight Required (Tier {incident.escalationTier})</span>
                    </div>
                  )}

                  {/* Resolution Grace Period Badge */}
                  {incident.status === "Resolved" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                      <Clock className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      <span>Resolution Grace Period Active (24h)</span>
                    </div>
                  )}

                  {/* Contested Reopen Penalty Badge */}
                  {Boolean(incident.reopenCount && incident.reopenCount > 0) && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span>Contested Resolution ({incident.reopenCount}x penalty)</span>
                    </div>
                  )}

                  {/* Incident Reference & Responsibility Tier */}
                  <div className="space-y-1">
                    <div className="text-xs text-slate-400 font-mono">Incident #{incident.id.slice(-6)}</div>
                    <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      <span>Tier {incident.escalationTier} Responsibility</span>
                    </div>
                  </div>

                  {/* Precision SLA Countdown Chronometer */}
                  <div className="pt-1">
                    <CountdownTimer deadline={incident.slaDeadline} createdAt={incident.createdAt} />
                  </div>

                  {/* Corroboration Count, Assignee & Supervisor Info */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-obsidian-border/80">
                    <div>
                      Corroborations:{" "}
                      <strong className="text-white font-mono tabular-nums">
                        {incident.corroborationCount}
                      </strong>
                    </div>
                    <div className="text-right">
                      <div>
                        {incident.assignee ? (
                          <span className="text-emerald-400 font-medium">
                            Assignee: {incident.assignee.name}
                          </span>
                        ) : (
                          <span className="text-sky-400 font-medium">Unassigned</span>
                        )}
                      </div>
                      {incident.supervisor && (
                        <div className="text-amber-300 text-[11px] font-medium mt-0.5">
                          Supervisor: {incident.supervisor.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Action Triggers & Inspect Action */}
                <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-obsidian-border/50">
                  {incident.status === "New" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClaim(incident.id);
                      }}
                      disabled={actionLoading}
                      className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 pressable focus-ring transition-all duration-200"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Quick Claim</span>
                    </button>
                  )}
                  {incident.status === "Assigned" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartWork(incident.id);
                      }}
                      disabled={actionLoading}
                      className="flex-1 py-2 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 pressable focus-ring transition-all duration-200"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Quick Start</span>
                    </button>
                  )}
                  {incident.status === "In Progress" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResolve(incident.id);
                      }}
                      disabled={actionLoading}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 pressable focus-ring transition-all duration-200"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Quick Resolve</span>
                    </button>
                  )}

                  <button
                    onClick={() => openDetails(incident)}
                    className={`py-2 px-3 bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border hover:border-obsidian-subtle rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 pressable focus-ring transition-all duration-200 shadow-sm ${
                      incident.status === "Resolved" || incident.status === "Closed"
                        ? "w-full"
                        : "flex-1"
                    }`}
                  >
                    <span>View Details & Complaints</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Split-Pane Slide-Over Inspection Drawer */}
      {selectedIncident && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity flex justify-end animate-in fade-in duration-200"
          onClick={() => setSelectedIncident(null)}
        >
          <div
            className="relative w-full max-w-5xl bg-obsidian-surface border-l border-obsidian-border shadow-elevated h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Top Header */}
            <div className="p-5 border-b border-obsidian-border bg-obsidian/90 backdrop-blur flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <span>Incident Details</span>
                  <span className="text-xs font-mono text-slate-400">#{selectedIncident.id}</span>
                </h3>
                <span className="text-xs text-indigo-400 font-medium">
                  {selectedIncident.category?.name} Pool • Tier {selectedIncident.escalationTier}
                </span>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                aria-label="Close drawer"
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-obsidian-elevated pressable transition-all duration-200 focus-ring"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Banners inside Drawer */}
            {actionSuccess && (
              <div className="p-3.5 m-5 mb-0 bg-status-safe-bg border border-status-safe-border rounded-xl flex items-start gap-2 text-xs text-emerald-200 font-medium animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-status-safe" />
                <span>{actionSuccess}</span>
              </div>
            )}

            {detailsError && (
              <div className="p-3.5 m-5 mb-0 bg-status-breached-bg border border-status-breached-border rounded-xl flex items-start gap-2 text-xs text-red-300 font-medium animate-in fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span>{detailsError}</span>
              </div>
            )}

            {/* Supervisory Oversight Banner & Dual Accountability */}
            <div className="p-5 pb-0 space-y-4 flex-shrink-0">
              {selectedIncident.escalationTier > 0 && (
                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1 text-left">
                    <div className="text-xs font-bold text-red-200">
                      Tier {selectedIncident.escalationTier} Escalation — Supervisory Oversight Active
                    </div>
                    <p className="text-xs text-red-300/90 leading-relaxed">
                      This incident has breached its dynamic SLA deadline. Primary assignee remains responsible for hands-on execution while designated supervisory authority provides supervisory oversight.
                    </p>
                    {selectedIncident.supervisor && (
                      <div className="text-xs text-amber-300 font-semibold pt-1">
                        Designated Supervisor: {selectedIncident.supervisor.name} ({selectedIncident.supervisor.email})
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status & SLA Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="bg-obsidian p-3 rounded-xl border border-obsidian-border">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Status</div>
                  <div className="text-xs sm:text-sm font-bold text-white mt-1">{selectedIncident.status}</div>
                </div>
                <div className="bg-obsidian p-3 rounded-xl border border-obsidian-border">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Corroborations</div>
                  <div className="text-xs sm:text-sm font-bold text-indigo-400 mt-1 font-mono tabular-nums">
                    {selectedIncident.corroborationCount}
                  </div>
                </div>
                <div className="bg-obsidian p-3 rounded-xl border border-obsidian-border">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Escalation Tier</div>
                  <div className="text-xs sm:text-sm font-bold text-amber-400 mt-1 font-mono">
                    Tier {selectedIncident.escalationTier}
                  </div>
                </div>
                <div className="bg-obsidian p-3 rounded-xl border border-obsidian-border flex flex-col justify-center">
                  <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider mb-1">Live SLA Timer</div>
                  <CountdownTimer
                    deadline={selectedIncident.slaDeadline}
                    createdAt={selectedIncident.createdAt}
                    compact
                  />
                </div>
              </div>

              {/* Dual Accountability Row */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs bg-obsidian p-3.5 rounded-xl border border-obsidian-border gap-2">
                <div>
                  <span className="text-slate-500">Primary Assignee: </span>
                  <span className="text-white font-semibold">
                    {selectedIncident.assignee?.name || "Unassigned"}
                  </span>
                </div>
                {selectedIncident.supervisor ? (
                  <div>
                    <span className="text-slate-500">Designated Supervisor: </span>
                    <span className="text-amber-300 font-semibold">
                      {selectedIncident.supervisor.name}
                    </span>
                  </div>
                ) : selectedIncident.escalationTier > 0 ? (
                  <div>
                    <span className="text-slate-500">Supervisory Status: </span>
                    <span className="text-amber-400 font-medium">Assignment Pending</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-500">Escalation Status: </span>
                    <span className="text-emerald-400 font-medium">Standard Tier (No breach)</span>
                  </div>
                )}
              </div>

              {/* Supervisory Reassignment Control (when escalated) */}
              {selectedIncident.escalationTier > 0 && availableStaff.length > 0 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Supervisory Reassignment</span>
                    </span>
                    <span className="text-[11px] text-slate-400">Reassign stalled work to active staff</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedReassignee}
                      onChange={(e) => setSelectedReassignee(e.target.value)}
                      aria-label="Reassign to Staff Member"
                      className="flex-1 bg-obsidian border border-obsidian-border text-white rounded-lg px-3 py-1.5 text-xs focus-ring"
                    >
                      <option value="">Select staff member to reassign...</option>
                      {availableStaff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.email})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleReassign(selectedIncident.id)}
                      disabled={!selectedReassignee || reassignLoading}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow pressable transition-all duration-200"
                    >
                      {reassignLoading ? "Reassigning..." : "Reassign"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Split-Pane Scrollable Inspection Content */}
            <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto flex-1">
              {/* Left Pane: SLA Contraction Timeline & Attached Complaints Gallery */}
              <div className="lg:col-span-7 space-y-6">
                {/* SLA Contraction Audit Timeline */}
                <div>
                  <AuditTimeline entries={selectedIncident.contractionAudit} />
                </div>

                {/* Attached Corroborating Complaints List */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>Attached Corroborating Complaints ({attachedComplaints.length})</span>
                  </h4>

                  {loadingDetails ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-mono">
                      Loading attached complaints telemetry...
                    </div>
                  ) : attachedComplaints.length === 0 ? (
                    <div className="text-xs text-slate-500 italic p-4 bg-obsidian border border-obsidian-border rounded-xl">
                      No attached complaints found.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {attachedComplaints.map((complaint) => (
                        <div
                          key={complaint.id}
                          className="bg-obsidian border border-obsidian-border rounded-xl p-4 space-y-2.5 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="text-sm font-bold text-slate-200">{complaint.title}</h5>
                            <span className="text-[11px] text-slate-500 font-mono flex-shrink-0">
                              {new Date(complaint.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {complaint.description}
                          </p>
                          {complaint.locationContext && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                              <span>{complaint.locationContext}</span>
                            </div>
                          )}
                          {complaint.photoUrl && (
                            <div className="pt-1.5 flex items-center gap-3">
                              <a
                                href={complaint.photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                              >
                                <ImageIcon className="w-3.5 h-3.5" /> View Photo Evidence
                              </a>
                              <div className="w-14 h-10 rounded-lg overflow-hidden border border-obsidian-border bg-obsidian-elevated flex-shrink-0">
                                <img
                                  src={complaint.photoUrl}
                                  alt="Complaint evidence thumbnail"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane: Suggested Corroborations & Manual Merging Station */}
              <div className="lg:col-span-5 space-y-6">
                {/* Suggested Corroborations Section */}
                <div className="space-y-3 bg-obsidian-surface p-4 rounded-xl border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span>Suggested Corroborations ({suggestions.length})</span>
                    </h4>
                    <span className="text-[10px] text-purple-300/80 font-mono">
                      Lexical Token Match
                    </span>
                  </div>

                  {loadingSuggestions ? (
                    <div className="text-center py-4 text-slate-400 text-xs font-mono">
                      Computing token similarity...
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="p-3.5 bg-obsidian border border-obsidian-border rounded-xl text-xs text-slate-400 italic">
                      No similar open complaints detected for this category.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {suggestions.map(({ complaint, similarityScore }) => (
                        <div
                          key={complaint.id}
                          className="bg-obsidian border border-purple-900/40 hover:border-purple-600/60 rounded-xl p-3.5 space-y-2.5 transition-all duration-200"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-xs sm:text-sm font-bold text-slate-200">
                                {complaint.title}
                              </h5>
                              <span className="text-[10px] text-slate-500 font-mono">
                                Submitted on {new Date(complaint.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold font-mono tabular-nums flex-shrink-0">
                              {Math.round(similarityScore * 100)}% Match
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {complaint.description}
                          </p>

                          {complaint.locationContext && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <MapPin className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                              <span>{complaint.locationContext}</span>
                            </div>
                          )}

                          {complaint.photoUrl && (
                            <div>
                              <a
                                href={complaint.photoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 underline"
                              >
                                <ImageIcon className="w-3 h-3" /> View Attached Photo
                              </a>
                            </div>
                          )}

                          <div className="pt-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleMerge(complaint.id)}
                              disabled={mergingComplaintId === complaint.id}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow pressable transition-all duration-200"
                            >
                              <GitMerge className="w-3.5 h-3.5" />
                              <span>
                                {mergingComplaintId === complaint.id
                                  ? "Merging..."
                                  : "Merge Corroboration"}
                              </span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manual Search & Merge Section */}
                <div className="space-y-3 bg-obsidian-surface p-4 rounded-xl border border-obsidian-border">
                  <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <Search className="w-4 h-4 text-indigo-400" />
                    <span>Manual Corroboration Search</span>
                  </h4>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search open complaints in this category to merge..."
                      value={searchQuery}
                      onChange={(e) => handleSearchCandidates(e.target.value)}
                      className="w-full px-3.5 py-2 pl-9 bg-obsidian border border-obsidian-border rounded-xl text-white text-xs placeholder-slate-500 focus-ring font-mono"
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  </div>

                  {searchingCandidates && (
                    <div className="text-center py-2 text-slate-500 text-xs font-mono">
                      Searching candidates...
                    </div>
                  )}

                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {searchResults.map((candidateComplaint) => (
                        <div
                          key={candidateComplaint.id}
                          className="bg-obsidian border border-obsidian-border rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-slate-200 truncate">{candidateComplaint.title}</div>
                            <div className="text-slate-400 truncate">{candidateComplaint.description}</div>
                            {candidateComplaint.locationContext && (
                              <div className="text-slate-500 text-[11px] truncate">
                                📍 {candidateComplaint.locationContext}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMerge(candidateComplaint.id)}
                            disabled={mergingComplaintId === candidateComplaint.id}
                            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold pressable transition-all duration-200"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            <span>{mergingComplaintId === candidateComplaint.id ? "Merging..." : "Merge"}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Operational Action Controls Footer */}
            <div className="p-4 sm:p-5 border-t border-obsidian-border bg-obsidian/90 backdrop-blur flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white border border-transparent hover:border-obsidian-border hover:bg-obsidian-elevated pressable transition-all duration-200"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                {selectedIncident.status === "New" && (
                  <button
                    onClick={() => handleClaim(selectedIncident.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-glowViolet pressable transition-all duration-200"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{actionLoading ? "Claiming..." : "Claim Incident"}</span>
                  </button>
                )}

                {selectedIncident.status === "Assigned" && (
                  <button
                    onClick={() => handleStartWork(selectedIncident.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs shadow-glowWarning pressable transition-all duration-200"
                  >
                    <Play className="w-4 h-4" />
                    <span>{actionLoading ? "Updating..." : "Start Work (In Progress)"}</span>
                  </button>
                )}

                {selectedIncident.status === "In Progress" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-medium">
                      Work Currently In Progress
                    </span>
                    <button
                      onClick={() => handleResolve(selectedIncident.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs shadow-glowSafe pressable transition-all duration-200"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{actionLoading ? "Resolving..." : "Mark as Resolved"}</span>
                    </button>
                  </div>
                )}

                {selectedIncident.status === "Resolved" && (
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Resolution Grace Period Active (24h)</span>
                  </span>
                )}

                {selectedIncident.status === "Closed" && (
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-obsidian-elevated border border-obsidian-border text-slate-400 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Incident Closed</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
