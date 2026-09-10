import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getMyComplaints,
  getCategories,
  submitComplaint,
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
} from "lucide-react";
import { CountdownTimer } from "../components/CountdownTimer.js";
import { AuditTimeline } from "../components/AuditTimeline.js";

export function ComplainantPortal() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    categoryId: "",
    title: "",
    description: "",
    locationContext: "",
    photoUrl: "",
  });

  const loadData = async () => {
    if (!slug) return;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none">Complainant Portal</h1>
              <span className="text-xs text-slate-400 font-mono">/org/{slug}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 text-sm text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300 font-medium">{error}</p>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-300 font-medium">{successMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Submit Complaint Form */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl sticky top-24">
              <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
                <PlusCircle className="w-5 h-5 text-indigo-400" />
                File a Complaint
              </h2>
              <p className="text-xs text-slate-400 mb-5">
                Submissions are blind. Other complainants cannot view your submissions.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Category
                  </label>
                  {categories.length === 0 ? (
                    <p className="text-xs text-amber-400">
                      No categories configured by organization administrator.
                    </p>
                  ) : (
                    <div className="relative">
                      <select
                        required
                        value={formData.categoryId}
                        onChange={(e) =>
                          setFormData({ ...formData, categoryId: e.target.value })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                      >
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name} ({category.baseSlaHours}h SLA)
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Brief summary of the complaint"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Location Context
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.locationContext}
                      onChange={(e) =>
                        setFormData({ ...formData, locationContext: e.target.value })
                      }
                      placeholder="e.g. Block C, 3rd Floor, Room 304"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Detailed Description
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Provide full details regarding what happened and needs attention..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Photo Attachment URL (Optional)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={formData.photoUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, photoUrl: e.target.value })
                      }
                      placeholder="https://example.com/photo.jpg"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <ImageIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || categories.length === 0}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{submitting ? "Submitting..." : "Submit Complaint"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Complaints History List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">My Personal Complaints</h2>
              <span className="text-xs text-slate-400">
                {complaints.length} {complaints.length === 1 ? "Complaint" : "Complaints"}
              </span>
            </div>

            {complaints.length === 0 ? (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-12 text-center">
                <FileText className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300">
                  No complaints filed yet
                </h3>
                <p className="text-sm text-slate-400 max-w-sm mx-auto mt-1">
                  When you submit a complaint, an operational Incident will be created and you can track real-time resolution status and SLA deadlines here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <div
                    key={complaint.id}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-lg space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {complaint.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-indigo-300 font-medium">
                            {complaint.categoryName || "General"}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(complaint.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${getStatusBadgeClass(
                            complaint.incident?.status
                          )}`}
                        >
                          {complaint.incident?.status || "New"}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900/60 text-slate-300 font-mono">
                          Tier {complaint.incident?.escalationTier ?? 0}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-300 whitespace-pre-wrap">
                      {complaint.description}
                    </p>

                    {complaint.locationContext && (
                      <div className="flex items-center text-xs text-slate-400 gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{complaint.locationContext}</span>
                      </div>
                    )}

                    {complaint.photoUrl && (
                      <div className="pt-2">
                        <a
                          href={complaint.photoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          View Photo Evidence
                        </a>
                      </div>
                    )}

                    {/* Incident SLA and Corroboration Metadata */}
                    <div className="pt-3 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>
                          Corroboration count:{" "}
                          <strong className="text-slate-200">
                            {complaint.incident?.corroborationCount ?? 1}
                          </strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>SLA Deadline:</span>
                        {complaint.incident?.slaDeadline ? (
                          <div className="flex items-center gap-1.5">
                            <CountdownTimer
                              deadline={complaint.incident.slaDeadline}
                              createdAt={complaint.incident?.createdAt || complaint.createdAt}
                              compact
                            />
                            <span className="text-slate-400 text-[11px]">
                              ({new Date(complaint.incident.slaDeadline).toLocaleString()})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Pending</span>
                        )}
                      </div>
                    </div>

                    {complaint.incident?.contractionAudit &&
                      complaint.incident.contractionAudit.length > 0 && (
                        <div className="pt-3 border-t border-slate-700/60">
                          <AuditTimeline entries={complaint.incident.contractionAudit} />
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
