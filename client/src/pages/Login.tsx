import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { login } from "../services/api.js";
import { LogIn, AlertCircle, User, Shield, Briefcase, ArrowLeft } from "lucide-react";

export function Login() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setLoading(true);

    try {
      const res = await login(slug, email, password);
      if (res.user?.role === "Complainant") {
        navigate(`/org/${slug}/portal`);
      } else if (res.user?.role === "Staff") {
        navigate(`/org/${slug}/staff/dashboard`);
      } else {
        navigate(`/org/${slug}/admin/dashboard`);
      }
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 shadow-surface">
            <LogIn className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Sign in to Organization
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-obsidian-surface border border-obsidian-border text-xs font-mono text-indigo-400">
            <span>/org/{slug}</span>
          </div>
        </div>

        <div className="bg-obsidian-surface/95 border border-obsidian-border py-8 px-6 shadow-elevated rounded-2xl sm:px-8 space-y-6">
          {/* Role access directory pill */}
          <div className="p-3 rounded-xl bg-obsidian-muted border border-obsidian-border text-[11px] text-slate-400 space-y-1.5">
            <span className="font-semibold text-slate-300 block uppercase tracking-wider text-[10px]">
              Universal Portal Access
            </span>
            <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="p-1.5 rounded-lg bg-obsidian border border-obsidian-border/60">
                <User className="w-3 h-3 mx-auto mb-1 text-slate-400" />
                <span>Complainant</span>
              </div>
              <div className="p-1.5 rounded-lg bg-obsidian border border-obsidian-border/60">
                <Briefcase className="w-3 h-3 mx-auto mb-1 text-slate-400" />
                <span>Staff</span>
              </div>
              <div className="p-1.5 rounded-lg bg-obsidian border border-obsidian-border/60">
                <Shield className="w-3 h-3 mx-auto mb-1 text-slate-400" />
                <span>Admin Console</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start space-x-3 text-xs font-medium text-rose-300">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
                className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full px-4 py-2.5 bg-obsidian border border-obsidian-border rounded-xl text-slate-100 placeholder-slate-500 focus-ring transition-all duration-tactile"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus-ring pressable shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all duration-tactile"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <div className="pt-4 border-t border-obsidian-border flex flex-col space-y-2 text-center text-xs text-slate-400">
            <div>
              <span>New complainant? </span>
              <Link
                to={`/org/${slug}/register`}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition"
              >
                Register Account
              </Link>
            </div>
            <div>
              <Link
                to="/"
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-400 transition text-[11px]"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Switch or create another organization</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
