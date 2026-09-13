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
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
          <div className="animate-spin rounded-full size-8 border-2 border-indigo-500 border-t-transparent"></div>
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
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-surface">
              <FileText className="size-5" />
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
          <div className="flex items-center gap-3">
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-obsidian-surface border-obsidian-border hover:border-obsidian-subtle pressable h-9 rounded-xl"
            >
              <LogOut className="size-3.5 text-slate-400" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col gap-6">
        {error && (
          <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/30 text-rose-300">
            <AlertCircle className="size-4 text-rose-400" />
            <AlertDescription className="text-xs font-medium">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {successMsg && (
          <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <AlertDescription className="text-xs font-medium">
              {successMsg}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Complaint Submission Composer */}
          <div className="lg:col-span-5">
            <Card className="bg-obsidian-surface/95 border-obsidian-border rounded-2xl shadow-elevated sticky top-24 text-slate-100">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <PlusCircle className="size-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-white tracking-tight">
                    File a Complaint
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-400 leading-relaxed">
                  Submissions are blind. Other complainants cannot view your submissions.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 pt-0">
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* Category selection */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="complaint-category"
                        className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                      >
                        Category
                      </Label>
                      <span className="text-[11px] text-slate-500">Select domain</span>
                    </div>

                    {categories.length === 0 ? (
                      <p className="text-xs text-amber-400">
                        No categories configured by organization administrator.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {/* Tactile Category Chips */}
                        <div className="flex flex-wrap gap-1.5">
                          {categories.map((cat) => {
                            const isSelected = formData.categoryId === cat.id;
                            return (
                              <Button
                                key={cat.id}
                                type="button"
                                variant={isSelected ? "default" : "outline"}
                                size="sm"
                                onClick={() =>
                                  setFormData((prev) => ({ ...prev, categoryId: cat.id }))
                                }
                                className={`h-8 px-3 text-xs font-medium rounded-lg border transition-all duration-200 pressable ${
                                  isSelected
                                    ? "bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm hover:bg-indigo-600/30"
                                    : "bg-obsidian border-obsidian-border text-slate-400 hover:text-slate-200 hover:border-obsidian-subtle hover:bg-obsidian-hover"
                                }`}
                              >
                                {cat.name}
                                <span className="ml-1 text-[10px] text-slate-500 font-mono">
                                  {cat.baseSlaHours}h
                                </span>
                              </Button>
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
                          <ChevronDown className="size-4 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Complaint Title */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="complaint-title"
                        className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                      >
                        Title
                      </Label>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {formData.title.length}/100
                      </span>
                    </div>
                    <Input
                      id="complaint-title"
                      type="text"
                      required
                      maxLength={100}
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="Brief summary of the complaint"
                      className="bg-obsidian border-obsidian-border text-xs text-slate-100 placeholder:text-slate-500 focus-ring rounded-xl h-10"
                    />
                  </div>

                  {/* Location Context */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="location-context"
                        className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                      >
                        Location Context
                      </Label>
                      <span className="text-[10px] text-slate-500">Specific spot</span>
                    </div>
                    <div className="relative">
                      <Input
                        id="location-context"
                        type="text"
                        value={formData.locationContext}
                        onChange={(e) =>
                          setFormData({ ...formData, locationContext: e.target.value })
                        }
                        placeholder="e.g. Block C, 3rd Floor, Room 304"
                        className="bg-obsidian border-obsidian-border pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus-ring rounded-xl h-10"
                      />
                      <MapPin className="size-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Info className="size-3 text-slate-400" />
                      Exact physical location accelerates staff dispatch and SLA response.
                    </p>
                  </div>

                  {/* Detailed Description */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="complaint-description"
                        className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                      >
                        Detailed Description
                      </Label>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {formData.description.length}/1000
                      </span>
                    </div>
                    <Textarea
                      id="complaint-description"
                      required
                      rows={4}
                      maxLength={1000}
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      placeholder="Provide full details regarding what happened and needs attention..."
                      className="bg-obsidian border-obsidian-border text-xs text-slate-100 placeholder:text-slate-500 focus-ring rounded-xl resize-none"
                    />
                  </div>

                  {/* Photo Attachment URL & Evidence Dropzone */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="photo-url"
                        className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                      >
                        Photo Attachment URL (Optional)
                      </Label>
                      <span className="text-[10px] text-slate-500">Image evidence</span>
                    </div>
                    <div className="border border-dashed border-obsidian-border hover:border-obsidian-subtle rounded-xl p-3 bg-obsidian/60 transition-all duration-200 flex flex-col gap-2">
                      <div className="relative">
                        <Input
                          id="photo-url"
                          type="url"
                          value={formData.photoUrl}
                          onChange={(e) =>
                            setFormData({ ...formData, photoUrl: e.target.value })
                          }
                          placeholder="https://example.com/photo.jpg"
                          className="bg-obsidian border-obsidian-border pl-9 text-xs text-slate-100 placeholder:text-slate-500 focus-ring rounded-lg font-mono h-9"
                        />
                        <ImageIcon className="size-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-slate-500 text-center">
                        Paste a direct image URL for physical repair evidence verification
                      </p>
                    </div>

                    {/* Visual Thumbnail Preview */}
                    {formData.photoUrl && (
                      <div className="mt-1 p-2 rounded-xl bg-obsidian border border-obsidian-border flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={formData.photoUrl}
                            alt="Attachment preview"
                            className="size-12 object-cover rounded-lg border border-obsidian-border flex-shrink-0 bg-slate-900"
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setFormData((prev) => ({ ...prev, photoUrl: "" }))}
                          aria-label="Remove photo"
                          className="size-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || categories.length === 0}
                    className="w-full h-11 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 focus-ring pressable shadow-lg shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center gap-2 mt-1"
                  >
                    <PlusCircle className="size-4" />
                    <span>{submitting ? "Submitting..." : "Submit Complaint"}</span>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Complaints History & Resolution Verification */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Top-Level High-Priority 24-Hour Resolution Verification Banner */}
            {pendingVerificationComplaints.length > 0 && (
              <Card className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-purple-950/40 border-2 border-purple-500/40 shadow-glowViolet text-slate-100 rounded-2xl">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex-shrink-0 mt-0.5">
                      <Sparkles className="size-5 animate-pulse" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border-purple-500/30">
                          Action Required
                        </Badge>
                        <CardTitle className="text-sm font-bold text-white">
                          Resolution Verification Grace Period ({pendingVerificationComplaints.length})
                        </CardTitle>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Staff reported this issue resolved. Is it fixed for you?
                      </p>
                      <CardDescription className="text-[11px] text-purple-200/80 leading-relaxed">
                        This incident is in its 24-hour verification grace period. Please confirm if the physical repair was completed to your satisfaction.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 flex flex-col gap-3">
                  {pendingVerificationComplaints.map((pendingComplaint) => (
                    <div
                      key={pendingComplaint.id}
                      className="p-3.5 rounded-xl bg-obsidian/80 border border-purple-500/30 flex flex-col gap-3"
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
                            <Clock className="size-3.5" />
                            <span>Grace window:</span>
                            <CountdownTimer
                              deadline={pendingComplaint.incident.gracePeriodExpiresAt}
                              createdAt={pendingComplaint.incident.createdAt || pendingComplaint.createdAt}
                              compact
                            />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 pt-1">
                        <Input
                          type="text"
                          value={contestFeedback[pendingComplaint.incidentId] || ""}
                          onChange={(e) =>
                            setContestFeedback({
                              ...contestFeedback,
                              [pendingComplaint.incidentId]: e.target.value,
                            })
                          }
                          placeholder="Optional explanation of why the issue is still not fixed..."
                          className="bg-obsidian border-purple-500/40 text-xs text-white focus-visible:ring-rose-500 placeholder:text-slate-500 h-9"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => handleConfirmResolution(pendingComplaint.incidentId)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 h-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow pressable"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Yes, Verified</span>
                          </Button>

                          <Button
                            type="button"
                            onClick={() => handleContest(pendingComplaint.incidentId)}
                            disabled={actionLoading}
                            variant="destructive"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 h-8 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow pressable"
                          >
                            <AlertCircle className="size-3.5" />
                            <span>Still Not Fixed</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
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
                <Badge variant="outline" className="px-2.5 py-1 rounded-full bg-obsidian border-obsidian-border text-xs font-mono text-slate-300 tabular-nums">
                  {complaints.length} {complaints.length === 1 ? "Complaint" : "Complaints"}
                </Badge>
              </div>
            </div>

            {complaints.length === 0 ? (
              <Card className="bg-obsidian-surface border-obsidian-border rounded-2xl p-12 text-center shadow-surface text-slate-100">
                <CardContent className="flex flex-col items-center gap-3 p-0">
                  <div className="p-3 rounded-2xl bg-obsidian-muted border border-obsidian-border text-slate-500 inline-block">
                    <FileText className="size-8" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-200">
                    No complaints filed yet
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    When you submit a complaint, an operational Incident will be created and you can track real-time resolution status and SLA deadlines here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col gap-4">
                {complaints.map((complaint) => {
                  const incident = complaint.incident;
                  const isResolved = incident?.status === "Resolved";

                  return (
                    <Card
                      key={complaint.id}
                      id={`complaint-${complaint.id}`}
                      className="bg-obsidian-surface border-obsidian-border hover:border-obsidian-subtle rounded-2xl shadow-surface transition-all duration-200 text-slate-100"
                    >
                      {/* Card Header: Title, Category, Status & Escalation Tier */}
                      <CardHeader className="p-5 pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-bold text-white tracking-tight">
                              {complaint.title}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[11px] bg-obsidian-muted border-obsidian-border px-2 py-0.5 rounded-md text-indigo-300 font-medium">
                                {complaint.categoryName || "General"}
                              </Badge>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {new Date(complaint.createdAt).toLocaleDateString()}
                              </span>
                              {complaint.locationContext && (
                                <div className="flex items-center text-[11px] text-slate-400 gap-1">
                                  <MapPin className="size-3 text-slate-500 flex-shrink-0" />
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
                            <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full border-obsidian-border bg-obsidian text-slate-300 font-mono tabular-nums">
                              Tier {incident?.escalationTier ?? 0}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-5 pt-0 flex flex-col gap-3">
                        {/* Complaint Description */}
                        <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {complaint.description}
                        </p>

                        {/* Photo evidence preview / link */}
                        {complaint.photoUrl && (
                          <div>
                            <a
                              href={complaint.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                            >
                              <ImageIcon className="size-3.5" />
                              <span>View Photo Evidence</span>
                            </a>
                          </div>
                        )}

                        {/* Resolution Verification Grace Period Status on Card */}
                        {isResolved && (
                          <Alert className="p-3 bg-purple-950/25 border border-purple-500/30 rounded-xl text-xs text-purple-200">
                            <AlertCircle className="size-4 text-purple-400 flex-shrink-0" />
                            <AlertDescription className="text-xs">
                              24-Hour Verification Grace Period active. Action requested in verification panel above.
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Previous Reopen Penalty Notice */}
                        {Boolean(incident?.reopenCount && incident.reopenCount > 0) && (
                          <Alert variant="destructive" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                            <AlertCircle className="size-3.5 text-rose-400 flex-shrink-0" />
                            <AlertDescription className="text-xs">
                              This incident was previously contested and reopened (
                              {incident?.reopenCount} time
                              {(incident?.reopenCount ?? 0) > 1 ? "s" : ""}) with an immediate +1 escalation penalty.
                            </AlertDescription>
                          </Alert>
                        )}

                        <Separator className="bg-obsidian-border my-1" />

                        {/* Incident SLA & Corroboration Metrics Section */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Layers className="size-3.5 text-indigo-400" />
                            <span>
                              Corroboration count:{" "}
                              <strong className="text-slate-200 font-mono tabular-nums">
                                {incident?.corroborationCount ?? 1}
                              </strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="size-3.5 text-amber-400" />
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
                          <div className="pt-2">
                            <Separator className="bg-obsidian-border mb-3" />
                            <AuditTimeline entries={incident.contractionAudit} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
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
