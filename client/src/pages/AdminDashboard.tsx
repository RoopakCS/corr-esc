import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAdminDashboard,
  clearToken,
  DashboardResponse,
  getCategories,
  createCategory,
  updateCategory,
  getStaff,
  createStaff,
  Category,
  CategoryPayload,
  StaffMember,
} from "../services/api.js";
import {
  Building,
  Shield,
  User,
  LogOut,
  CheckCircle,
  Clock,
  Plus,
  Edit2,
  AlertCircle,
  Layers,
  Sliders,
  X,
  PlusCircle,
  Trash2,
  Users,
  UserPlus,
} from "lucide-react";

const DEFAULT_CATEGORY_FORM: CategoryPayload = {
  name: "",
  baseSlaHours: 24,
  floorHours: 2,
  contractionFactor: 0.2,
  tierTargets: [{ tier: 1, targetRole: "Supervisor" }],
};

export function AdminDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [activeTab, setActiveTab] = useState<"categories" | "staff">("categories");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Category Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryPayload>(DEFAULT_CATEGORY_FORM);
  const [modalError, setModalError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  // Staff Modal State
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    password: "",
    categoryPoolIds: [] as string[],
  });
  const [staffModalError, setStaffModalError] = useState<string | null>(null);
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    if (!slug) return;
    Promise.all([getAdminDashboard(slug), getCategories(slug), getStaff(slug)])
      .then(([dashRes, catRes, staffRes]) => {
        setDashboard(dashRes);
        setCategories(catRes);
        setStaffList(staffRes);
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

  const openCreateModal = () => {
    setEditingCategory(null);
    setCategoryForm(DEFAULT_CATEGORY_FORM);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      baseSlaHours: cat.baseSlaHours,
      floorHours: cat.floorHours,
      contractionFactor: cat.contractionFactor,
      tierTargets:
        cat.tierTargets.length > 0
          ? cat.tierTargets.map((t, idx) => ({
              tier: idx + 1,
              targetRole: t.targetRole || t.supervisorRole || "Supervisor",
            }))
          : [{ tier: 1, targetRole: "Supervisor" }],
    });
    setModalError(null);
    setIsModalOpen(true);
  };

  const addTierTarget = () => {
    const nextTier = (categoryForm.tierTargets?.length || 0) + 1;
    setCategoryForm((prev) => ({
      ...prev,
      tierTargets: [
        ...(prev.tierTargets || []),
        { tier: nextTier, targetRole: `Tier ${nextTier} Supervisor` },
      ],
    }));
  };

  const removeTierTarget = (index: number) => {
    setCategoryForm((prev) => {
      const remaining = (prev.tierTargets || []).filter((_, i) => i !== index);
      // Re-index remaining tiers sequentially
      const reindexed = remaining.map((t, i) => ({
        ...t,
        tier: i + 1,
      }));
      return { ...prev, tierTargets: reindexed };
    });
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setModalError(null);

    if (categoryForm.floorHours >= categoryForm.baseSlaHours) {
      setModalError("Minimum floor hours must be less than base SLA hours");
      return;
    }

    if (
      categoryForm.contractionFactor <= 0 ||
      categoryForm.contractionFactor >= 1
    ) {
      setModalError("Contraction factor must be between 0.01 and 0.99");
      return;
    }

    setSavingCategory(true);
    try {
      if (editingCategory) {
        const updated = await updateCategory(slug, editingCategory.id, categoryForm);
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      } else {
        const created = await createCategory(slug, categoryForm);
        setCategories((prev) => [...prev, created]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setModalError(err.message || "Failed to save category");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setStaffModalError(null);
    setSavingStaff(true);

    try {
      const created = await createStaff(slug, staffForm);
      setStaffList((prev) => [...prev, created]);
      setIsStaffModalOpen(false);
      setStaffForm({
        name: "",
        email: "",
        password: "",
        categoryPoolIds: [],
      });
    } catch (err: any) {
      setStaffModalError(err.message || "Failed to provision staff");
    } finally {
      setSavingStaff(false);
    }
  };

  const toggleCategoryPool = (categoryId: string) => {
    setStaffForm((prev) => {
      const exists = prev.categoryPoolIds.includes(categoryId);
      return {
        ...prev,
        categoryPoolIds: exists
          ? prev.categoryPoolIds.filter((id) => id !== categoryId)
          : [...prev.categoryPoolIds, categoryId],
      };
    });
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
                Configure your problem categories and dynamic SLA contraction parameters below.
              </p>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <Layers className="w-4 h-4 text-indigo-400" /> Configured Categories
            </div>
            <div className="text-lg font-bold text-emerald-400">{categories.length} Categories</div>
            <div className="text-xs text-slate-400">Driving dynamic SLA contraction</div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-400" /> Active Staff
            </div>
            <div className="text-lg font-bold text-sky-400">{staffList.length} Staff Members</div>
            <div className="text-xs text-slate-400">Assigned to category pools</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 space-x-6">
          <button
            onClick={() => setActiveTab("categories")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === "categories"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Problem Categories ({categories.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
              activeTab === "staff"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff & Category Pools ({staffList.length})</span>
          </button>
        </div>

        {/* Categories Section */}
        {activeTab === "categories" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" /> Problem Categories & Dynamic SLA Configuration
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Define baseline deadlines, minimum contraction safety floors, and escalation tier targets for each domain category.
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white shadow transition"
              >
                <Plus className="w-4 h-4" /> Add Category
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3">
                <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No categories configured yet for this organization.</p>
                <button
                  onClick={openCreateModal}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
                >
                  Create your first category
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-4 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <h4 className="font-bold text-base text-white">{cat.name}</h4>
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                          title="Edit Category SLA"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-center">
                        <div className="bg-slate-900/60 p-2 rounded-lg">
                          <span className="block text-[10px] uppercase font-semibold text-slate-500">Base SLA</span>
                          <span className="text-sm font-bold text-indigo-400">{cat.baseSlaHours}h</span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded-lg">
                          <span className="block text-[10px] uppercase font-semibold text-slate-500">Floor</span>
                          <span className="text-sm font-bold text-amber-400">{cat.floorHours}h</span>
                        </div>
                        <div className="bg-slate-900/60 p-2 rounded-lg">
                          <span className="block text-[10px] uppercase font-semibold text-slate-500">Decay (α)</span>
                          <span className="text-sm font-bold text-emerald-400">{cat.contractionFactor}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Escalation Authority Hierarchy
                      </span>
                      {cat.tierTargets && cat.tierTargets.length > 0 ? (
                        <div className="space-y-1.5">
                          {cat.tierTargets.map((t, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-slate-900 px-2.5 py-1 rounded-md text-slate-300"
                            >
                              <span className="font-semibold text-indigo-400">Tier {t.tier}</span>
                              <span>{t.supervisorRole || t.targetRole}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic">No supervisor tiers defined</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Staff Section */}
        {activeTab === "staff" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" /> Staff Members & Category Pools
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Provision staff accounts and assign them to category pools to route incidents.
                </p>
              </div>
              <button
                onClick={() => {
                  setStaffModalError(null);
                  setStaffForm({
                    name: "",
                    email: "",
                    password: "",
                    categoryPoolIds: [],
                  });
                  setIsStaffModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white shadow transition"
              >
                <UserPlus className="w-4 h-4" /> Provision Staff
              </button>
            </div>

            {staffList.length === 0 ? (
              <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-400">No staff members provisioned yet.</p>
                <button
                  onClick={() => setIsStaffModalOpen(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline"
                >
                  Provision your first staff member
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-base text-white">{staff.name}</h4>
                          <p className="text-xs text-slate-400">{staff.email}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          {staff.role}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Assigned Category Pools
                      </span>
                      {staff.categoryPools && staff.categoryPools.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {staff.categoryPools.map((pool) => (
                            <span
                              key={pool.id}
                              className="text-xs px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-medium"
                            >
                              {pool.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-amber-400/80 italic">No category pools assigned</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Staff Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">Provision Staff Member</h3>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {staffModalError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span>{staffModalError}</span>
              </div>
            )}

            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="staff@organization.com"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Initial Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  Assign Category Pools
                </label>
                {categories.length === 0 ? (
                  <p className="text-xs text-amber-400">
                    No categories configured yet. Create categories first before assigning pools.
                  </p>
                ) : (
                  <div className="space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950 max-h-48 overflow-y-auto">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        className="flex items-center space-x-3 cursor-pointer p-1.5 hover:bg-slate-900 rounded-lg text-sm text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={staffForm.categoryPoolIds.includes(cat.id)}
                          onChange={() => toggleCategoryPool(cat.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span>{cat.name} ({cat.baseSlaHours}h Base SLA)</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStaff}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
                >
                  {savingStaff ? "Provisioning..." : "Provision Staff"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white">
                {editingCategory ? "Edit Category SLA" : "Add Problem Category"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electrical, Plumbing, Network"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Base SLA (Hours)
                  </label>
                  <input
                    type="number"
                    required
                    min={0.1}
                    step={0.1}
                    value={categoryForm.baseSlaHours}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        baseSlaHours: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Floor (Hours)
                  </label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step={0.01}
                    value={categoryForm.floorHours}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        floorHours: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1">
                    Decay Factor (α)
                  </label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    value={categoryForm.contractionFactor}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        contractionFactor: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Dynamic Escalation Tiers */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Escalation Tiers
                  </label>
                  <button
                    type="button"
                    onClick={addTierTarget}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>

                <div className="space-y-2">
                  {categoryForm.tierTargets?.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400 w-16">
                        Tier {t.tier}:
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Supervisor / Authority Role"
                        value={t.targetRole || t.supervisorRole || ""}
                        onChange={(e) => {
                          const updated = [...(categoryForm.tierTargets || [])];
                          updated[idx] = {
                            ...updated[idx],
                            targetRole: e.target.value,
                            supervisorRole: e.target.value,
                          };
                          setCategoryForm({ ...categoryForm, tierTargets: updated });
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {categoryForm.tierTargets && categoryForm.tierTargets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTierTarget(idx)}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50"
                >
                  {savingCategory ? "Saving..." : editingCategory ? "Update Category" : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
