import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { registerComplainant } from "../services/api.js";
import { UserPlus, AlertCircle, ShieldCheck, ArrowLeft } from "lucide-react";

export function RegisterComplainant() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await registerComplainant(slug, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });
      navigate(`/org/${slug}/portal`);
    } catch (err: any) {
      setError(err.message || "Failed to register account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 shadow-surface">
            <UserPlus className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Complainant Registration
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-obsidian-surface border border-obsidian-border text-xs font-mono text-emerald-400">
            <span>/org/{slug}</span>
          </div>
        </div>

        {/* Privacy reassurance callout */}
        <div className="p-3.5 rounded-xl bg-obsidian-surface border border-obsidian-border text-xs text-slate-300 flex items-start gap-3 shadow-surface">
          <ShieldCheck className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
          <p className="leading-relaxed text-[11px] text-slate-400">
            <span className="font-semibold text-slate-200">Blind Complaint Ingestion:</span> All submitted reports are processed independently without public exposure, ensuring unbiased SLA clustering and dynamic acceleration.
          </p>
        </div>

        <div className="bg-obsidian-surface/95 border border-obsidian-border py-8 px-6 shadow-elevated rounded-2xl sm:px-8 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-xs font-medium text-rose-300">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. John Doe"
                className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="you@domain.com"
                className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Password
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                placeholder="••••••••"
                className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus-ring pressable shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all duration-tactile"
            >
              {loading ? "Creating Account..." : "Create Complainant Account"}
            </button>
          </form>

          <div className="pt-4 border-t border-obsidian-border text-center text-xs text-slate-400 space-y-2">
            <div>
              <span>Already have an account? </span>
              <Link
                to={`/org/${slug}/login`}
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition"
              >
                Sign In
              </Link>
            </div>
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-400 transition text-[11px]"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Return to organization setup</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
