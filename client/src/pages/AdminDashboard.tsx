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
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
        <Card className="bg-obsidian-surface border-red-500/30 p-8 rounded-2xl max-w-md w-full text-center shadow-surface">
          <CardContent className="p-0">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold text-white mb-2">Access Denied</CardTitle>
            <CardDescription className="text-sm text-slate-400 mb-6 leading-relaxed">
              {error || "Failed to load governance dashboard"}
            </CardDescription>
            <Button
              onClick={handleAccessDeniedRedirect}
              className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-semibold text-white"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
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
              <Badge variant="outline" className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border-indigo-500/20">
                Governance Console
              </Badge>
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-red-400 px-3 py-1.5 rounded-xl hover:bg-obsidian-hover h-auto"
            title="Sign out of Admin Dashboard"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Institutional Welcome Banner */}
        <Card className="relative overflow-hidden bg-gradient-to-r from-indigo-950/40 via-obsidian-surface to-obsidian-card border-obsidian-border rounded-2xl shadow-surface">
          <CardContent className="p-6 relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> Organization Active
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-white">
                Welcome back, {dashboard.admin.name}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                Campus-wide governance overview. Manage problem category pool rules, dynamic SLA contraction decay parameters (α), and supervisory escalation pathways.
              </CardDescription>
            </div>
          </CardContent>
        </Card>

        {/* Executive KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-obsidian-surface/90 border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Building className="w-3.5 h-3.5 text-indigo-400" /> Organization Profile
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <CardTitle className="text-base font-bold text-white truncate" title={dashboard.organization.name}>
                {dashboard.organization.name}
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1 font-mono flex items-center gap-1">
                <span>slug:</span>
                <code className="bg-obsidian-elevated px-1.5 py-0.5 rounded text-indigo-300">
                  {dashboard.organization.slug}
                </code>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-obsidian-surface/90 border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <User className="w-3.5 h-3.5 text-indigo-400" /> Admin Profile
                </span>
                <Badge variant="outline" className="text-[10px] font-mono text-slate-500 border-obsidian-border">Authorized</Badge>
              </div>
              <CardTitle className="text-base font-bold text-white truncate">{dashboard.admin.name}</CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1 truncate font-mono">{dashboard.admin.email}</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-obsidian-surface/90 border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" /> Configured Categories
                </span>
                <Badge className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {categories.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Driving dynamic SLA contraction</div>
            </CardContent>
          </Card>

          <Card className="bg-obsidian-surface/90 border-obsidian-border rounded-2xl p-5 shadow-surface hover:border-obsidian-subtle transition">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-slate-400 text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> Active Staff
                </span>
                <Badge className="text-[10px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20">Pools Ready</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-2xl font-bold font-mono tabular-nums text-sky-400">
                {staffList.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Assigned to category pools</div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "categories" | "staff" | "escalations")}
          className="w-full space-y-6"
        >
          <TabsList className="bg-transparent border-b border-obsidian-border rounded-none p-0 h-auto space-x-6 justify-start w-full">
            <TabsTrigger
              value="categories"
              onClick={() => setActiveTab("categories")}
              className="pb-3 text-sm font-semibold border-b-2 rounded-none border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-white text-slate-400 hover:text-slate-200 bg-transparent data-[state=active]:bg-transparent flex items-center gap-2 shadow-none transition"
            >
              <Sliders className="w-4 h-4" />
              <span>Problem Categories ({categories.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="staff"
              onClick={() => setActiveTab("staff")}
              className="pb-3 text-sm font-semibold border-b-2 rounded-none border-transparent data-[state=active]:border-indigo-500 data-[state=active]:text-white text-slate-400 hover:text-slate-200 bg-transparent data-[state=active]:bg-transparent flex items-center gap-2 shadow-none transition"
            >
              <Users className="w-4 h-4" />
              <span>Staff & Category Pools ({staffList.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="escalations"
              onClick={() => setActiveTab("escalations")}
              className="pb-3 text-sm font-semibold border-b-2 rounded-none border-transparent data-[state=active]:border-red-500 data-[state=active]:text-white text-slate-400 hover:text-slate-200 bg-transparent data-[state=active]:bg-transparent flex items-center gap-2 shadow-none transition"
            >
              <Shield className="w-4 h-4 text-red-400" />
              <span>Supervisory Escalations ({escalatedIncidents.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Categories Section */}
          {activeTab === "categories" && (
            <TabsContent value="categories" className="mt-0" forceMount>
              <Card className="bg-obsidian-surface border-obsidian-border rounded-2xl shadow-surface">
                <CardHeader className="p-6 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-indigo-400" /> Problem Categories & Dynamic SLA Configuration
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Define baseline response limits, minimum contraction safety floors, and escalation tier targets for each problem domain.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={openCreateModal}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white shadow-sm transition"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Category
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
                  {categories.length === 0 ? (
                    <div className="border border-dashed border-obsidian-border rounded-xl p-10 text-center space-y-3 bg-obsidian-card">
                      <Layers className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-sm text-slate-300 font-medium">No problem categories configured yet.</p>
                      <p className="text-xs text-slate-500">Establish your first domain category with calibrated SLA parameters.</p>
                      <Button
                        variant="link"
                        onClick={openCreateModal}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline p-0 h-auto"
                      >
                        Create your first category
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categories.map((cat) => (
                        <Card
                          key={cat.id}
                          className="bg-obsidian-card border-obsidian-border hover:border-obsidian-subtle rounded-xl p-5 space-y-4 transition flex flex-col justify-between shadow-surface group"
                        >
                          <CardHeader className="p-0 space-y-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <CardTitle className="font-bold text-sm text-white tracking-tight">{cat.name}</CardTitle>
                                  <Badge className="text-[9px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                                    Policy Active
                                  </Badge>
                                </div>
                                <CardDescription className="text-[10px] font-mono text-slate-500 mt-0.5">
                                  ID: {cat.id.slice(-6)}
                                </CardDescription>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(cat)}
                                className="h-7 w-7 text-slate-400 hover:text-white rounded-lg hover:bg-obsidian-hover border border-transparent hover:border-obsidian-border transition"
                                title="Edit Category SLA"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
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
                          </CardHeader>

                          <CardFooter className="p-0 pt-3 border-t border-obsidian-border flex-col items-start">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                              Escalation Authority Hierarchy
                            </span>
                            {cat.tierTargets && cat.tierTargets.length > 0 ? (
                              <div className="space-y-1.5 w-full">
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
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Staff Section */}
          {activeTab === "staff" && (
            <TabsContent value="staff" className="mt-0" forceMount>
              <Card className="bg-obsidian-surface border-obsidian-border rounded-2xl shadow-surface">
                <CardHeader className="p-6 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" /> Staff Members & Category Pools
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Provision staff operator accounts and assign them to category pools for automated incident triage routing.
                      </CardDescription>
                    </div>
                    <Button
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
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white shadow-sm transition"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Provision Staff
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-6 pt-0 space-y-6">
                  {staffList.length === 0 ? (
                    <div className="border border-dashed border-obsidian-border rounded-xl p-10 text-center space-y-3 bg-obsidian-card">
                      <Users className="w-10 h-10 text-slate-600 mx-auto" />
                      <p className="text-sm text-slate-300 font-medium">No staff members provisioned yet.</p>
                      <p className="text-xs text-slate-500">Provision initial personnel to establish response capacity in category pools.</p>
                      <Button
                        variant="link"
                        onClick={() => setIsStaffModalOpen(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline p-0 h-auto"
                      >
                        Provision your first staff member
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {staffList.map((staff) => (
                        <Card
                          key={staff.id}
                          className="bg-obsidian-card border-obsidian-border rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-surface"
                        >
                          <CardHeader className="p-0 space-y-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="font-bold text-sm text-white">{staff.name}</CardTitle>
                                <CardDescription className="text-xs font-mono text-slate-400 mt-0.5">{staff.email}</CardDescription>
                              </div>
                              <Badge className="text-[10px] uppercase font-mono tracking-wider font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                {staff.role}
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="p-0 pt-3 border-t border-obsidian-border">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                              Assigned Category Pools
                            </span>
                            {staff.categoryPools && staff.categoryPools.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {staff.categoryPools.map((pool) => (
                                  <Badge
                                    key={pool.id}
                                    className="text-xs bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 font-medium"
                                  >
                                    {pool.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-amber-400/80 italic">No category pools assigned</span>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Supervisory Escalations Section */}
          {activeTab === "escalations" && (
            <TabsContent value="escalations" className="mt-0" forceMount>
              <Card className="bg-obsidian-surface border-obsidian-border rounded-2xl shadow-surface">
                <CardHeader className="p-6 pb-4">
                  <div>
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-400" />
                      <span>Supervisory Escalations & Oversight</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Active incidents that have breached dynamic SLA deadlines and escalated to supervisory tiers. Primary assignee accountability is maintained while designated supervisory authorities provide supervisory intervention.
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-6 pt-0 space-y-6">
                  {escalatedIncidents.length === 0 ? (
                    <div className="border border-dashed border-obsidian-border rounded-xl p-10 text-center space-y-3 bg-obsidian-card">
                      <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                      <p className="text-sm text-slate-200 font-semibold">No Breached or Escalated Incidents</p>
                      <p className="text-xs text-slate-400">All active incidents in the organization are currently tracking within their dynamic SLA deadlines.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {escalatedIncidents.map((incident) => (
                        <Card
                          key={incident.id}
                          className="bg-obsidian-card border-red-500/40 rounded-2xl p-5 shadow-elevated space-y-4"
                        >
                          <CardHeader className="p-0 space-y-0">
                            <div className="flex items-start justify-between gap-2">
                              <Badge className="text-xs bg-red-950/80 text-red-300 border-red-500/30 font-semibold font-mono">
                                Tier {incident.escalationTier} Escalation
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-obsidian-elevated text-slate-300 border-obsidian-border font-medium">
                                {incident.status}
                              </Badge>
                            </div>

                            <div className="space-y-1 mt-3">
                              <CardDescription className="text-xs text-slate-500 font-mono">Incident #{incident.id.slice(-6)}</CardDescription>
                              <CardTitle className="text-sm font-semibold text-white">
                                {incident.category?.name || "Problem Category"}
                              </CardTitle>
                            </div>
                          </CardHeader>

                          <CardContent className="p-0 space-y-3">
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
                          </CardContent>

                          <CardFooter className="p-0 pt-2 border-t border-obsidian-border/50 flex justify-between items-center text-xs text-slate-400">
                            <span>Corroborations: <strong className="text-white font-mono tabular-nums">{incident.corroborationCount}</strong></span>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => navigate(`/org/${slug}/staff/dashboard`)}
                              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-medium p-0 h-auto"
                            >
                              <span>Inspect in Staff Portal</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Staff Provisioning Modal */}
      <Dialog open={isStaffModalOpen} onOpenChange={setIsStaffModalOpen}>
        <DialogContent className="bg-obsidian-surface border border-obsidian-border rounded-2xl w-full max-w-lg p-6 shadow-elevated space-y-5 max-h-[90vh] overflow-y-auto sm:max-w-lg text-slate-100">
          <DialogHeader className="border-b border-obsidian-border pb-4 p-0">
            <DialogTitle className="text-base font-bold text-white">Provision Staff Member</DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-0.5">
              Create operational credentials and assign category pool routing
            </DialogDescription>
          </DialogHeader>

          {staffModalError && (
            <Alert variant="destructive" className="p-3 bg-red-500/10 border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-300 font-medium">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
              <AlertDescription>{staffModalError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleStaffSubmit} noValidate className="space-y-4">
            <div>
              <Label
                htmlFor="staff-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
              >
                Full Name
              </Label>
              <Input
                id="staff-name"
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={staffForm.name}
                onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-obsidian border-obsidian-border rounded-xl text-white placeholder:text-slate-500 text-sm focus-visible:ring-indigo-500"
              />
            </div>

            <div>
              <Label
                htmlFor="staff-email"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
              >
                Email Address
              </Label>
              <Input
                id="staff-email"
                type="email"
                required
                placeholder="staff@organization.com"
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className="w-full px-3.5 py-2 bg-obsidian border-obsidian-border rounded-xl text-white placeholder:text-slate-500 text-sm focus-visible:ring-indigo-500"
              />
            </div>

            <div>
              <Label
                htmlFor="staff-password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
              >
                Initial Password
              </Label>
              <Input
                id="staff-password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={staffForm.password}
                onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                className="w-full px-3.5 py-2 bg-obsidian border-obsidian-border rounded-xl text-white placeholder:text-slate-500 text-sm focus-visible:ring-indigo-500"
              />
            </div>

            <div>
              <Label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                Assign Category Pools
              </Label>
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

            <DialogFooter className="flex items-center sm:justify-end gap-3 pt-4 border-t border-obsidian-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStaffModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white border-obsidian-border bg-transparent hover:bg-obsidian-hover"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingStaff}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                {savingStaff ? "Provisioning..." : "Provision Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-obsidian-surface border border-obsidian-border rounded-2xl w-full max-w-lg p-6 shadow-elevated space-y-5 max-h-[90vh] overflow-y-auto sm:max-w-lg text-slate-100">
          <DialogHeader className="border-b border-obsidian-border pb-4 p-0">
            <DialogTitle className="text-base font-bold text-white">
              {editingCategory ? "Edit Category SLA" : "Add Problem Category"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 mt-0.5">
              Configure dynamic SLA parameters and multi-tier supervisor escalation
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <Alert variant="destructive" className="p-3 bg-red-500/10 border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-300 font-medium">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCategorySubmit} noValidate className="space-y-4">
            <div>
              <Label
                htmlFor="category-name"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1"
              >
                Category Name
              </Label>
              <Input
                id="category-name"
                type="text"
                required
                placeholder="e.g. Electrical, Plumbing, Network"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                className="w-full px-3.5 py-2 bg-obsidian border-obsidian-border rounded-xl text-white placeholder:text-slate-500 text-sm focus-visible:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label
                  htmlFor="base-sla"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Base SLA (Hours)
                </Label>
                <Input
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
                  className="w-full px-3 py-2 bg-obsidian border-obsidian-border rounded-xl text-white text-sm font-mono focus-visible:ring-indigo-500"
                />
              </div>

              <div>
                <Label
                  htmlFor="floor-hours"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Floor (Hours)
                </Label>
                <Input
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
                  className="w-full px-3 py-2 bg-obsidian border-obsidian-border rounded-xl text-white text-sm font-mono focus-visible:ring-indigo-500"
                />
              </div>

              <div>
                <Label
                  htmlFor="decay-factor"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-300 mb-1"
                >
                  Decay Factor (α)
                </Label>
                <Input
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
                  className="w-full px-3 py-2 bg-obsidian border-obsidian-border rounded-xl text-white text-sm font-mono focus-visible:ring-indigo-500"
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
                <Label className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Escalation Tiers
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addTierTarget}
                  className="text-xs text-indigo-400 hover:text-indigo-300 hover:bg-transparent flex items-center gap-1 font-semibold p-0 h-auto"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Tier
                </Button>
              </div>

              <div className="space-y-2.5">
                {categoryForm.tierTargets?.map((t, idx) => (
                  <div key={idx} className="p-3 bg-obsidian border border-obsidian-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-300 font-mono">
                        Tier {t.tier} Configuration
                      </span>
                      {categoryForm.tierTargets && categoryForm.tierTargets.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTierTarget(idx)}
                          className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-obsidian-hover p-1"
                          title="Remove Tier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <Label
                          htmlFor={`tier-role-${idx}`}
                          className="text-[10px] text-slate-400 font-medium block mb-1"
                        >
                          Supervisor Role / Authority
                        </Label>
                        <Input
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
                          className="w-full px-3 py-1.5 bg-obsidian-surface border-obsidian-border rounded-xl text-white text-xs focus-visible:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`tier-sla-${idx}`}
                          className="text-[10px] text-slate-400 font-medium block mb-1"
                        >
                          Tier Escalation SLA (Hours)
                        </Label>
                        <Input
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
                          className="w-full px-3 py-1.5 bg-obsidian-surface border-obsidian-border rounded-xl text-white text-xs font-mono focus-visible:ring-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor={`tier-user-${idx}`}
                        className="text-[10px] text-slate-400 font-medium block mb-1"
                      >
                        Designated Staff ID or Email (Optional)
                      </Label>
                      <Input
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
                        className="w-full px-3 py-1.5 bg-obsidian-surface border-obsidian-border rounded-xl text-white text-xs font-mono focus-visible:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-obsidian-border flex sm:justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-obsidian-elevated hover:bg-obsidian-hover text-slate-300 rounded-xl text-xs font-semibold border-obsidian-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingCategory}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                {savingCategory ? "Saving..." : editingCategory ? "Update Category" : "Save Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
