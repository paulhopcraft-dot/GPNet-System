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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Building, User, Lock, Shield, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

const clientLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  organizationSlug: z.string().min(1, "Organization is required")
});

const adminLoginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required")
});

type ClientLoginForm = z.infer<typeof clientLoginSchema>;
type AdminLoginForm = z.infer<typeof adminLoginSchema>;

export default function Login() {
  const { setUser } = useUser();
  const [, setLocation] = useLocation();
  const [serverError, setServerError] = useState<string>("");
  const [loginMode, setLoginMode] = useState<"client" | "admin">("admin");

  const clientForm = useForm<ClientLoginForm>({
    resolver: zodResolver(clientLoginSchema),
    defaultValues: {
      email: "",
      password: "",
      organizationSlug: ""
    }
  });

  const adminForm = useForm<AdminLoginForm>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const clientLoginMutation = useMutation({
    mutationFn: async (data: ClientLoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login/client", data);
      return await response.json();
    },
    onSuccess: (response) => {
      const user = response.user;
      const formattedUser = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: 'client',
        userType: 'client' as const,
        organizationId: user.organizationId
      };
      setUser(formattedUser);
      setLocation("/"); // Redirect to client dashboard
    },
    onError: (error: any) => {
      setServerError(error.message || "Login failed. Please try again.");
    }
  });

  const adminLoginMutation = useMutation({
    mutationFn: async (data: AdminLoginForm) => {
      const response = await apiRequest("POST", "/api/auth/login/admin", data);
      return await response.json();
    },
    onSuccess: (response) => {
      const user = response.user;
      const formattedUser = {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: 'admin',
        userType: 'admin' as const,
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

  const onClientSubmit = (data: ClientLoginForm) => {
    setServerError("");
    clientLoginMutation.mutate(data);
  };

  const onAdminSubmit = (data: AdminLoginForm) => {
    setServerError("");
    adminLoginMutation.mutate(data);
  };

  const handleTabChange = (value: string) => {
    setLoginMode(value as "client" | "admin");
    setServerError("");
    clientForm.reset();
    adminForm.reset();
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
          <h1 className="text-2xl font-semibold tracking-tight">Welcome Back</h1>
          <p className="text-muted-foreground">
            Sign in to access the case management system
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Choose your account type and enter your credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={loginMode} onValueChange={handleTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="admin" data-testid="tab-admin">
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </TabsTrigger>
                <TabsTrigger value="client" data-testid="tab-client">
                  <Building className="h-4 w-4 mr-2" />
                  Client
                </TabsTrigger>
              </TabsList>

              {/* Admin Login Form */}
              <TabsContent value="admin" className="space-y-4">
                <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="space-y-4">
                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@gpnet.com"
                        className="pl-9"
                        data-testid="input-admin-email"
                        {...adminForm.register("email")}
                      />
                    </div>
                    {adminForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {adminForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="admin-password"
                        type="password"
                        className="pl-9"
                        data-testid="input-admin-password"
                        {...adminForm.register("password")}
                      />
                    </div>
                    {adminForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {adminForm.formState.errors.password.message}
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
                    disabled={adminLoginMutation.isPending}
                    data-testid="button-admin-login"
                  >
                    {adminLoginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      "Sign In as Admin"
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Client Login Form */}
              <TabsContent value="client" className="space-y-4">
                <form onSubmit={clientForm.handleSubmit(onClientSubmit)} className="space-y-4">
                  {/* Organization Slug */}
                  <div className="space-y-2">
                    <Label htmlFor="client-organization">Organization</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="client-organization"
                        placeholder="your-company"
                        className="pl-9"
                        data-testid="input-client-organization"
                        {...clientForm.register("organizationSlug")}
                      />
                    </div>
                    {clientForm.formState.errors.organizationSlug && (
                      <p className="text-sm text-destructive">
                        {clientForm.formState.errors.organizationSlug.message}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="client-email">Email</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="client-email"
                        type="email"
                        placeholder="name@company.com"
                        className="pl-9"
                        data-testid="input-client-email"
                        {...clientForm.register("email")}
                      />
                    </div>
                    {clientForm.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {clientForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="client-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="client-password"
                        type="password"
                        className="pl-9"
                        data-testid="input-client-password"
                        {...clientForm.register("password")}
                      />
                    </div>
                    {clientForm.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {clientForm.formState.errors.password.message}
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
                    disabled={clientLoginMutation.isPending}
                    data-testid="button-client-login"
                  >
                    {clientLoginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      "Sign In as Client"
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
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
