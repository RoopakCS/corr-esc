import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerOrganization } from "../services/api.js";
import { generateSlug, cleanSlugInput } from "../utils/slug.js";
import {
  Building2,
  ShieldCheck,
  AlertCircle,
  GitMerge,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export function RegisterOrg() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    organizationName: "",
    slug: "",
    adminName: "",
    adminEmail: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await registerOrganization(formData);
      if (res.organization?.slug) {
        navigate(`/org/${res.organization.slug}/admin/dashboard`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to register organization");
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const autoSlug = generateSlug(name);

    setFormData((prev) => ({
      ...prev,
      organizationName: name,
      slug: prev.slug === "" || prev.slug === generateSlug(prev.organizationName) ? autoSlug : prev.slug,
    }));
  };

  return (
    <div className="min-h-screen bg-obsidian text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Institutional Value Proposition & Architecture */}
        <div className="lg:col-span-6 space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Decentralized Grievance Escalation Engine</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              CORR-ESC
            </h1>
            <p className="text-base sm:text-lg text-slate-400 leading-relaxed max-w-xl">
              A corroboration-driven SLA escalation framework for decentralized grievance resolution across arbitrary institutional and organizational domains.
            </p>
          </div>

          {/* Architectural Pillars */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-obsidian-surface border border-obsidian-border transition-all duration-tactile hover:border-obsidian-subtle">
              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex-shrink-0 mt-0.5">
                <GitMerge className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Dynamic Corroboration Contraction</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Independent blind complaints automatically accelerate SLA deadlines through a mathematical decay formula down to a safety floor.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-obsidian-surface border border-obsidian-border transition-all duration-tactile hover:border-obsidian-subtle">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex-shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">Supervisory Multi-Tier Escalation</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  When SLAs breach, higher authorities gain oversight while primary assignees remain fully accountable for physical resolution.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-obsidian-surface border border-obsidian-border transition-all duration-tactile hover:border-obsidian-subtle">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-200">24-Hour Resolution Grace Period</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Resolved incidents require verification. Contested resolutions trigger immediate status reopening with an automatic escalation penalty.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Organization Registration Console */}
        <div className="lg:col-span-6">
          <div className="bg-obsidian-surface/95 border border-obsidian-border p-6 sm:p-8 rounded-2xl shadow-elevated space-y-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    Create Organization
                  </h2>
                  <p className="text-xs text-slate-400">
                    Establish an isolated workspace for your facility or campus
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-rose-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.organizationName}
                  onChange={handleNameChange}
                  placeholder="e.g. Saveetha Campus, Apex Towers"
                  className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Organization URL Slug
                </label>
                <div className="flex rounded-xl overflow-hidden border border-obsidian-border focus-within:ring-2 focus-within:ring-sky-500/70">
                  <span className="inline-flex items-center px-3.5 bg-obsidian-muted text-slate-400 text-xs font-mono border-r border-obsidian-border">
                    /org/
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: cleanSlugInput(e.target.value) })
                    }
                    placeholder="saveetha-campus"
                    className="flex-1 block w-full px-4 py-2.5 bg-obsidian text-slate-100 placeholder-slate-500 text-sm font-mono focus:outline-none"
                  />
                </div>
                {formData.slug && (
                  <p className="text-[11px] text-slate-500 font-mono mt-1.5">
                    Portal: /org/{formData.slug}/portal
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-obsidian-border space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Administrative Owner</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Admin Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.adminName}
                    onChange={(e) =>
                      setFormData({ ...formData, adminName: e.target.value })
                    }
                    placeholder="e.g. Dr. Hemavathy"
                    className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Admin Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.adminEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, adminEmail: e.target.value })
                    }
                    placeholder="admin@organization.com"
                    className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Master Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus-ring pressable shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all duration-tactile"
              >
                {loading ? "Creating Organization..." : "Create Organization"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
