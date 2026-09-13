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
  Copy,
  Check,
  ExternalLink,
  Sparkles,
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

  // Quick Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground font-mono">Loading Institutional Governance Console...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
        <Card className="border-destructive/30 p-8 rounded-xl max-w-md w-full text-center shadow-xs">
          <CardContent className="p-0">
            <div className="w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold mb-2">Access Denied</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {error || "Failed to load governance dashboard"}
            </CardDescription>
            <Button
              onClick={handleAccessDeniedRedirect}
              className="w-full rounded-xl text-sm font-semibold"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const originUrl = typeof window !== "undefined" ? window.location.origin : "";
  const complainantUrl = `${originUrl}/org/${dashboard.organization.slug}/submit`;
  const staffUrl = `${originUrl}/org/${dashboard.organization.slug}/staff/dashboard`;
  const loginUrl = `${originUrl}/org/${dashboard.organization.slug}/login`;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Executive Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-foreground leading-tight tracking-tight">
                {dashboard.organization.name}
              </h1>
              <Badge variant="secondary" className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full">
                Governance Console
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground">/org/{dashboard.organization.slug}</p>
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
          <div className="hidden sm:flex items-center space-x-2 bg-muted px-3 py-1.5 rounded-xl border border-border">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">{dashboard.admin.role}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-destructive px-3 py-1.5 rounded-xl h-auto"
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
        <Card className="rounded-2xl shadow-xs border-border bg-card">
          <CardContent className="p-6 relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5 mr-1 text-primary" /> Organization Active
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Welcome back, {dashboard.admin.name}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Campus-wide governance overview. Manage problem category pool rules, dynamic SLA contraction decay parameters (α), and supervisory escalation pathways.
              </CardDescription>
            </div>
          </CardContent>
        </Card>

        {/* Organization Routing & Gateway Directory */}
        <div className="rounded-2xl border border-border bg-muted/30 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Campus Portals & Access Gateways</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Organization Slug: <strong className="text-foreground">{dashboard.organization.slug}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Complainant Portal Link */}
            <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Grievance Submission</span>
                  <Badge variant="secondary" className="text-[10px] font-mono">Public Portal</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Share this link with students and staff for anonymous, blind grievance intake.
                </p>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground bg-muted p-1.5 rounded truncate">
                  /org/{dashboard.organization.slug}/submit
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(complainantUrl, "complainant")}
                  className="flex-1 text-[11px] h-7 gap-1.5"
                >
                  {copiedKey === "complainant" ? (
                    <>
                      <Check className="w-3 h-3 text-primary" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Link
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/org/${dashboard.organization.slug}/submit`, "_blank")}
                  className="text-[11px] h-7 px-2"
                  title="Open submission portal"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Staff Portal Link */}
            <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Staff Incident Cockpit</span>
                  <Badge variant="outline" className="text-[10px] font-mono">Operations</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Department triage cockpit for claiming incidents and merging corroborations.
                </p>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground bg-muted p-1.5 rounded truncate">
                  /org/{dashboard.organization.slug}/staff/dashboard
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(staffUrl, "staff")}
                  className="flex-1 text-[11px] h-7 gap-1.5"
                >
                  {copiedKey === "staff" ? (
                    <>
                      <Check className="w-3 h-3 text-primary" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Link
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/org/${dashboard.organization.slug}/staff/dashboard`)}
                  className="text-[11px] h-7 px-2"
                  title="Open staff cockpit"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Unified Login Link */}
            <div className="p-3.5 rounded-xl border border-border bg-card flex flex-col justify-between space-y-2.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Unified Sign-In Portal</span>
                  <Badge variant="outline" className="text-[10px] font-mono">Authentication</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Central gate for complainants, staff operators, and governance administrators.
                </p>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground bg-muted p-1.5 rounded truncate">
                  /org/{dashboard.organization.slug}/login
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(loginUrl, "login")}
                  className="flex-1 text-[11px] h-7 gap-1.5"
                >
                  {copiedKey === "login" ? (
                    <>
                      <Check className="w-3 h-3 text-primary" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy Link
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => window.open(`/org/${dashboard.organization.slug}/login`, "_blank")}
                  className="text-[11px] h-7 px-2"
                  title="Open login portal"
                >
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Executive KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl p-5 shadow-xs border-border bg-card">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-muted-foreground text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Building className="w-3.5 h-3.5 text-primary" /> Organization Profile
                </span>
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              </div>
              <CardTitle className="text-base font-bold text-foreground truncate" title={dashboard.organization.name}>
                {dashboard.organization.name}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-1">
                <span>slug:</span>
                <code className="bg-muted px-1.5 py-0.5 rounded text-foreground">
                  {dashboard.organization.slug}
                </code>
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-xl p-5 shadow-xs border-border bg-card">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-muted-foreground text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <User className="w-3.5 h-3.5 text-primary" /> Admin Profile
                </span>
                <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">Authorized</Badge>
              </div>
              <CardTitle className="text-base font-bold text-foreground truncate">{dashboard.admin.name}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1 truncate font-mono">{dashboard.admin.email}</CardDescription>
            </CardHeader>
          </Card>

          <Card className="rounded-xl p-5 shadow-xs border-border bg-card">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-muted-foreground text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Sliders className="w-3.5 h-3.5 text-primary" /> Configured Categories
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">Active</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                {categories.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Driving dynamic SLA contraction</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl p-5 shadow-xs border-border bg-card">
            <CardHeader className="p-0 pb-2 space-y-0">
              <div className="text-muted-foreground text-xs font-medium flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  <Users className="w-3.5 h-3.5 text-primary" /> Active Staff
                </span>
                <Badge variant="secondary" className="text-[10px] font-mono">Pools Ready</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-2xl font-bold font-mono tabular-nums text-foreground">
                {staffList.length}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Assigned to category pools</div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "categories" | "staff" | "escalations")}
          className="w-full space-y-6"
        >
          <TabsList className="bg-transparent border-b border-border rounded-none p-0 h-auto gap-8 justify-start w-full">
            <TabsTrigger
              value="categories"
              onClick={() => setActiveTab("categories")}
              className="pb-3 text-sm font-semibold border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground bg-transparent data-[state=active]:bg-transparent flex items-center gap-2 shadow-none transition cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              <span>Problem Categories ({categories.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="staff"
              onClick={() => setActiveTab("staff")}
              className="pb-3 text-sm font-semibold border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground hover:text-foreground bg-transparent data-[state=active]:bg-transparent flex items-center gap-2 shadow-none transition cursor-pointer"
            >
              <Users className="w-4 h-4" />
              <span>Staff & Category Pools ({staffList.length})</span>
            </TabsTrigger>
            <TabsTrigger
              value="escalations"
              onClick={() => setActiveTab("escalations")}
              className="pb-3 text-sm font-semibold border-b-2 rounded-none border-transparent data-[state=active]:border-destructive data-[state=active]:text-foreground text-muted-foreground hover:text-foreground bg-transparent data-[state=active]:bg-transparent flex items-center gap-2 shadow-none transition cursor-pointer"
            >
              <Shield className="w-4 h-4 text-destructive" />
              <span>Supervisory Escalations ({escalatedIncidents.length})</span>
            </TabsTrigger>
          </TabsList>

          {/* Categories Section */}
          {activeTab === "categories" && (
            <TabsContent value="categories" className="mt-0 w-full" forceMount>
              <Card className="rounded-2xl shadow-xs border-border bg-card">
                <CardHeader className="p-6 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-primary" /> Problem Categories & Dynamic SLA Configuration
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Define baseline response limits, minimum contraction safety floors, and escalation tier targets for each problem domain.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={openCreateModal}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Category
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-6 pt-0 space-y-6">
                  {categories.length === 0 ? (
                    <div className="border border-dashed border-border rounded-xl p-10 text-center space-y-3 bg-muted/40">
                      <Layers className="w-10 h-10 text-muted-foreground mx-auto" />
                      <p className="text-sm text-foreground font-medium">No problem categories configured yet.</p>
                      <p className="text-xs text-muted-foreground">Establish your first domain category with calibrated SLA parameters.</p>
                      <Button
                        variant="link"
                        onClick={openCreateModal}
                        className="text-xs text-primary underline p-0 h-auto font-semibold"
                      >
                        Create your first category
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {categories.map((cat) => (
                        <Card
                          key={cat.id}
                          className="rounded-xl p-5 space-y-4 transition flex flex-col justify-between shadow-xs border-border bg-muted/20 hover:border-border/80 group"
                        >
                          <CardHeader className="p-0 space-y-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <CardTitle className="font-bold text-sm text-foreground tracking-tight">{cat.name}</CardTitle>
                                  <Badge variant="secondary" className="text-[9px] font-mono font-medium">
                                    Policy Active
                                  </Badge>
                                </div>
                                <CardDescription className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                  ID: {cat.id.slice(-6)}
                                </CardDescription>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditModal(cat)}
                                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg transition cursor-pointer"
                                title="Edit Category SLA"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            {/* Calibrated SLA Metrics Grid */}
                            <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3 border-t border-border text-center">
                              <div className="bg-card p-2.5 rounded-lg border border-border">
                                <span className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Base SLA</span>
                                <span className="text-sm font-bold font-mono tabular-nums text-foreground">{cat.baseSlaHours}h</span>
                              </div>
                              <div className="bg-card p-2.5 rounded-lg border border-border">
                                <span className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Floor</span>
                                <span className="text-sm font-bold font-mono tabular-nums text-foreground">{cat.floorHours}h</span>
                              </div>
                              <div className="bg-card p-2.5 rounded-lg border border-border">
                                <span className="block text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Decay (α)</span>
                                <span className="text-sm font-bold font-mono tabular-nums text-foreground">{cat.contractionFactor}</span>
                              </div>
                            </div>

                            {/* Formula Guidance Micro-Card */}
                            <div className="mt-3 p-2.5 rounded-lg bg-card/60 border border-border text-[11px] text-muted-foreground flex items-center justify-between">
                              <span>Contraction Rate:</span>
                              <span className="font-mono text-foreground font-medium">-{Math.round(cat.contractionFactor * 100)}% / corroboration</span>
                            </div>
                          </CardHeader>

                          <CardFooter className="p-0 pt-3 border-t border-border flex-col items-start">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Escalation Authority Hierarchy
                            </span>
                            {cat.tierTargets && cat.tierTargets.length > 0 ? (
                              <div className="space-y-1.5 w-full">
                                {cat.tierTargets.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs bg-card px-2.5 py-1.5 rounded-lg border border-border text-foreground"
                                  >
                                    <span className="font-semibold text-primary font-mono text-[11px]">Tier {t.tier}</span>
                                    <span className="truncate max-w-[140px]">{t.supervisorRole || t.targetRole}</span>
                                    {t.slaHours ? (
                                      <span className="text-[10px] font-mono text-muted-foreground font-medium">
                                        {t.slaHours}h target
                                      </span>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground italic">No supervisor tiers defined</div>
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
            <TabsContent value="staff" className="mt-0 w-full" forceMount>
              <Card className="rounded-2xl shadow-xs border-border bg-card">
                <CardHeader className="p-6 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" /> Staff Members & Category Pools
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
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
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Provision Staff
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-6 pt-0 space-y-6">
                  {staffList.length === 0 ? (
                    <div className="border border-dashed border-border rounded-xl p-10 text-center space-y-3 bg-muted/40">
                      <Users className="w-10 h-10 text-muted-foreground mx-auto" />
                      <p className="text-sm text-foreground font-medium">No staff members provisioned yet.</p>
                      <p className="text-xs text-muted-foreground">Provision initial personnel to establish response capacity in category pools.</p>
                      <Button
                        variant="link"
                        onClick={() => setIsStaffModalOpen(true)}
                        className="text-xs text-primary underline p-0 h-auto font-semibold"
                      >
                        Provision your first staff member
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {staffList.map((staff) => (
                        <Card
                          key={staff.id}
                          className="rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-xs border-border bg-muted/20"
                        >
                          <CardHeader className="p-0 space-y-0">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center text-foreground font-semibold text-xs uppercase">
                                  {staff.name.slice(0, 2)}
                                </div>
                                <div>
                                  <CardTitle className="font-bold text-sm text-foreground">{staff.name}</CardTitle>
                                  <CardDescription className="text-xs font-mono text-muted-foreground mt-0.5">{staff.email}</CardDescription>
                                </div>
                              </div>
                              <Badge variant="secondary" className="text-[10px] uppercase font-mono tracking-wider font-semibold">
                                {staff.role}
                              </Badge>
                            </div>
                          </CardHeader>

                          <CardContent className="p-0 pt-3 border-t border-border">
                            <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                              Assigned Category Pools
                            </span>
                            {staff.categoryPools && staff.categoryPools.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {staff.categoryPools.map((pool) => (
                                  <Badge
                                    key={pool.id}
                                    variant="outline"
                                    className="text-xs font-medium bg-card"
                                  >
                                    {pool.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">No category pools assigned</span>
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
            <TabsContent value="escalations" className="mt-0 w-full" forceMount>
              <Card className="rounded-2xl shadow-xs border-border bg-card">
                <CardHeader className="p-6 pb-4">
                  <div>
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <Shield className="w-4 h-4 text-destructive" />
                      <span>Supervisory Escalations & Oversight</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Active incidents that have breached dynamic SLA deadlines and escalated to supervisory tiers. Primary assignee accountability is maintained while designated supervisory authorities provide supervisory intervention.
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-6 pt-0 space-y-6">
                  {escalatedIncidents.length === 0 ? (
                    <div className="border border-dashed border-border rounded-xl p-10 text-center space-y-3 bg-muted/40">
                      <CheckCircle className="w-10 h-10 text-primary mx-auto" />
                      <p className="text-sm text-foreground font-semibold">No Breached or Escalated Incidents</p>
                      <p className="text-xs text-muted-foreground">All active incidents in the organization are currently tracking within their dynamic SLA deadlines.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {escalatedIncidents.map((incident) => (
                        <Card
                          key={incident.id}
                          className="border-destructive/40 rounded-xl p-5 shadow-xs space-y-4 bg-muted/20"
                        >
                          <CardHeader className="p-0 space-y-0">
                            <div className="flex items-start justify-between gap-2">
                              <Badge variant="destructive" className="text-xs font-semibold font-mono">
                                Tier {incident.escalationTier} Escalation
                              </Badge>
                              <Badge variant="outline" className="text-xs font-medium">
                                {incident.status}
                              </Badge>
                            </div>

                            <div className="space-y-1 mt-3">
                              <CardDescription className="text-xs text-muted-foreground font-mono">Incident #{incident.id.slice(-6)}</CardDescription>
                              <CardTitle className="text-sm font-semibold text-foreground">
                                {incident.category?.name || "Problem Category"}
                              </CardTitle>
                            </div>
                          </CardHeader>

                          <CardContent className="p-0 space-y-3">
                            <CountdownTimer deadline={incident.slaDeadline} createdAt={incident.createdAt} />

                            <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-border">
                              <div>
                                <div className="text-muted-foreground text-[11px]">Primary Assignee</div>
                                <div className="text-foreground font-medium truncate">
                                  {incident.assignee?.name || "Unassigned"}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-[11px]">Designated Supervisor</div>
                                <div className="text-foreground font-medium truncate">
                                  {incident.supervisor?.name || "Tier Authority"}
                                </div>
                              </div>
                            </div>
                          </CardContent>

                          <CardFooter className="p-0 pt-2 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                            <span>Corroborations: <strong className="text-foreground font-mono tabular-nums">{incident.corroborationCount}</strong></span>
                            <Button
                              variant="link"
                              size="sm"
                              onClick={() => navigate(`/org/${slug}/staff/dashboard`)}
                              className="inline-flex items-center gap-1 text-primary hover:underline font-medium p-0 h-auto cursor-pointer"
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
        <DialogContent className="w-full sm:max-w-xl p-6 space-y-5 rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border pb-4 p-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">Provision Staff Member</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Create operational credentials and assign category pool routing
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {staffModalError && (
            <Alert variant="destructive" className="p-3 flex items-start gap-2 text-xs font-medium rounded-xl">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <AlertDescription>{staffModalError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleStaffSubmit} noValidate className="space-y-4">
            <div>
              <Label
                htmlFor="staff-name"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5"
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
                className="w-full text-sm h-10 rounded-xl"
              />
            </div>

            <div>
              <Label
                htmlFor="staff-email"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5"
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
                className="w-full text-sm h-10 rounded-xl"
              />
            </div>

            <div>
              <Label
                htmlFor="staff-password"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5"
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
                className="w-full text-sm h-10 rounded-xl"
              />
            </div>

            <div className="pt-2">
              <Label className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5">
                Assign Category Pools
              </Label>
              <p className="text-[11px] text-muted-foreground mb-2.5">
                Select problem categories this staff operator is authorized to claim and resolve.
              </p>
              {categories.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-4 text-center bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    No categories configured yet. Create categories first before assigning pools.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 border border-border rounded-xl p-3 bg-muted/30 max-h-52 overflow-y-auto">
                  {categories.map((cat) => {
                    const isChecked = staffForm.categoryPoolIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        htmlFor={`pool-${cat.id}`}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? "bg-card border-primary/50 text-foreground"
                            : "border-border/60 bg-card/50 text-muted-foreground hover:bg-card hover:text-foreground"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <input
                            id={`pool-${cat.id}`}
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCategoryPool(cat.id)}
                            className="rounded border-input text-primary focus:ring-0 h-4 w-4 cursor-pointer accent-primary"
                          />
                          <span className="text-sm font-medium text-foreground">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <Badge variant="secondary" className="text-[10px]">
                            {cat.baseSlaHours}h Base SLA
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {cat.floorHours}h Floor
                          </Badge>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="flex items-center sm:justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsStaffModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingStaff}
                className="px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer"
              >
                {savingStaff ? "Provisioning..." : "Provision Staff"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-full sm:max-w-2xl p-6 space-y-5 rounded-2xl bg-card border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border pb-4 p-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  {editingCategory ? "Edit Category SLA" : "Add Problem Category"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure dynamic SLA parameters and multi-tier supervisor escalation
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {modalError && (
            <Alert variant="destructive" className="p-3 flex items-start gap-2 text-xs font-medium rounded-xl">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCategorySubmit} noValidate className="space-y-5">
            <div>
              <Label
                htmlFor="category-name"
                className="block text-xs font-semibold uppercase tracking-wider text-foreground mb-1.5"
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
                className="w-full text-sm h-10 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <Label
                  htmlFor="base-sla"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-foreground"
                >
                  Base SLA (Hours)
                </Label>
                <span className="text-[10px] text-muted-foreground block">Initial response ceiling</span>
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
                  className="w-full text-sm font-mono h-9 rounded-lg"
                />
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <Label
                  htmlFor="floor-hours"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-foreground"
                >
                  Floor (Hours)
                </Label>
                <span className="text-[10px] text-muted-foreground block">Hard minimum resolution bound</span>
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
                  className="w-full text-sm font-mono h-9 rounded-lg"
                />
              </div>

              <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-1.5">
                <Label
                  htmlFor="decay-factor"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-foreground"
                >
                  Decay Factor (α)
                </Label>
                <span className="text-[10px] text-muted-foreground block">Contraction multiplier (0.01 - 0.99)</span>
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
                  className="w-full text-sm font-mono h-9 rounded-lg"
                />
              </div>
            </div>

            {/* Dynamic SLA Contraction Simulation Preview */}
            <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  <span>Dynamic Contraction Formula Preview</span>
                </div>
                <code className="text-[10px] font-mono bg-card px-2 py-0.5 rounded border border-border text-foreground">
                  SLA(n) = max(Floor, Base × (1 - α)ⁿ)
                </code>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                As independent complaints corroborate an incident, the deadline accelerates exponentially until bounded by the safety floor.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2 rounded-lg bg-card border border-border text-center">
                  <span className="block text-[10px] text-muted-foreground uppercase font-semibold">1 Complaint</span>
                  <span className="text-xs font-bold font-mono text-foreground">{categoryForm.baseSlaHours}h</span>
                  <span className="block text-[9px] text-muted-foreground">Baseline</span>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border text-center">
                  <span className="block text-[10px] text-muted-foreground uppercase font-semibold">+1 Corroboration</span>
                  <span className="text-xs font-bold font-mono text-foreground">
                    {Math.max(categoryForm.floorHours, Math.round(categoryForm.baseSlaHours * (1 - categoryForm.contractionFactor) * 10) / 10)}h
                  </span>
                  <span className="block text-[9px] text-primary">-{Math.round(categoryForm.contractionFactor * 100)}%</span>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border text-center">
                  <span className="block text-[10px] text-muted-foreground uppercase font-semibold">+2 Corroborations</span>
                  <span className="text-xs font-bold font-mono text-foreground">
                    {Math.max(categoryForm.floorHours, Math.round(categoryForm.baseSlaHours * Math.pow(1 - categoryForm.contractionFactor, 2) * 10) / 10)}h
                  </span>
                  <span className="block text-[9px] text-primary">-{Math.round((1 - Math.pow(1 - categoryForm.contractionFactor, 2)) * 100)}%</span>
                </div>
                <div className="p-2 rounded-lg bg-card border border-border text-center">
                  <span className="block text-[10px] text-muted-foreground uppercase font-semibold">Safety Floor</span>
                  <span className="text-xs font-bold font-mono text-foreground">{categoryForm.floorHours}h</span>
                  <span className="block text-[9px] text-muted-foreground">Absolute minimum</span>
                </div>
              </div>
            </div>

            {/* Dynamic Escalation Tiers */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Escalation Tiers
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Designate supervisory authorities invoked upon dynamic SLA breach
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addTierTarget}
                  className="text-xs text-primary hover:bg-transparent flex items-center gap-1 font-semibold p-0 h-auto cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" /> Add Tier
                </Button>
              </div>

              <div className="space-y-3">
                {categoryForm.tierTargets?.map((t, idx) => (
                  <div key={idx} className="p-3.5 bg-muted/30 border border-border rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-bold font-mono">
                          Tier {t.tier} Configuration
                        </Badge>
                      </div>
                      {categoryForm.tierTargets && categoryForm.tierTargets.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTierTarget(idx)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive p-1 rounded cursor-pointer"
                          title="Remove Tier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label
                          htmlFor={`tier-role-${idx}`}
                          className="text-[11px] text-muted-foreground font-medium block mb-1"
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
                          className="w-full text-xs h-9 rounded-lg"
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`tier-sla-${idx}`}
                          className="text-[11px] text-muted-foreground font-medium block mb-1"
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
                          className="w-full text-xs font-mono h-9 rounded-lg"
                        />
                      </div>
                    </div>
                    <div>
                      <Label
                        htmlFor={`tier-user-${idx}`}
                        className="text-[11px] text-muted-foreground font-medium block mb-1"
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
                        className="w-full text-xs font-mono h-9 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border flex sm:justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingCategory}
                className="px-5 py-2 text-xs font-semibold rounded-xl cursor-pointer"
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
