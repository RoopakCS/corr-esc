import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getMyComplaints,
  getCategories,
  submitComplaint,
  contestIncident,
  confirmIncidentResolution,
  clearToken,
  Complaint,
  Category,
} from "../services/api.js";
import {
  FileText,
  PlusCircle,
  Clock,
  MapPin,
  Image as ImageIcon,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Layers,
  ChevronDown,
  X,
  Sparkles,
  Info,
} from "lucide-react";
import { CountdownTimer } from "../components/CountdownTimer.js";
import { AuditTimeline } from "../components/AuditTimeline.js";
import { NotificationCenter } from "../components/NotificationCenter.js";

export function ComplainantPortal() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [contestFeedback, setContestFeedback] = useState<{ [incidentId: string]: string }>({});
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    categoryId: "",
    title: "",
    description: "",
    locationContext: "",
    photoUrl: "",
  });

  const loadData = async () => {
    if (!slug) {
      setLoading(false);
      return;
    }
    try {
      const [complaintsData, categoriesData] = await Promise.all([
        getMyComplaints(slug),
        getCategories(slug),
      ]);
      setComplaints(complaintsData);
      setCategories(categoriesData);
      if (categoriesData.length > 0 && !formData.categoryId) {
        setFormData((prev) => ({ ...prev, categoryId: categoriesData[0].id }));
      }
    } catch (err: any) {
      if (err.message?.includes("No authentication") || err.message?.includes("token")) {
        navigate(`/org/${slug}/login`);
      } else {
        setError(err.message || "Failed to load portal data");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug]);

  const handleLogout = () => {
    clearToken();
    navigate(`/org/${slug}/login`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    try {
      await submitComplaint(slug, {
        categoryId: formData.categoryId,
        title: formData.title,
        description: formData.description,
        locationContext: formData.locationContext,
        photoUrl: formData.photoUrl || undefined,
      });

      setSuccessMsg("Complaint submitted successfully! An incident has been created.");
      setFormData({
        categoryId: categories[0]?.id || "",
        title: "",
        description: "",
        locationContext: "",
        photoUrl: "",
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const handleContest = async (incidentId: string) => {
    if (!slug) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const feedback = contestFeedback[incidentId];
      await contestIncident(slug, incidentId, feedback);
      setSuccessMsg(
        "Incident marked as 'Still Not Fixed'. Status reopened to In Progress with an immediate +1 escalation penalty."
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to contest incident resolution");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmResolution = async (incidentId: string) => {
    if (!slug) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await confirmIncidentResolution(slug, incidentId);
      setSuccessMsg(
        "Resolution successfully verified! The incident has been transitioned to Closed."
      );
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to confirm resolution");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "New":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "Assigned":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "In Progress":
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case "Resolved":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "Closed":
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  // Find any complaints currently in "Resolved" status awaiting 24-hour verification
  const pendingVerificationComplaints = complaints.filter(
    (c) =>
      c.incident?.status === "Resolved" &&
      (!c.incident.gracePeriodExpiresAt ||
        new Date(c.incident.gracePeriodExpiresAt).getTime() > Date.now())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent"></div>
          <span className="text-xs text-slate-400 font-mono tracking-wider">
            Loading Complainant Portal...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-slate-100 flex flex-col antialiased">
      {/* Navbar */}
      <header className="subtle-glass sticky top-0 z-30 border-b border-obsidian-border bg-obsidian/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-surface">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-none">
                  Complainant Portal
                </h1>
              </div>
              <span className="text-xs text-slate-400 font-mono">/org/{slug}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <NotificationCenter
              slug={slug || ""}
              onRealtimeEvent={() => {
                loadData();
              }}
              onNotificationClick={(notif) => {
                if (notif.complaintId) {
                  const element = document.getElementById(`complaint-${notif.complaintId}`);
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth" });
                    element.classList.add("ring-2", "ring-indigo-500");
                    setTimeout(() => element.classList.remove("ring-2", "ring-indigo-500"), 3000);
                  }
                }
              }}
            />
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-2 rounded-xl bg-obsidian-surface border border-obsidian-border hover:border-obsidian-subtle pressable transition-all duration-200"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-xs font-medium shadow-surface">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-3 text-emerald-300 text-xs font-medium shadow-surface">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
            <p className="leading-relaxed">{successMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Complaint Submission Composer */}
          <div className="lg:col-span-5">
            <div className="bg-obsidian-surface/95 border border-obsidian-border rounded-2xl p-6 shadow-elevated sticky top-24 space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    File a Complaint
                  </h2>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Submissions are blind. Other complainants cannot view your submissions.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="complaint-category"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                    >
                      Category
                    </label>
                    <span className="text-[11px] text-slate-500">Select domain</span>
                  </div>

                  {categories.length === 0 ? (
                    <p className="text-xs text-amber-400">
                      No categories configured by organization administrator.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {/* Tactile Category Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map((cat) => {
                          const isSelected = formData.categoryId === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({ ...prev, categoryId: cat.id }))
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 pressable ${
                                isSelected
                                  ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm"
                                  : "bg-obsidian border-obsidian-border text-slate-400 hover:text-slate-200 hover:border-obsidian-subtle"
                              }`}
                            >
                              {cat.name}
                              <span className="ml-1 text-[10px] text-slate-500 font-mono">
                                {cat.baseSlaHours}h
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Fallback Select for Full Accessibility */}
                      <div className="relative">
                        <select
                          id="complaint-category"
                          required
                          value={formData.categoryId}
                          onChange={(e) =>
                            setFormData({ ...formData, categoryId: e.target.value })
                          }
                          className="w-full bg-obsidian border border-obsidian-border rounded-xl px-3.5 py-2 text-xs text-slate-200 appearance-none focus-ring pr-9 font-mono"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name} ({category.baseSlaHours}h SLA)
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Complaint Title */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="complaint-title"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                    >
                      Title
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {formData.title.length}/100
                    </span>
                  </div>
                  <input
                    id="complaint-title"
                    type="text"
                    required
                    maxLength={100}
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Brief summary of the complaint"
                    className="block w-full px-3.5 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus-ring transition-all duration-200"
                  />
                </div>

                {/* Location Context */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="location-context"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                    >
                      Location Context
                    </label>
                    <span className="text-[10px] text-slate-500">Specific spot</span>
                  </div>
                  <div className="relative">
                    <input
                      id="location-context"
                      type="text"
                      value={formData.locationContext}
                      onChange={(e) =>
                        setFormData({ ...formData, locationContext: e.target.value })
                      }
                      placeholder="e.g. Block C, 3rd Floor, Room 304"
                      className="block w-full pl-9 pr-3.5 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus-ring transition-all duration-200"
                    />
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-400" />
                    Exact physical location accelerates staff dispatch and SLA response.
                  </p>
                </div>

                {/* Detailed Description */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="complaint-description"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                    >
                      Detailed Description
                    </label>
                    <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {formData.description.length}/1000
                    </span>
                  </div>
                  <textarea
                    id="complaint-description"
                    required
                    rows={4}
                    maxLength={1000}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Provide full details regarding what happened and needs attention..."
                    className="block w-full px-3.5 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-xs text-slate-100 placeholder-slate-500 focus-ring transition-all duration-200 resize-none"
                  />
                </div>

                {/* Photo Attachment URL & Evidence Dropzone */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="photo-url"
                      className="block text-xs font-semibold uppercase tracking-wider text-slate-300"
                    >
                      Photo Attachment URL (Optional)
                    </label>
                    <span className="text-[10px] text-slate-500">Image evidence</span>
                  </div>
                  <div className="border border-dashed border-obsidian-border hover:border-obsidian-subtle rounded-xl p-3 bg-obsidian/60 transition-all duration-200 space-y-2">
                    <div className="relative">
                      <input
                        id="photo-url"
                        type="url"
                        value={formData.photoUrl}
                        onChange={(e) =>
                          setFormData({ ...formData, photoUrl: e.target.value })
                        }
                        placeholder="https://example.com/photo.jpg"
                        className="block w-full pl-9 pr-3.5 py-2 bg-obsidian border border-obsidian-border rounded-lg text-xs text-slate-100 placeholder-slate-500 focus-ring transition-all duration-200 font-mono"
                      />
                      <ImageIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-slate-500 text-center">
                      Paste a direct image URL for physical repair evidence verification
                    </p>
                  </div>

                  {/* Visual Thumbnail Preview */}
                  {formData.photoUrl && (
                    <div className="mt-2.5 p-2 rounded-xl bg-obsidian border border-obsidian-border flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={formData.photoUrl}
                          alt="Attachment preview"
                          className="w-12 h-12 object-cover rounded-lg border border-obsidian-border flex-shrink-0 bg-slate-900"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-slate-300 truncate">
                            Evidence preview attached
                          </p>
                          <p className="text-[10px] text-slate-500 truncate font-mono">
                            {formData.photoUrl}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, photoUrl: "" }))}
                        aria-label="Remove photo"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting || categories.length === 0}
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 focus-ring pressable shadow-lg shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center space-x-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{submitting ? "Submitting..." : "Submit Complaint"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Complaints History & Resolution Verification */}
          <div className="lg:col-span-7 space-y-6">
            {/* Top-Level High-Priority 24-Hour Resolution Verification Banner */}
            {pendingVerificationComplaints.length > 0 && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border-2 border-purple-500/40 shadow-glowViolet space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex-shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Action Required
                      </span>
                      <h3 className="text-sm font-bold text-white">
                        Resolution Verification Grace Period ({pendingVerificationComplaints.length})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Staff reported this issue resolved. Is it fixed for you?
                    </p>
                    <p className="text-[11px] text-purple-200/80 leading-relaxed">
                      This incident is in its 24-hour verification grace period. Please confirm if the physical repair was completed to your satisfaction.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {pendingVerificationComplaints.map((pendingComplaint) => (
                    <div
                      key={pendingComplaint.id}
                      className="p-3.5 rounded-xl bg-obsidian/80 border border-purple-500/30 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold text-slate-200">
                            {pendingComplaint.title}
                          </span>
                          <span className="block text-[11px] text-slate-400 font-mono">
                            Category: {pendingComplaint.categoryName || "General"}
                          </span>
                        </div>

                        {pendingComplaint.incident?.gracePeriodExpiresAt && (
                          <div className="flex items-center gap-1.5 text-xs text-purple-300 font-mono tabular-nums">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Grace window:</span>
                            <CountdownTimer
                              deadline={pendingComplaint.incident.gracePeriodExpiresAt}
                              createdAt={pendingComplaint.incident.createdAt || pendingComplaint.createdAt}
                              compact
                            />
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-1">
                        <input
                          type="text"
                          value={contestFeedback[pendingComplaint.incidentId] || ""}
                          onChange={(e) =>
                            setContestFeedback({
                              ...contestFeedback,
                              [pendingComplaint.incidentId]: e.target.value,
                            })
                          }
                          placeholder="Optional explanation of why the issue is still not fixed..."
                          className="w-full bg-obsidian border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder-slate-500"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirmResolution(pendingComplaint.incidentId)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow pressable transition-all duration-200"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Yes, Verified</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleContest(pendingComplaint.incidentId)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow pressable transition-all duration-200"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Still Not Fixed</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complaints Feed Header */}
            <div className="flex items-center justify-between border-b border-obsidian-border pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  My Personal Complaints
                </h2>
                <p className="text-xs text-slate-400">
                  Track dynamic SLA countdowns, corroboration contraction, and physical resolution
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-obsidian border border-obsidian-border text-xs font-mono text-slate-300 tabular-nums">
                  {complaints.length} {complaints.length === 1 ? "Complaint" : "Complaints"}
                </span>
              </div>
            </div>

            {complaints.length === 0 ? (
              <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-12 text-center shadow-surface space-y-3">
                <div className="p-3 rounded-2xl bg-obsidian-muted border border-obsidian-border text-slate-500 inline-block">
                  <FileText className="w-8 h-8" />
                </div>
                <h3 className="text-base font-semibold text-slate-200">
                  No complaints filed yet
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                  When you submit a complaint, an operational Incident will be created and you can track real-time resolution status and SLA deadlines here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {complaints.map((complaint) => {
                  const incident = complaint.incident;
                  const isResolved = incident?.status === "Resolved";

                  return (
                    <div
                      key={complaint.id}
                      id={`complaint-${complaint.id}`}
                      className="bg-obsidian-surface border border-obsidian-border hover:border-obsidian-subtle rounded-2xl p-5 shadow-surface space-y-4 transition-all duration-200"
                    >
                      {/* Card Header: Title, Category, Status & Escalation Tier */}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white tracking-tight">
                            {complaint.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] bg-obsidian-muted border border-obsidian-border px-2 py-0.5 rounded-md text-indigo-300 font-medium">
                              {complaint.categoryName || "General"}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {new Date(complaint.createdAt).toLocaleDateString()}
                            </span>
                            {complaint.locationContext && (
                              <div className="flex items-center text-[11px] text-slate-400 gap-1">
                                <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                                <span>{complaint.locationContext}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${getStatusBadgeClass(
                              incident?.status
                            )}`}
                          >
                            {incident?.status || "New"}
                          </span>
                          <span className="text-xs px-2.5 py-1 rounded-full border border-obsidian-border bg-obsidian text-slate-300 font-mono tabular-nums">
                            Tier {incident?.escalationTier ?? 0}
                          </span>
                        </div>
                      </div>

                      {/* Complaint Description */}
                      <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {complaint.description}
                      </p>

                      {/* Photo evidence preview / link */}
                      {complaint.photoUrl && (
                        <div className="pt-1">
                          <a
                            href={complaint.photoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>View Photo Evidence</span>
                          </a>
                        </div>
                      )}

                      {/* Resolution Verification Grace Period Status on Card */}
                      {isResolved && (
                        <div className="p-3 bg-purple-950/25 border border-purple-500/30 rounded-xl flex items-center justify-between text-xs text-purple-200">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-purple-400 flex-shrink-0" />
                            <span>
                              24-Hour Verification Grace Period active. Action requested in verification panel above.
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Previous Reopen Penalty Notice */}
                      {Boolean(incident?.reopenCount && incident.reopenCount > 0) && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                          <span>
                            This incident was previously contested and reopened (
                            {incident?.reopenCount} time
                            {(incident?.reopenCount ?? 0) > 1 ? "s" : ""}) with an immediate +1 escalation penalty.
                          </span>
                        </div>
                      )}

                      {/* Incident SLA & Corroboration Metrics Section */}
                      <div className="pt-3 border-t border-obsidian-border flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Layers className="w-3.5 h-3.5 text-indigo-400" />
                          <span>
                            Corroboration count:{" "}
                            <strong className="text-slate-200 font-mono tabular-nums">
                              {incident?.corroborationCount ?? 1}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>SLA Deadline:</span>
                          {incident?.slaDeadline ? (
                            <div className="flex items-center gap-1.5">
                              <CountdownTimer
                                deadline={incident.slaDeadline}
                                createdAt={incident.createdAt || complaint.createdAt}
                                compact
                              />
                              <span className="text-slate-500 text-[11px] font-mono">
                                ({new Date(incident.slaDeadline).toLocaleString()})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Pending</span>
                          )}
                        </div>
                      </div>

                      {/* Contraction Audit Timeline */}
                      {incident?.contractionAudit && incident.contractionAudit.length > 0 && (
                        <div className="pt-3 border-t border-obsidian-border">
                          <AuditTimeline entries={incident.contractionAudit} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
