import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { registerComplainant } from "../services/api.js";
import { UserPlus, AlertCircle, ShieldCheck, ArrowLeft, Layers, LogIn } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans antialiased selection:bg-primary/20 selection:text-primary">
      {/* Institutional Top Navbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base text-foreground leading-tight tracking-tight">
                CORR-ESC
              </h1>
              <Badge variant="secondary" className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full">
                Public Gateway
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground">/org/{slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/org/${slug}/login`)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground h-9 px-3.5 rounded-xl cursor-pointer"
          >
            <LogIn className="size-3.5 text-primary" />
            <span>Sign In</span>
          </Button>
        </div>
      </header>

      {/* Main Centered Registration Console */}
      <main className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
              <UserPlus className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Complainant Registration
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Create your verified identity for blind grievance submission & SLA tracking
              </p>
            </div>
            <div>
              <Badge variant="outline" className="px-3 py-1 rounded-full text-xs font-mono border-border bg-card">
                /org/{slug}
              </Badge>
            </div>
          </div>

          {/* Privacy reassurance callout */}
          <Alert className="border-border bg-card/70 shadow-xs rounded-2xl p-4">
            <ShieldCheck className="size-4 text-primary mt-0.5" />
            <AlertTitle className="font-semibold text-xs text-foreground">
              Blind Complaint Ingestion
            </AlertTitle>
            <AlertDescription className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              All submitted complaints are processed independently without public exposure, ensuring unbiased SLA clustering and dynamic acceleration.
            </AlertDescription>
          </Alert>

          <Card className="rounded-2xl border-border bg-card shadow-lg">
            <CardContent className="p-6 sm:p-7 flex flex-col gap-5">
              {error && (
                <Alert variant="destructive" className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-3.5">
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
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
                    className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="complainant-email"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
                    className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="complainant-password"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
                    className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="complainant-confirm-password"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
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
                    className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl text-sm font-semibold mt-2 cursor-pointer shadow-xs active:scale-[0.99] transition-all"
                >
                  {loading ? "Creating Account..." : "Create Complainant Account"}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="p-6 sm:p-7 pt-0 flex flex-col gap-3.5 text-center text-xs text-muted-foreground">
              <Separator className="border-border" />
              <div>
                <span>Already have an account? </span>
                <Link
                  to={`/org/${slug}/login`}
                  className="text-primary hover:underline font-semibold transition"
                >
                  Sign In
                </Link>
              </div>
              <div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition text-[11px]"
                >
                  <ArrowLeft className="size-3" />
                  <span>Switch or create another organization</span>
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    </div>
  );
}
