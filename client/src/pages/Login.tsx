import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { login } from "../services/api.js";
import {
  LogIn,
  AlertCircle,
  User,
  Shield,
  Briefcase,
  ArrowLeft,
  Layers,
  Building2,
} from "lucide-react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
                Institutional Access Gate
              </Badge>
            </div>
            <p className="text-xs font-mono text-muted-foreground">/org/{slug}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground h-9 px-3.5 rounded-xl cursor-pointer"
          >
            <Building2 className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Register New Organization</span>
            <span className="sm:hidden">New Org</span>
          </Button>
        </div>
      </header>

      {/* Main Centered Sign In Console */}
      <main className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
              <LogIn className="size-6" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Sign in to Organization
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your credentials to enter your role-specific console
              </p>
            </div>
            <div>
              <Badge variant="outline" className="px-3 py-1 rounded-full text-xs font-mono border-border bg-card">
                /org/{slug}
              </Badge>
            </div>
          </div>

          <Card className="rounded-2xl border-border bg-card shadow-lg">
            <CardHeader className="p-6 sm:p-7 pb-3">
              {/* Universal Role Access Pill Directory */}
              <div className="p-3 rounded-xl bg-card/60 border border-border text-[11px] text-muted-foreground flex flex-col gap-2">
                <span className="font-semibold text-foreground block uppercase tracking-wider text-[10px]">
                  Universal Role Router
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="p-2 rounded-lg bg-card border border-border/70 flex flex-col items-center gap-1">
                    <User className="size-3.5 text-primary" />
                    <span className="font-medium text-foreground">Complainant</span>
                    <span className="text-[9px] text-muted-foreground">Public Portal</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/70 flex flex-col items-center gap-1">
                    <Briefcase className="size-3.5 text-primary" />
                    <span className="font-medium text-foreground">Staff Member</span>
                    <span className="text-[9px] text-muted-foreground">Triage Cockpit</span>
                  </div>
                  <div className="p-2 rounded-lg bg-card border border-border/70 flex flex-col items-center gap-1">
                    <Shield className="size-3.5 text-primary" />
                    <span className="font-medium text-foreground">Admin Officer</span>
                    <span className="text-[9px] text-muted-foreground">Policy Engine</span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 sm:p-7 pt-1 flex flex-col gap-5">
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
                    htmlFor="login-email"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Email Address
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@organization.com"
                    className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="login-password"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Password
                  </Label>
                  <Input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rounded-xl h-11 bg-card border border-input text-foreground text-sm placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary font-mono"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl text-sm font-semibold mt-2 cursor-pointer shadow-xs active:scale-[0.99] transition-all"
                >
                  {loading ? "Authenticating..." : "Sign In"}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="p-6 sm:p-7 pt-0 flex flex-col gap-3.5 text-center text-xs text-muted-foreground">
              <Separator className="border-border" />
              <div>
                <span>New complainant? </span>
                <Link
                  to={`/org/${slug}/register`}
                  className="text-primary hover:underline font-semibold transition"
                >
                  Register Account
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
