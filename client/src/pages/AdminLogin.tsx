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
import { Loader2, Shield, User, Lock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const adminLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

type AdminLoginForm = z.infer<typeof adminLoginSchema>;

export default function AdminLogin() {
  const { setUser } = useUser();
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState<string>("");

  const form = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const loginMutation = useMutation({
    mutationFn: async (data: AdminLoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login/admin", data);
      return await response.json();
    },
    onSuccess: (response) => {
      // Extract user data from response and format it correctly
      const user = response.user;
      const formattedUser = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: 'admin',
        userType: user.userType,
        organizationId: user.organizationId,
        permissions: user.permissions,
        isImpersonating: user.isImpersonating,
        impersonationTarget: user.impersonationTarget
      };
      setUser(formattedUser);
      setLocation("/admin"); // Redirect to admin console
    },
    onError: (error: any) => {
      setServerError(error.message || "Login failed. Please try again.");
    }
  });

  const onSubmit = (data: AdminLoginForm) => {
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
          <h1 className="text-2xl font-semibold tracking-tight">Admin Login</h1>
          <p className="text-muted-foreground">
            Access the administrative console
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Administrator Access
            </CardTitle>
            <CardDescription>
              Sign in with your admin credentials to manage the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Admin Email</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@gpnet.com"
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
                data-testid="button-admin-login"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In to Admin Console"
                )}
              </Button>
            </form>

            {/* Client Login Link */}
            <div className="mt-6 text-center">
              <div className="text-sm text-muted-foreground mb-2">
                Need client access instead?
              </div>
              <Link href="/login/client">
                <Button variant="outline" size="sm" data-testid="link-client-login">
                  Client Login
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