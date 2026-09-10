import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getIncidents,
  getIncidentDetails,
  claimIncident,
  updateIncidentStatus,
  getCorroborationSuggestions,
  getMergeCandidates,
  mergeComplaintIntoIncident,
  clearToken,
  IncidentItem,
  Complaint,
  SuggestedCorroboration,
} from "../services/api.js";
import {
  Layers,
  Clock,
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
  Sparkles,
  Search,
} from "lucide-react";

export function StaffPortal() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Incident Details Modal
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

  // Live timer tick
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadIncidents = async () => {
    if (!slug) return;
    try {
      const data = await getIncidents(slug);
      setIncidents(data);
    } catch (err: any) {
      if (err.message?.includes("Authentication") || err.message?.includes("token")) {
        navigate(`/org/${slug}/login`);
      } else {
        setError(err.message || "Failed to load incident pool");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [slug]);

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
      setActionSuccess("Corroborating complaint successfully merged! SLA deadline dynamically contracted.");
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

  const formatRemainingTime = (deadlineStr?: string) => {
    if (!deadlineStr) return "N/A";
    const deadline = new Date(deadlineStr).getTime();
    const diff = deadline - currentTime;

    if (diff <= 0) {
      return "SLA Breached";
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "New":
        return "bg-sky-500/20 text-sky-300 border-sky-500/30";
      case "Assigned":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "In Progress":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
      case "Resolved":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "Closed":
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
      default:
        return "bg-slate-500/20 text-slate-300 border-slate-500/30";
    }
  };

  const filteredIncidents = incidents.filter((incident) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "new") return incident.status === "New";
    if (activeFilter === "assigned") return incident.status === "Assigned";
    if (activeFilter === "in_progress") return incident.status === "In Progress";
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Operational Incident Pool</h1>
            <span className="text-xs text-slate-400 font-mono">/org/{slug} (Category Pools)</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300 font-medium">{error}</p>
          </div>
        )}

        {actionSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">{actionSuccess}</p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex space-x-2">
            {[
              { id: "all", label: `All (${incidents.length})` },
              { id: "new", label: `Unassigned (${incidents.filter((i) => i.status === "New").length})` },
              { id: "assigned", label: `Assigned (${incidents.filter((i) => i.status === "Assigned").length})` },
              { id: "in_progress", label: `In Progress (${incidents.filter((i) => i.status === "In Progress").length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  activeFilter === tab.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400">
            Pre-filtered by your category pool permissions
          </span>
        </div>

        {/* Pool Grid */}
        {filteredIncidents.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Layers className="w-12 h-12 text-slate-600 mx-auto" />
            <h3 className="text-lg font-bold text-slate-200">Incident Pool Clear</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              There are no active incidents matching this filter in your assigned category pools.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredIncidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs px-2.5 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-medium">
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

                  <div className="space-y-1">
                    <div className="text-xs text-slate-400 font-mono">Incident #{incident.id.slice(-6)}</div>
                    <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      <span>Tier {incident.escalationTier} Responsibility</span>
                    </div>
                  </div>

                  {/* SLA Countdown Timer */}
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> SLA Deadline:
                      </span>
                      <span className="text-amber-300 font-medium">
                        {formatRemainingTime(incident.slaDeadline)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(incident.slaDeadline).toLocaleString()}
                    </div>
                  </div>

                  {/* Corroboration Count & Assignee */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <div>
                      Corroborations: <strong className="text-white">{incident.corroborationCount}</strong>
                    </div>
                    <div>
                      {incident.assignee ? (
                        <span className="text-emerald-400 font-medium">Assigned: {incident.assignee.name}</span>
                      ) : (
                        <span className="text-sky-400 font-medium">Unassigned</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => openDetails(incident)}
                  className="w-full mt-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition"
                >
                  <span>View Details & Complaints</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Incident Details Drawer / Modal */}
      {selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Incident Details</span>
                  <span className="text-xs font-mono text-slate-400">#{selectedIncident.id}</span>
                </h3>
                <span className="text-xs text-indigo-400">
                  {selectedIncident.category?.name} Pool • Tier {selectedIncident.escalationTier}
                </span>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailsError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span>{detailsError}</span>
              </div>
            )}

            {/* Status & SLA Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-semibold text-slate-500">Status</div>
                <div className="text-sm font-bold text-white mt-1">{selectedIncident.status}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-semibold text-slate-500">Corroborations</div>
                <div className="text-sm font-bold text-indigo-400 mt-1">
                  {selectedIncident.corroborationCount}
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-semibold text-slate-500">Escalation Tier</div>
                <div className="text-sm font-bold text-amber-400 mt-1">
                  Tier {selectedIncident.escalationTier}
                </div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] uppercase font-semibold text-slate-500">SLA Countdown</div>
                <div className="text-xs font-bold text-amber-300 mt-1">
                  {formatRemainingTime(selectedIncident.slaDeadline)}
                </div>
              </div>
            </div>

            {/* Attached Complaints List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Attached Corroborating Complaints ({attachedComplaints.length})</span>
              </h4>

              {loadingDetails ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Loading attached complaints...
                </div>
              ) : attachedComplaints.length === 0 ? (
                <div className="text-xs text-slate-500 italic">No attached complaints found.</div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {attachedComplaints.map((complaint) => (
                    <div
                      key={complaint.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <h5 className="text-sm font-bold text-slate-200">{complaint.title}</h5>
                        <span className="text-[11px] text-slate-500">
                          {new Date(complaint.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap">
                        {complaint.description}
                      </p>
                      {complaint.locationContext && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span>{complaint.locationContext}</span>
                        </div>
                      )}
                      {complaint.photoUrl && (
                        <div className="pt-1">
                          <a
                            href={complaint.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline"
                          >
                            <ImageIcon className="w-3 h-3" /> View Photo Evidence
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suggested Corroborations Section */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>Suggested Corroborations ({suggestions.length})</span>
                </h4>
                <span className="text-[11px] text-slate-400">
                  Lexical Token Match
                </span>
              </div>

              {loadingSuggestions ? (
                <div className="text-center py-4 text-slate-400 text-xs">
                  Computing token similarity...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="p-3.5 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-400 italic">
                  No similar open complaints detected for this category.
                </div>
              ) : (
                <div className="space-y-3">
                  {suggestions.map(({ complaint, similarityScore }) => (
                    <div
                      key={complaint.id}
                      className="bg-slate-950 border border-purple-900/30 hover:border-purple-700/50 rounded-xl p-4 space-y-3 transition"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                            <span>{complaint.title}</span>
                          </h5>
                          <span className="text-[11px] text-slate-500">
                            Submitted on {new Date(complaint.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold">
                          {Math.round(similarityScore * 100)}% Match
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 whitespace-pre-wrap">
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

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleMerge(complaint.id)}
                          disabled={mergingComplaintId === complaint.id}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow transition"
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
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
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
                  className="w-full px-3.5 py-2 pl-9 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              </div>

              {searchingCandidates && (
                <div className="text-center py-2 text-slate-500 text-xs">
                  Searching candidates...
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {searchResults.map((cand) => (
                    <div
                      key={cand.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-200 truncate">{cand.title}</div>
                        <div className="text-slate-400 truncate">{cand.description}</div>
                        {cand.locationContext && (
                          <div className="text-slate-500 text-[11px] truncate">
                            📍 {cand.locationContext}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleMerge(cand.id)}
                        disabled={mergingComplaintId === cand.id}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>{mergingComplaintId === cand.id ? "Merging..." : "Merge"}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Operational Action Controls */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>

              <div className="flex items-center gap-3">
                {selectedIncident.status === "New" && (
                  <button
                    onClick={() => handleClaim(selectedIncident.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{actionLoading ? "Claiming..." : "Claim Incident"}</span>
                  </button>
                )}

                {selectedIncident.status === "Assigned" && (
                  <button
                    onClick={() => handleStartWork(selectedIncident.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-amber-600/30 transition"
                  >
                    <Play className="w-4 h-4" />
                    <span>{actionLoading ? "Updating..." : "Start Work (In Progress)"}</span>
                  </button>
                )}

                {selectedIncident.status === "In Progress" && (
                  <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-medium">
                    Work Currently In Progress
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
