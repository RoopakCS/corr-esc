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
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Institutional Value Proposition & Architecture */}
        <div className="lg:col-span-6 flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div>
              <Badge variant="outline" className="gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
                <Sparkles className="size-3.5" />
                <span>Decentralized Grievance Escalation Engine</span>
              </Badge>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              CORR-ESC
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
              A corroboration-driven SLA escalation framework for decentralized grievance resolution across arbitrary institutional and organizational domains.
            </p>
          </div>

          {/* Architectural Pillars */}
          <div className="flex flex-col gap-4 pt-2">
            {ARCHITECTURAL_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <Card
                  key={pillar.title}
                  className="transition-all duration-200"
                >
                  <CardContent className="p-4 flex items-start gap-3.5">
                    <div
                      className={`p-2 rounded-lg ${pillar.iconBg} ${pillar.iconColor} border flex-shrink-0 mt-0.5`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h2 className="text-sm font-semibold text-foreground leading-snug">{pillar.title}</h2>
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
          <Card className="rounded-2xl shadow-lg">
            <CardHeader className="p-6 sm:p-8 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                    Create Organization
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-1">
                    Establish a dedicated organization domain for SLA governance and escalation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-8 pt-2 flex flex-col gap-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription className="text-xs font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
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
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="org-slug"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Organization URL Slug
                  </Label>
                  <div className="flex rounded-xl overflow-hidden border border-input focus-within:ring-2 focus-within:ring-ring">
                    <span className="inline-flex items-center px-3.5 bg-muted text-muted-foreground text-xs font-mono border-r border-input">
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
                      className="border-0 rounded-none bg-transparent placeholder:text-muted-foreground text-sm font-mono h-11 focus-visible:ring-0 focus-visible:outline-none"
                    />
                  </div>
                  {formData.slug && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono">
                      {isSlugValid ? (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Valid domain: /org/{formData.slug}/portal
                        </span>
                      ) : (
                        <span className="text-amber-500 flex items-center gap-1">
                          <AlertCircle className="size-3" /> Slug must be ≥3 characters (letters, numbers, hyphens)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <Separator className="my-1" />

                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
                    <ShieldCheck className="size-4" />
                    <span>Organization Admin</span>
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
                      className="rounded-xl h-11"
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
                      className="rounded-xl h-11"
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
                      className="rounded-xl h-11"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl text-sm font-semibold mt-2"
                >
                  {loading ? "Creating Organization..." : "Create Organization"}
                </Button>

                <div className="pt-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Need to sign in to an existing organization?{" "}
                    <span className="text-foreground font-mono">/org/&lt;slug&gt;/login</span>
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
