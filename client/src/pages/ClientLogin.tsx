import { useState } from "react";
import { useUser } from "@/components/UserContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Building, User, Lock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const clientLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  organizationSlug: z.string().min(1, "Organization is required")
});

type ClientLoginForm = z.infer<typeof clientLoginSchema>;

export default function ClientLogin() {
  const { setUser } = useUser();
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState<string>("");

  const form = useForm<ClientLoginForm>({
    resolver: zodResolver(clientLoginSchema),
    defaultValues: {
      email: "",
      password: "",
      organizationSlug: ""
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: ClientLoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login/client", data);
      return await response.json();
    },
    onSuccess: (userData) => {
      setUser(userData);
      setLocation("/"); // Redirect to dashboard
    },
    onError: (error: any) => {
      setServerError(error.message || "Login failed. Please try again.");
    }
  });

  const onSubmit = (data: ClientLoginForm) => {
    setServerError("");
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50">
      <div className="w-full max-w-md space-y-6 p-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="h-10 w-10 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold">GP</span>
            </div>
            <span className="text-2xl font-bold">GPNet</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Client Login</h1>
          <p className="text-muted-foreground">
            Access your pre-employment health assessments
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Sign In to Your Account
            </CardTitle>
            <CardDescription>
              Enter your credentials to access the GPNet system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Organization Slug */}
              <div className="space-y-2">
                <Label htmlFor="organizationSlug">Organization</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="organizationSlug"
                    placeholder="your-company"
                    className="pl-9"
                    data-testid="input-organization"
                    {...form.register("organizationSlug")}
                  />
                </div>
                {form.formState.errors.organizationSlug && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.organizationSlug.message}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className="pl-9"
                    data-testid="input-email"
                    {...form.register("email")}
                  />
                </div>
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    data-testid="input-password"
                    {...form.register("password")}
                  />
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {/* Server Error */}
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            {/* Admin Login Link */}
            <div className="mt-6 text-center">
              <div className="text-sm text-muted-foreground mb-2">
                Need admin access?
              </div>
              <Link href="/login/admin">
                <Button variant="outline" size="sm" data-testid="link-admin-login">
                  Admin Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Back to Public */}
        <div className="text-center">
          <Link href="/form">
            <Button variant="ghost" size="sm" data-testid="link-worker-form">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Worker Form
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}