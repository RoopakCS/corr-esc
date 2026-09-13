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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full size-8 border-2 border-primary border-t-transparent"></div>
          <span className="text-xs text-muted-foreground font-mono tracking-wider">
            Loading Complainant Portal...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-xs">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-none">
                  Complainant Portal
                </h1>
              </div>
              <span className="text-xs text-muted-foreground font-mono">/org/{slug}</span>
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
                    element.classList.add("ring-2", "ring-primary");
                    setTimeout(() => element.classList.remove("ring-2", "ring-primary"), 3000);
                  }
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-semibold h-9 rounded-xl"
            >
              <LogOut className="size-3.5 text-muted-foreground" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col gap-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="text-xs font-medium">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {successMsg && (
          <Alert className="border-emerald-500/30 text-emerald-500">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <AlertDescription className="text-xs font-medium">
              {successMsg}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Complaint Submission Composer */}
          <div className="lg:col-span-5">
            <Card className="rounded-2xl shadow-lg sticky top-24">
              <CardHeader className="p-6 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                    <PlusCircle className="size-4" />
                  </div>
                  <CardTitle className="text-base font-bold text-foreground tracking-tight">
                    File a Complaint
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed">
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
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Category
                      </Label>
                      <span className="text-[11px] text-muted-foreground">Select domain</span>
                    </div>

                    {categories.length === 0 ? (
                      <p className="text-xs text-amber-500">
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
                                className="h-8 px-3 text-xs font-medium rounded-lg"
                              >
                                {cat.name}
                                <span className="ml-1 text-[10px] opacity-70 font-mono">
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
                            className="w-full bg-background border border-input rounded-xl px-3.5 py-2 text-xs text-foreground appearance-none focus-ring pr-9 font-mono"
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name} ({category.baseSlaHours}h SLA)
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="size-4 text-muted-foreground absolute right-3 top-2.5 pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Complaint Title */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="complaint-title"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Title
                      </Label>
                      <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
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
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>

                  {/* Location Context */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="location-context"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Location Context
                      </Label>
                      <span className="text-[10px] text-muted-foreground">Specific spot</span>
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
                        className="pl-9 rounded-xl h-10 text-xs"
                      />
                      <MapPin className="size-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                    </div>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Info className="size-3 text-muted-foreground" />
                      Exact physical location accelerates staff dispatch and SLA response.
                    </p>
                  </div>

                  {/* Detailed Description */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="complaint-description"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Detailed Description
                      </Label>
                      <span className="text-[11px] text-muted-foreground font-mono tabular-nums">
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
                      className="rounded-xl resize-none text-xs"
                    />
                  </div>

                  {/* Photo Attachment URL & Evidence Dropzone */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="photo-url"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Photo Attachment URL (Optional)
                      </Label>
                      <span className="text-[10px] text-muted-foreground">Image evidence</span>
                    </div>
                    <div className="border border-dashed border-border hover:border-muted-foreground/40 rounded-xl p-3 bg-muted/20 transition-all duration-200 flex flex-col gap-2">
                      <div className="relative">
                        <Input
                          id="photo-url"
                          type="url"
                          value={formData.photoUrl}
                          onChange={(e) =>
                            setFormData({ ...formData, photoUrl: e.target.value })
                          }
                          placeholder="https://example.com/photo.jpg"
                          className="pl-9 rounded-lg font-mono h-9 text-xs"
                        />
                        <ImageIcon className="size-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Paste a direct image URL for physical repair evidence verification
                      </p>
                    </div>

                    {/* Visual Thumbnail Preview */}
                    {formData.photoUrl && (
                      <div className="mt-1 p-2 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={formData.photoUrl}
                            alt="Attachment preview"
                            className="size-12 object-cover rounded-lg border border-border flex-shrink-0 bg-muted"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-foreground truncate">
                              Evidence preview attached
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate font-mono">
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
                          className="size-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting || categories.length === 0}
                    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 mt-1"
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
              <Card className="border-2 border-primary/40 shadow-sm rounded-2xl bg-card">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary flex-shrink-0 mt-0.5">
                      <Sparkles className="size-5" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                          Action Required
                        </Badge>
                        <CardTitle className="text-sm font-bold text-foreground">
                          Resolution Verification Grace Period ({pendingVerificationComplaints.length})
                        </CardTitle>
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">
                        Staff reported this issue resolved. Is it fixed for you?
                      </p>
                      <CardDescription className="text-[11px] text-muted-foreground leading-relaxed">
                        This incident is in its 24-hour verification grace period. Please confirm if the physical repair was completed to your satisfaction.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 flex flex-col gap-3">
                  {pendingVerificationComplaints.map((pendingComplaint) => (
                    <div
                      key={pendingComplaint.id}
                      className="p-3.5 rounded-xl bg-muted/30 border border-border flex flex-col gap-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-semibold text-foreground">
                            {pendingComplaint.title}
                          </span>
                          <span className="block text-[11px] text-muted-foreground font-mono">
                            Category: {pendingComplaint.categoryName || "General"}
                          </span>
                        </div>

                        {pendingComplaint.incident?.gracePeriodExpiresAt && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono tabular-nums">
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
                          className="h-9 text-xs"
                        />

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            onClick={() => handleConfirmResolution(pendingComplaint.incidentId)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 h-8 text-xs font-semibold"
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Yes, Verified</span>
                          </Button>

                          <Button
                            type="button"
                            onClick={() => handleContest(pendingComplaint.incidentId)}
                            disabled={actionLoading}
                            variant="destructive"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 h-8 text-xs font-semibold"
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
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  My Personal Complaints
                </h2>
                <p className="text-xs text-muted-foreground">
                  Track dynamic SLA countdowns, corroboration contraction, and physical resolution
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-2.5 py-1 rounded-full text-xs font-mono tabular-nums">
                  {complaints.length} {complaints.length === 1 ? "Complaint" : "Complaints"}
                </Badge>
              </div>
            </div>

            {complaints.length === 0 ? (
              <Card className="rounded-2xl p-12 text-center shadow-xs">
                <CardContent className="flex flex-col items-center gap-3 p-0">
                  <div className="p-3 rounded-2xl bg-muted border text-muted-foreground inline-block">
                    <FileText className="size-8" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">
                    No complaints filed yet
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
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
                      className="rounded-2xl shadow-xs transition-all duration-200"
                    >
                      {/* Card Header: Title, Category, Status & Escalation Tier */}
                      <CardHeader className="p-5 pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <CardTitle className="text-base font-bold text-foreground tracking-tight">
                              {complaint.title}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-[11px] px-2 py-0.5 rounded-md font-medium">
                                {complaint.categoryName || "General"}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {new Date(complaint.createdAt).toLocaleDateString()}
                              </span>
                              {complaint.locationContext && (
                                <div className="flex items-center text-[11px] text-muted-foreground gap-1">
                                  <MapPin className="size-3 text-muted-foreground flex-shrink-0" />
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
                            <Badge variant="outline" className="text-xs px-2.5 py-1 rounded-full font-mono tabular-nums">
                              Tier {incident?.escalationTier ?? 0}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="p-5 pt-0 flex flex-col gap-3">
                        {/* Complaint Description */}
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                          {complaint.description}
                        </p>

                        {/* Photo evidence preview / link */}
                        {complaint.photoUrl && (
                          <div>
                            <a
                              href={complaint.photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium transition"
                            >
                              <ImageIcon className="size-3.5" />
                              <span>View Photo Evidence</span>
                            </a>
                          </div>
                        )}

                        {/* Resolution Verification Grace Period Status on Card */}
                        {isResolved && (
                          <Alert className="p-3 border-primary/30 rounded-xl text-xs">
                            <AlertCircle className="size-4 text-primary flex-shrink-0" />
                            <AlertDescription className="text-xs">
                              24-Hour Verification Grace Period active. Action requested in verification panel above.
                            </AlertDescription>
                          </Alert>
                        )}

                        {/* Previous Reopen Penalty Notice */}
                        {Boolean(incident?.reopenCount && incident.reopenCount > 0) && (
                          <Alert variant="destructive" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs">
                            <AlertCircle className="size-3.5 flex-shrink-0" />
                            <AlertDescription className="text-xs">
                              This incident was previously contested and reopened (
                              {incident?.reopenCount} time
                              {(incident?.reopenCount ?? 0) > 1 ? "s" : ""}) with an immediate +1 escalation penalty.
                            </AlertDescription>
                          </Alert>
                        )}

                        <Separator className="my-1" />

                        {/* Incident SLA & Corroboration Metrics Section */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Layers className="size-3.5 text-primary" />
                            <span>
                              Corroboration count:{" "}
                              <strong className="text-foreground font-mono tabular-nums">
                                {incident?.corroborationCount ?? 1}
                              </strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="size-3.5 text-amber-500" />
                            <span>SLA Deadline:</span>
                            {incident?.slaDeadline ? (
                              <div className="flex items-center gap-1.5">
                                <CountdownTimer
                                  deadline={incident.slaDeadline}
                                  createdAt={incident.createdAt || complaint.createdAt}
                                  compact
                                />
                                <span className="text-muted-foreground text-[11px] font-mono">
                                  ({new Date(incident.slaDeadline).toLocaleString()})
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Pending</span>
                            )}
                          </div>
                        </div>

                        {/* Contraction Audit Timeline */}
                        {incident?.contractionAudit && incident.contractionAudit.length > 0 && (
                          <div className="pt-2">
                            <Separator className="mb-3" />
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
