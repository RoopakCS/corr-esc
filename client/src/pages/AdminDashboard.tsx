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
  getIncidents,
  Category,
  CategoryPayload,
  StaffMember,
  IncidentItem,
} from "../services/api.js";
import { CountdownTimer } from "../components/CountdownTimer.js";
import { NotificationCenter } from "../components/NotificationCenter.js";
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
  ArrowRight,
  Info,
} from "lucide-react";

const DEFAULT_CATEGORY_FORM: CategoryPayload = {
  name: "",
  baseSlaHours: 24,
  floorHours: 2,
  contractionFactor: 0.2,
  tierTargets: [{ tier: 1, targetRole: "Supervisor", slaHours: 8 }],
};

export function AdminDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [escalatedIncidents, setEscalatedIncidents] = useState<IncidentItem[]>([]);
  const [activeTab, setActiveTab] = useState<"categories" | "staff" | "escalations">("categories");
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
    Promise.all([
      getAdminDashboard(slug),
      getCategories(slug),
      getStaff(slug),
      getIncidents(slug, { escalated: true }).catch(() => []),
    ])
      .then(([dashRes, catRes, staffRes, escRes]) => {
        setDashboard(dashRes);
        setCategories(catRes);
        setStaffList(staffRes);
        setEscalatedIncidents(escRes);
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
        cat.tierTargets && cat.tierTargets.length > 0
          ? cat.tierTargets.map((t, idx) => ({
              tier: idx + 1,
              targetRole: t.targetRole || t.supervisorRole || "Supervisor",
              supervisorRole: t.supervisorRole || t.targetRole || "Supervisor",
              roleOrUserId: t.roleOrUserId,
              slaHours: t.slaHours,
            }))
          : [{ tier: 1, targetRole: "Supervisor", supervisorRole: "Supervisor", slaHours: 8 }],
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
        { tier: nextTier, targetRole: `Tier ${nextTier} Supervisor`, slaHours: 4 },
      ],
    }));
  };

  const removeTierTarget = (index: number) => {
    setCategoryForm((prev) => {
      const remaining = (prev.tierTargets || []).filter((_, i) => i !== index);
      const reindexed = remaining.map((t, i) => ({
        ...t,
        tier: i + 1,
      }));
      return { ...prev, tierTargets: reindexed };
    });
  };

  const updateTierTarget = (index: number, patch: Partial<NonNullable<CategoryPayload["tierTargets"]>[number]>) => {
    setCategoryForm((prev) => {
      const updated = [...(prev.tierTargets || [])];
      updated[index] = { ...updated[index], ...patch };
      return { ...prev, tierTargets: updated };
    });
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug) return;
    setModalError(null);

    if (!categoryForm.name.trim()) {
      setModalError("Category name is required");
      return;
    }

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

    if (!staffForm.name.trim()) {
      setStaffModalError("Staff member full name is required");
      return;
    }

    if (!staffForm.email.trim() || !staffForm.email.includes("@")) {
      setStaffModalError("Valid staff email address is required");
      return;
    }

    if (!staffForm.password || staffForm.password.length < 6) {
      setStaffModalError("Initial password must be at least 6 characters");
      return;
    }

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
      <div className="min-h-screen bg-obsidian flex items-center justify-center text-slate-100">
        <div className="flex items-center space-x-3 bg-obsidian-surface border border-obsidian-border px-6 py-4 rounded-2xl shadow-surface">
          <Clock className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-sm text-slate-300 font-medium">Loading organization governance console...</span>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-slate-100 px-4">
        <div className="bg-obsidian-surface border border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center shadow-surface">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">{error || "Failed to load governance dashboard"}</p>
          <button
            onClick={handleAccessDeniedRedirect}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold transition pressable focus-ring text-white"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-slate-100 flex flex-col antialiased">
      {/* Executive Header */}
      <header className="border-b border-obsidian-border bg-obsidian-surface/90 backdrop-blur sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-glowViolet/30">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-white leading-tight tracking-tight">
                {dashboard.organization.name}
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                Governance Console
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400">/org/{dashboard.organization.slug}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <NotificationCenter
            slug={slug || ""}
            onRealtimeEvent={() => {
              if (slug) {
                getIncidents(slug, { escalated: true }).then(setEscalatedIncidents).catch(() => {});
                getCategories(slug).then(setCategories).catch(() => {});
              }
            }}
            onNotificationClick={(notif) => {
              if (
                notif.type === "ESCALATION_BREACH" ||
                notif.type === "incident_escalated" ||
                notif.type === "incident_reopened"
              ) {
                setActiveTab("escalations");
              }
            }}
          />
          <div className="hidden sm:flex items-center space-x-2 bg-obsidian-elevated/80 px-3 py-1.5 rounded-xl border border-obsidian-border">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-200">{dashboard.admin.role}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-xl hover:bg-obsidian-hover transition"
            title="Sign out of Admin Dashboard"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Institutional Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950/40 via-obsidian-surface to-obsidian-card border border-obsidian-border rounded-2xl p-6 shadow-surface">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle className="w-3.5 h-3.5" /> Organization Active
                </span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">
                Welcome back, {dashboard.admin.name}
              </h2>
              <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Campus-wide governance overview. Manage problem category pool rules, dynamic SLA contraction decay parameters (α), and supervisory escalation pathways.
              </p>
            </div>


          </div>
        </div>

        {/* Executive KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Building className="w-3.5 h-3.5 text-indigo-400" /> Organization Profile
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-base font-bold text-white truncate" title={dashboard.organization.name}>
              {dashboard.organization.name}
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-1">
              <span>slug:</span>
              <code className="bg-obsidian-elevated px-1.5 py-0.5 rounded text-indigo-300">
                {dashboard.organization.slug}
              </code>
            </div>
          </div>

          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <User className="w-3.5 h-3.5 text-indigo-400" /> Admin Profile
              </span>
              <span className="text-[10px] font-mono text-slate-500">Authorized</span>
            </div>
            <div className="text-base font-bold text-white truncate">{dashboard.admin.name}</div>
            <div className="text-xs text-slate-400 mt-1 truncate font-mono">{dashboard.admin.email}</div>
          </div>

          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Configured Categories
              </span>
              <span className="text-[10px] font-mono text-emerald-400">Active</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
              {categories.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">Driving dynamic SLA contraction</div>
          </div>

          <div className="bg-obsidian-surface/90 border border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Users className="w-3.5 h-3.5 text-indigo-400" /> Active Staff
              </span>
              <span className="text-[10px] font-mono text-sky-400">Pools Ready</span>
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-sky-400">
              {staffList.length}
            </div>
            <div className="text-xs text-slate-400 mt-1">Assigned to category pools</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-obsidian-border space-x-6">
          <button
            onClick={() => setActiveTab("categories")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition pressable ${
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
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition pressable ${
              activeTab === "staff"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff & Category Pools ({staffList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("escalations")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition pressable ${
              activeTab === "escalations"
                ? "border-red-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4 text-red-400" />
            <span>Supervisory Escalations ({escalatedIncidents.length})</span>
          </button>
        </div>

        {/* Categories Section */}
        {activeTab === "categories" && (
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 space-y-6 shadow-surface">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" /> Problem Categories & Dynamic SLA Configuration
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Define baseline response limits, minimum contraction safety floors, and escalation tier targets for each problem domain.
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white shadow-sm transition pressable focus-ring"
              >
                <Plus className="w-3.5 h-3.5" /> Add Category
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="border border-dashed border-obsidian-border rounded-xl p-10 text-center space-y-3 bg-obsidian-card">
                <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">No problem categories configured yet.</p>
                <p className="text-xs text-slate-500">Establish your first domain category with calibrated SLA parameters.</p>
                <button
                  onClick={openCreateModal}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline pt-2 inline-block"
                >
                  Create your first category
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-obsidian-card border border-obsidian-border hover:border-obsidian-subtle rounded-xl p-5 space-y-4 transition flex flex-col justify-between shadow-surface group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-white tracking-tight">{cat.name}</h4>
                            <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Policy Active
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">ID: {cat.id.slice(-6)}</span>
                        </div>
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-obsidian-hover border border-transparent hover:border-obsidian-border transition"
                          title="Edit Category SLA"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Calibrated SLA Metrics Grid */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-obsidian-border text-center">
                        <div className="bg-obsidian-surface p-2.5 rounded-lg border border-obsidian-border/50">
                          <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Base SLA</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-indigo-400">{cat.baseSlaHours}h</span>
                        </div>
                        <div className="bg-obsidian-surface p-2.5 rounded-lg border border-obsidian-border/50">
                          <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Floor</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-amber-400">{cat.floorHours}h</span>
                        </div>
                        <div className="bg-obsidian-surface p-2.5 rounded-lg border border-obsidian-border/50">
                          <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Decay (α)</span>
                          <span className="text-sm font-bold font-mono tabular-nums text-emerald-400">{cat.contractionFactor}</span>
                        </div>
                      </div>

                      {/* Formula Guidance Micro-Card */}
                      <div className="mt-3 p-2 rounded-lg bg-obsidian-surface/60 border border-obsidian-border/30 text-[11px] text-slate-400 flex items-center justify-between">
                        <span className="text-slate-500">Contraction Rate:</span>
                        <span className="font-mono text-indigo-300 font-medium">-{Math.round(cat.contractionFactor * 100)}% / corroboration</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-obsidian-border">
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Escalation Authority Hierarchy
                      </span>
                      {cat.tierTargets && cat.tierTargets.length > 0 ? (
                        <div className="space-y-1.5">
                          {cat.tierTargets.map((t, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-obsidian-surface px-2.5 py-1.5 rounded-lg border border-obsidian-border/40 text-slate-300"
                            >
                              <span className="font-semibold text-indigo-400 font-mono text-[11px]">Tier {t.tier}</span>
                              <span className="truncate max-w-[140px]">{t.supervisorRole || t.targetRole}</span>
                              {t.slaHours ? (
                                <span className="text-[10px] font-mono text-amber-300/90 font-medium">
                                  {t.slaHours}h target
                                </span>
                              ) : null}
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
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 space-y-6 shadow-surface">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" /> Staff Members & Category Pools
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Provision staff operator accounts and assign them to category pools for automated incident triage routing.
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
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white shadow-sm transition pressable focus-ring"
              >
                <UserPlus className="w-3.5 h-3.5" /> Provision Staff
              </button>
            </div>

            {staffList.length === 0 ? (
              <div className="border border-dashed border-obsidian-border rounded-xl p-10 text-center space-y-3 bg-obsidian-card">
                <Users className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">No staff members provisioned yet.</p>
                <p className="text-xs text-slate-500">Provision initial personnel to establish response capacity in category pools.</p>
                <button
                  onClick={() => setIsStaffModalOpen(true)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline pt-2 inline-block"
                >
                  Provision your first staff member
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    className="bg-obsidian-card border border-obsidian-border rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-surface"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-white">{staff.name}</h4>
                          <p className="text-xs font-mono text-slate-400 mt-0.5">{staff.email}</p>
                        </div>
                        <span className="text-[10px] uppercase font-mono tracking-wider font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          {staff.role}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-obsidian-border">
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

        {/* Supervisory Escalations Section */}
        {activeTab === "escalations" && (
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl p-6 space-y-6 shadow-surface">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-red-400" />
                <span>Supervisory Escalations & Oversight</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Active incidents that have breached dynamic SLA deadlines and escalated to supervisory tiers. Primary assignee accountability is maintained while designated supervisory authorities provide supervisory intervention.
              </p>
            </div>

            {escalatedIncidents.length === 0 ? (
              <div className="border border-dashed border-obsidian-border rounded-xl p-10 text-center space-y-3 bg-obsidian-card">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                <p className="text-sm text-slate-200 font-semibold">No Breached or Escalated Incidents</p>
                <p className="text-xs text-slate-400">All active incidents in the organization are currently tracking within their dynamic SLA deadlines.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {escalatedIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="bg-obsidian-card border border-red-500/40 rounded-2xl p-5 shadow-elevated space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-500/30 font-semibold font-mono">
                        Tier {incident.escalationTier} Escalation
                      </span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-obsidian-elevated text-slate-300 border border-obsidian-border font-medium">
                        {incident.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 font-mono">Incident #{incident.id.slice(-6)}</div>
                      <div className="text-sm font-semibold text-white">
                        {incident.category?.name || "Problem Category"}
                      </div>
                    </div>

                    <CountdownTimer deadline={incident.slaDeadline} createdAt={incident.createdAt} />

                    <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-obsidian-border">
                      <div>
                        <div className="text-slate-400 text-[11px]">Primary Assignee</div>
                        <div className="text-white font-medium truncate">
                          {incident.assignee?.name || "Unassigned"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[11px]">Designated Supervisor</div>
                        <div className="text-amber-300 font-medium truncate">
                          {incident.supervisor?.name || "Tier Authority"}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 pt-2 border-t border-obsidian-border/50 flex justify-between items-center">
                      <span>Corroborations: <strong className="text-white font-mono tabular-nums">{incident.corroborationCount}</strong></span>
                      <button
                        onClick={() => navigate(`/org/${slug}/staff/dashboard`)}
                        className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium transition"
                      >
                        <span>Inspect in Staff Portal</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Staff Provisioning Modal */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl w-full max-w-lg p-6 shadow-elevated space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-obsidian-border pb-4">
              <div>
                <h3 className="text-base font-bold text-white">Provision Staff Member</h3>
                <p className="text-xs text-slate-400 mt-0.5">Create operational credentials and assign category pool routing</p>
              </div>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-obsidian-hover transition"
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

            <form onSubmit={handleStaffSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="staff-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="staff-name"
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-obsidian border border-obsidian-border rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Email Address
                </label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  placeholder="staff@organization.com"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 bg-obsidian border border-obsidian-border rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label
                  htmlFor="staff-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Initial Password
                </label>
                <input
                  id="staff-password"
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                  className="w-full px-3.5 py-2 bg-obsidian border border-obsidian-border rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <div className="space-y-2 border border-obsidian-border rounded-xl p-3 bg-obsidian max-h-48 overflow-y-auto">
                    {categories.map((cat) => (
                      <label
                        key={cat.id}
                        htmlFor={`pool-${cat.id}`}
                        className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-obsidian-hover rounded-lg text-sm text-slate-200 transition"
                      >
                        <input
                          id={`pool-${cat.id}`}
                          type="checkbox"
                          checked={staffForm.categoryPoolIds.includes(cat.id)}
                          onChange={() => toggleCategoryPool(cat.id)}
                          className="rounded border-obsidian-border bg-obsidian-surface text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                        />
                        <span>{cat.name} ({cat.baseSlaHours}h Base SLA)</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-obsidian-border">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingStaff}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition pressable focus-ring"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-obsidian-surface border border-obsidian-border rounded-2xl w-full max-w-lg p-6 shadow-elevated space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-obsidian-border pb-4">
              <div>
                <h3 className="text-base font-bold text-white">
                  {editingCategory ? "Edit Category SLA" : "Add Problem Category"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure dynamic SLA parameters and multi-tier supervisor escalation
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-obsidian-hover transition"
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

            <form onSubmit={handleCategorySubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="category-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Category Name
                </label>
                <input
                  id="category-name"
                  type="text"
                  required
                  placeholder="e.g. Electrical, Plumbing, Network"
                  value={categoryForm.name}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-obsidian border border-obsidian-border rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="base-sla"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1"
                  >
                    Base SLA (Hours)
                  </label>
                  <input
                    id="base-sla"
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
                    className="w-full px-3 py-2 bg-obsidian border border-obsidian-border rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="floor-hours"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1"
                  >
                    Floor (Hours)
                  </label>
                  <input
                    id="floor-hours"
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
                    className="w-full px-3 py-2 bg-obsidian border border-obsidian-border rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="decay-factor"
                    className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1"
                  >
                    Decay Factor (α)
                  </label>
                  <input
                    id="decay-factor"
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
                    className="w-full px-3 py-2 bg-obsidian border border-obsidian-border rounded-xl text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Dynamic SLA Contraction Formula Note */}
              <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl space-y-1">
                <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> Dynamic Contraction Formula
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                  SLA(n) = max(Floor, Base × (1 - α)ⁿ)
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Each corroborating complaint contracts the resolution deadline by α until bounded by the safety floor.
                </p>
              </div>

              {/* Dynamic Escalation Tiers */}
              <div className="pt-3 border-t border-obsidian-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Escalation Tiers
                  </label>
                  <button
                    type="button"
                    onClick={addTierTarget}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Add Tier
                  </button>
                </div>

                <div className="space-y-2.5">
                  {categoryForm.tierTargets?.map((t, idx) => (
                    <div key={idx} className="p-3 bg-obsidian border border-obsidian-border rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300 font-mono">
                          Tier {t.tier} Configuration
                        </span>
                        {categoryForm.tierTargets && categoryForm.tierTargets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTierTarget(idx)}
                            className="text-slate-500 hover:text-red-400 p-1 transition"
                            title="Remove Tier"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label
                            htmlFor={`tier-role-${idx}`}
                            className="text-[10px] text-slate-400 font-medium block mb-1"
                          >
                            Supervisor Role / Authority
                          </label>
                          <input
                            id={`tier-role-${idx}`}
                            type="text"
                            required
                            placeholder="e.g. Supervisor or Director"
                            value={t.targetRole || t.supervisorRole || ""}
                            onChange={(e) => {
                              updateTierTarget(idx, {
                                targetRole: e.target.value,
                                supervisorRole: e.target.value,
                              });
                            }}
                            className="w-full px-3 py-1.5 bg-obsidian-surface border border-obsidian-border rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`tier-sla-${idx}`}
                            className="text-[10px] text-slate-400 font-medium block mb-1"
                          >
                            Tier Escalation SLA (Hours)
                          </label>
                          <input
                            id={`tier-sla-${idx}`}
                            type="number"
                            min="0.1"
                            step="0.5"
                            placeholder="e.g. 4"
                            value={t.slaHours || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateTierTarget(idx, {
                                slaHours: val > 0 ? val : undefined,
                              });
                            }}
                            className="w-full px-3 py-1.5 bg-obsidian-surface border border-obsidian-border rounded-xl text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor={`tier-user-${idx}`}
                          className="text-[10px] text-slate-400 font-medium block mb-1"
                        >
                          Designated Staff ID or Email (Optional)
                        </label>
                        <input
                          id={`tier-user-${idx}`}
                          type="text"
                          placeholder="e.g. supervisor@org.edu or staff user ID"
                          value={t.roleOrUserId || ""}
                          onChange={(e) => {
                            const updated = [...(categoryForm.tierTargets || [])];
                            updated[idx] = {
                              ...updated[idx],
                              roleOrUserId: e.target.value || undefined,
                            };
                            setCategoryForm({ ...categoryForm, tierTargets: updated });
                          }}
                          className="w-full px-3 py-1.5 bg-obsidian-surface border border-obsidian-border rounded-xl text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-obsidian-border flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-obsidian-elevated hover:bg-obsidian-hover text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 pressable focus-ring"
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
