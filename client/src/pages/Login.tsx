import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { login } from "../services/api.js";
import { LogIn, AlertCircle, User, Shield, Briefcase, ArrowLeft } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-3">
          <div className="inline-flex p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <LogIn className="size-7" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Sign in to Organization
          </h1>
          <div>
            <Badge variant="outline" className="px-3 py-1 rounded-full text-xs font-mono">
              /org/{slug}
            </Badge>
          </div>
        </div>

        <Card className="rounded-2xl shadow-lg">
          <CardHeader className="p-6 sm:p-8 pb-4">
            {/* Role access directory pill */}
            <div className="p-3 rounded-xl bg-muted border text-[11px] text-muted-foreground flex flex-col gap-1.5">
              <span className="font-semibold text-foreground block uppercase tracking-wider text-[10px]">
                Universal Portal Access
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className="p-1.5 rounded-lg bg-background border flex flex-col items-center gap-1">
                  <User className="size-3 text-muted-foreground" />
                  <span>Complainant</span>
                </div>
                <div className="p-1.5 rounded-lg bg-background border flex flex-col items-center gap-1">
                  <Briefcase className="size-3 text-muted-foreground" />
                  <span>Staff</span>
                </div>
                <div className="p-1.5 rounded-lg bg-background border flex flex-col items-center gap-1">
                  <Shield className="size-3 text-muted-foreground" />
                  <span>Admin Console</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8 pt-0 flex flex-col gap-5">
            {error && (
              <Alert variant="destructive">
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
                  className="rounded-xl h-11"
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
                  className="rounded-xl h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl text-sm font-semibold mt-2"
              >
                {loading ? "Authenticating..." : "Sign In"}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="p-6 sm:p-8 pt-0 flex flex-col gap-3 text-center text-xs text-muted-foreground">
            <Separator className="mb-2" />
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
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition text-[11px]"
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
