import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAdminDashboard, clearToken, DashboardResponse } from "../services/api.js";
import { Building, Shield, User, LogOut, CheckCircle, Clock } from "lucide-react";

export function AdminDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getAdminDashboard(slug)
      .then((res) => {
        setDashboard(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [slug]);

  const handleLogout = () => {
    clearToken();
    navigate(`/org/${slug}/login`);
  };

  const handleAccessDeniedRedirect = () => {
    clearToken();
    navigate(`/org/${slug}/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center space-x-3">
          <Clock className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-slate-300 font-medium">Loading organization dashboard...</span>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white px-4">
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-300 mb-6">{error || "Failed to load dashboard"}</p>
          <button
            onClick={handleAccessDeniedRedirect}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Building className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{dashboard.organization.name}</h1>
            <p className="text-xs text-slate-400">/org/{dashboard.organization.slug}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-200">{dashboard.admin.role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-red-400 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-indigo-900/40 via-indigo-950/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 mb-3">
                <CheckCircle className="w-3.5 h-3.5" /> Organization Active
              </span>
              <h2 className="text-2xl font-extrabold text-white">
                Welcome back, {dashboard.admin.name}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Your organization is active and configured for corroboration-driven SLA escalation.
              </p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Building className="w-4 h-4 text-indigo-400" /> Organization Profile
            </div>
            <div className="text-lg font-bold text-white">{dashboard.organization.name}</div>
            <div className="text-xs text-slate-400">
              Slug: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300">{dashboard.organization.slug}</code>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-400" /> Admin Profile
            </div>
            <div className="text-lg font-bold text-white">{dashboard.admin.name}</div>
            <div className="text-xs text-slate-400">{dashboard.admin.email}</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-400" /> Escalation Engine Status
            </div>
            <div className="text-lg font-bold text-emerald-400">Ready for Setup</div>
            <div className="text-xs text-slate-400">Ready for Ticket 02 Category & SLA configuration</div>
          </div>
        </div>
      </main>
    </div>
  );
}
