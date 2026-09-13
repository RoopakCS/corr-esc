import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { registerComplainant } from "../services/api.js";
import { UserPlus, AlertCircle, ShieldCheck, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 shadow-surface">
            <UserPlus className="size-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Complainant Registration
          </h1>
          <div>
            <Badge variant="outline" className="px-3 py-1 rounded-full bg-obsidian-surface border-obsidian-border text-xs font-mono text-emerald-400">
              /org/{slug}
            </Badge>
          </div>
        </div>

        {/* Privacy reassurance callout */}
        <Alert className="bg-obsidian-surface border-obsidian-border text-slate-300 shadow-surface">
          <ShieldCheck className="size-4 text-emerald-400" />
          <AlertTitle className="font-semibold text-slate-200 text-xs">
            Blind Complaint Ingestion
          </AlertTitle>
          <AlertDescription className="text-[11px] text-slate-400 leading-relaxed mt-1">
            All submitted complaints are processed independently without public exposure, ensuring unbiased SLA clustering and dynamic acceleration.
          </AlertDescription>
        </Alert>

        <Card className="bg-obsidian-surface/95 border-obsidian-border rounded-2xl shadow-elevated text-slate-100">
          <CardContent className="p-6 sm:p-8 flex flex-col gap-6">
            {error && (
              <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/30 text-rose-300">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="complainant-name"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Full Name
                </Label>
                <Input
                  id="complainant-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. John Doe"
                  className="bg-obsidian border-obsidian-border text-slate-100 placeholder:text-slate-500 focus-ring rounded-xl h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="complainant-email"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Email Address
                </Label>
                <Input
                  id="complainant-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="you@domain.com"
                  className="bg-obsidian border-obsidian-border text-slate-100 placeholder:text-slate-500 focus-ring rounded-xl h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="complainant-password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Password
                </Label>
                <Input
                  id="complainant-password"
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  className="bg-obsidian border-obsidian-border text-slate-100 placeholder:text-slate-500 focus-ring rounded-xl h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="complainant-confirm-password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Confirm Password
                </Label>
                <Input
                  id="complainant-confirm-password"
                  type="password"
                  required
                  minLength={6}
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  placeholder="••••••••"
                  className="bg-obsidian border-obsidian-border text-slate-100 placeholder:text-slate-500 focus-ring rounded-xl h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 focus-ring pressable shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all duration-200 mt-2"
              >
                {loading ? "Creating Account..." : "Create Complainant Account"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="p-6 sm:p-8 pt-0 flex flex-col gap-3 text-center text-xs text-slate-400">
            <Separator className="bg-obsidian-border mb-2" />
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
                <ArrowLeft className="size-3" />
                <span>Switch or create another organization</span>
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
