import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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
  Layers,
  LogIn,
  ArrowRight,
  Activity,
  Clock,
  Shield,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const ARCHITECTURAL_PILLARS = [
  {
    icon: GitMerge,
    iconColor: "text-primary",
    iconBg: "bg-primary/10 border-primary/20",
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

const INSTITUTIONAL_METRICS = [
  {
    label: "Contraction Decay",
    value: "Floor Safe",
    icon: Clock,
  },
  {
    label: "Supervision",
    value: "Dual Audit",
    icon: Shield,
  },
  {
    label: "Pool Routing",
    value: "Autonomous",
    icon: Activity,
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
  const [quickLoginSlug, setQuickLoginSlug] = useState("");
  const [showQuickLogin, setShowQuickLogin] = useState(false);

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

  const handleJumpToLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickLoginSlug.trim()) {
      navigate(`/org/${cleanSlugInput(quickLoginSlug)}/login`);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-primary/20 selection:text-primary">
      {/* Institutional Top Navbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-foreground leading-tight tracking-tight">
                Institutional Setup
              </span>
              <Badge variant="secondary" className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full">
                Decentralized SLA Framework
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground">Institutional Onboarding Console</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowQuickLogin(!showQuickLogin)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground h-9 px-3.5 rounded-xl cursor-pointer"
          >
            <LogIn className="size-3.5 text-primary" />
            <span>Sign In to Org</span>
          </Button>
        </div>
      </header>

      {/* Optional Quick Sign In Dropdown Bar */}
      {showQuickLogin && (
        <div className="border-b border-border bg-card/95 px-6 py-3 transition-all animate-in fade-in slide-in-from-top-2">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              <span>Enter your registered organization slug to access the universal login gate:</span>
            </div>
            <form onSubmit={handleJumpToLogin} className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex rounded-xl overflow-hidden border border-input focus-within:border-primary">
                <span className="inline-flex items-center px-2.5 bg-muted/60 text-muted-foreground text-xs font-mono border-r border-input">
                  /org/
                </span>
                <Input
                  type="text"
                  placeholder="organization-slug"
                  value={quickLoginSlug}
                  onChange={(e) => setQuickLoginSlug(e.target.value)}
                  className="border-0 rounded-none bg-card text-xs font-mono h-8 w-44 focus-visible:ring-0"
                />
              </div>
              <Button type="submit" size="sm" className="h-8 rounded-xl text-xs px-3 font-semibold cursor-pointer">
                <span>Go to Gate</span>
                <ArrowRight className="size-3 ml-1" />
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Main Hero & Console Grid */}
      <main className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Institutional Value Proposition & Architectural Pillars */}
          <div className="lg:col-span-6 flex flex-col gap-6 pt-2">
            <div className="flex flex-col gap-3">
              <div>
                <Badge variant="outline" className="gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border-border bg-card/60">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Decentralized Grievance Escalation Engine</span>
                </Badge>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15]">
                CORR-ESC
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl">
                A corroboration-driven SLA escalation framework for decentralized grievance resolution across arbitrary institutional and organizational domains.
              </p>
            </div>

            {/* Institutional Core Guarantees Banner */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl border border-border bg-card/50">
              {INSTITUTIONAL_METRICS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex flex-col items-center text-center p-2 rounded-xl bg-card/80 border border-border/50">
                    <Icon className="size-4 text-primary mb-1" />
                    <span className="text-[11px] font-mono font-semibold text-foreground">{item.value}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Architectural Pillars */}
            <div className="flex flex-col gap-3.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Core Architectural Mechanics
              </span>
              {ARCHITECTURAL_PILLARS.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <Card
                    key={pillar.title}
                    className="border-border bg-card/70 hover:bg-card transition-all duration-200 rounded-xl"
                  >
                    <CardContent className="p-4 flex items-start gap-3.5">
                      <div
                        className={`p-2 rounded-xl ${pillar.iconBg} ${pillar.iconColor} border flex-shrink-0 mt-0.5 shadow-2xs`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-bold text-foreground leading-snug">{pillar.title}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {pillar.description}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right Column: Organization Registration Console */}
          <div className="lg:col-span-6">
            <Card className="rounded-2xl border-border bg-card shadow-lg">
              <CardHeader className="p-6 sm:p-7 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center flex-shrink-0">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                      Create Organization
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Establish a dedicated organization domain for SLA governance and escalation
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-7 pt-2 flex flex-col gap-5">
                {error && (
                  <Alert variant="destructive" className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-3.5">
                    <AlertCircle className="size-4" />
                    <AlertDescription className="text-xs font-medium">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                <form className="flex flex-col gap-4.5" onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="org-name"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Organization Name
                    </Label>
                    <Input
                      id="org-name"
                      type="text"
                      required
                      value={formData.organizationName}
                      onChange={handleNameChange}
                      placeholder="e.g. Saveetha Campus, Apex Towers"
                      className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label
                      htmlFor="org-slug"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Organization URL Slug
                    </Label>
                    <div className="flex rounded-xl overflow-hidden border border-input bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                      <span className="inline-flex items-center px-3.5 bg-muted/50 text-muted-foreground text-xs font-mono border-r border-input select-none">
                        /org/
                      </span>
                      <Input
                        id="org-slug"
                        type="text"
                        required
                        value={formData.slug}
                        onChange={(e) =>
                          setFormData({ ...formData, slug: cleanSlugInput(e.target.value) })
                        }
                        placeholder="saveetha-campus"
                        className="border-0 rounded-none bg-transparent placeholder:text-muted-foreground/50 text-sm font-mono h-11 focus-visible:ring-0 focus-visible:outline-none"
                      />
                    </div>
                    {formData.slug && (
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
                        {isSlugValid ? (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Valid domain: /org/{formData.slug}/portal
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1">
                            <AlertCircle className="size-3" /> Slug must be ≥3 characters (letters, numbers, hyphens)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <Separator className="my-1 border-border" />

                  <div className="flex flex-col gap-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                      <ShieldCheck className="size-4" />
                      <span>Organization Admin Account</span>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="admin-name"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Admin Full Name
                      </Label>
                      <Input
                        id="admin-name"
                        type="text"
                        required
                        value={formData.adminName}
                        onChange={(e) =>
                          setFormData({ ...formData, adminName: e.target.value })
                        }
                        placeholder="e.g. Dr. Hemavathy"
                        className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="admin-email"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Admin Email Address
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        required
                        value={formData.adminEmail}
                        onChange={(e) =>
                          setFormData({ ...formData, adminEmail: e.target.value })
                        }
                        placeholder="admin@organization.com"
                        className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label
                        htmlFor="admin-password"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Master Password
                      </Label>
                      <Input
                        id="admin-password"
                        type="password"
                        required
                        minLength={6}
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        placeholder="••••••••"
                        className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary font-mono"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 rounded-xl text-sm font-semibold mt-2 cursor-pointer shadow-xs active:scale-[0.99] transition-all"
                  >
                    {loading ? "Creating Organization..." : "Create Organization"}
                  </Button>

                  <div className="pt-2 text-center">
                    <p className="text-xs text-muted-foreground">
                      Need to sign in to an existing organization?{" "}
                      <Link
                        to={formData.slug ? `/org/${formData.slug}/login` : "#"}
                        onClick={(e) => {
                          if (!formData.slug) {
                            e.preventDefault();
                            setShowQuickLogin(true);
                          }
                        }}
                        className="text-foreground hover:underline font-mono"
                      >
                        /org/&lt;slug&gt;/login
                      </Link>
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
