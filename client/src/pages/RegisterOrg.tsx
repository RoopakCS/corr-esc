import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerOrganization } from "../services/api.js";
import { generateSlug, cleanSlugInput } from "../utils/slug.js";
import { Building2, ShieldCheck, AlertCircle } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight">
          CORR-ESC
        </h2>
        <p className="mt-2 text-center text-sm text-slate-300">
          Create a new organization for corroboration-driven resolution
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800/80 backdrop-blur border border-slate-700 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-300 font-medium">{error}</p>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-200">
                Organization Name
              </label>
              <input
                type="text"
                required
                value={formData.organizationName}
                onChange={handleNameChange}
                placeholder="e.g. Saveetha Campus, Apex Towers"
                className="mt-1 block w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200">
                Organization URL Slug
              </label>
              <div className="mt-1 flex rounded-xl shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-700 bg-slate-900/80 text-slate-400 text-xs">
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
                  className="flex-1 block w-full min-w-0 px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-r-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 mb-3">
                <ShieldCheck className="w-4 h-4" /> Initial Admin Account
              </span>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200">
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
                    className="mt-1 block w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200">
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
                    className="mt-1 block w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200">
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
                    className="mt-1 block w-full px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
            >
              {loading ? "Creating Organization..." : "Create Organization"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
