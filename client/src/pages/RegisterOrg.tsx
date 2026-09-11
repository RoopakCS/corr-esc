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

const ARCHITECTURAL_PILLARS = [
  {
    icon: GitMerge,
    iconColor: "text-indigo-400",
    iconBg: "bg-indigo-500/10 border-indigo-500/20",
    title: "Dynamic Corroboration Contraction",
    description:
      "Independent blind complaints automatically accelerate SLA deadlines through a mathematical decay formula down to a safety floor.",
  },
  {
    icon: ShieldAlert,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10 border-amber-500/20",
    title: "Supervisory Multi-Tier Escalation",
    description:
      "When SLAs breach, higher authorities gain oversight while primary assignees remain fully accountable for physical resolution.",
  },
  {
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-500/10 border-emerald-500/20",
    title: "24-Hour Resolution Grace Period",
    description:
      "Resolved incidents require verification. Contested resolutions trigger immediate status reopening with an automatic escalation penalty.",
  },
];

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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const autoSlug = generateSlug(name);
    setFormData((prev) => ({
      ...prev,
      organizationName: name,
      slug: prev.slug === "" || prev.slug === generateSlug(prev.organizationName) ? autoSlug : prev.slug,
    }));
  };

  const isSlugValid =
    formData.slug.length >= 3 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(formData.slug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await registerOrganization(formData);
      if (res.organization?.slug) {
        navigate(`/org/${res.organization.slug}/admin/dashboard`);
      } else {
        navigate(`/org/${formData.slug}/login`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to register organization");
    } finally {
      setLoading(false);
    }
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
            {ARCHITECTURAL_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="flex items-start gap-3.5 p-4 rounded-xl bg-obsidian-surface border border-obsidian-border transition-all duration-tactile hover:border-obsidian-subtle"
                >
                  <div
                    className={`p-2 rounded-lg ${pillar.iconBg} ${pillar.iconColor} border flex-shrink-0 mt-0.5`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">{pillar.title}</h2>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              );
            })}
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
                    Establish a dedicated organization domain for SLA governance and escalation
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
                <label
                  htmlFor="org-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Organization Name
                </label>
                <input
                  id="org-name"
                  type="text"
                  required
                  value={formData.organizationName}
                  onChange={handleNameChange}
                  placeholder="e.g. Saveetha Campus, Apex Towers"
                  className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
                />
              </div>

              <div>
                <label
                  htmlFor="org-slug"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                >
                  Organization URL Slug
                </label>
                <div className="flex rounded-xl overflow-hidden border border-obsidian-border focus-within:ring-2 focus-within:ring-sky-500/70">
                  <span className="inline-flex items-center px-3.5 bg-obsidian-muted text-slate-400 text-xs font-mono border-r border-obsidian-border">
                    /org/
                  </span>
                  <input
                    id="org-slug"
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
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono">
                    {isSlugValid ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Valid domain: /org/{formData.slug}/portal
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Slug must be ≥3 characters (letters, numbers, hyphens)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-obsidian-border space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Organization Admin</span>
                </div>

                <div>
                  <label
                    htmlFor="admin-name"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Admin Full Name
                  </label>
                  <input
                    id="admin-name"
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
                  <label
                    htmlFor="admin-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Admin Email Address
                  </label>
                  <input
                    id="admin-email"
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
                  <label
                    htmlFor="admin-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
                  >
                    Master Password
                  </label>
                  <input
                    id="admin-password"
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

              <div className="pt-2 text-center">
                <p className="text-xs text-slate-400">
                  Need to sign in to an existing organization?{" "}
                  <span className="text-slate-300 font-mono">/org/&lt;slug&gt;/login</span>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
