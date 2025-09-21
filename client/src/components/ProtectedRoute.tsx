import { ReactNode } from 'react';
import { useUser } from '@/components/UserContext';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, LogIn, Loader2, UserCheck } from 'lucide-react';
import { Link } from 'wouter';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireSuperuser?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requireAdmin = false, 
  requireSuperuser = false 
}: ProtectedRouteProps) {
  const { user, isLoading } = useUser();

  // Stop impersonation mutation
  const stopImpersonationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/impersonate/stop");
    },
    onSuccess: () => {
      // Refresh user context and reload page
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      window.location.reload();
    },
  });

  const handleStopImpersonation = () => {
    if (confirm("Are you sure you want to stop impersonating? This will return you to your admin account.")) {
      stopImpersonationMutation.mutate();
    }
  };

  // Show loading while fetching user data
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <Card className="w-96">
          <CardHeader className="text-center">
            <LogIn className="h-16 w-16 mx-auto text-primary mb-4" />
            <CardTitle>Authentication Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You need to be logged in to access this page.
            </p>
            <div className="space-y-2">
              <Link href="/login/client">
                <Button className="w-full" data-testid="button-client-login">
                  Client Login
                </Button>
              </Link>
              <Link href="/login/admin">
                <Button variant="outline" className="w-full" data-testid="button-admin-login">
                  Admin Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check admin access
  if (requireAdmin && user.userType !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
              <p className="text-muted-foreground mb-6">
                You don't have permission to access this area.
              </p>
              <div className="space-y-2">
                {user.isImpersonating ? (
                  <Button 
                    onClick={handleStopImpersonation}
                    disabled={stopImpersonationMutation.isPending}
                    data-testid="button-stop-impersonation"
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    {stopImpersonationMutation.isPending ? "Stopping..." : "Stop Impersonation"}
                  </Button>
                ) : (
                  <Link href="/">
                    <Button data-testid="button-back-dashboard">
                      Back to Dashboard
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check superuser access
  if (requireSuperuser && !user.permissions?.includes('superuser')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">Superuser Access Required</h2>
              <p className="text-muted-foreground mb-6">
                This area requires superuser permissions.
              </p>
              <div className="space-y-2">
                {user.isImpersonating ? (
                  <Button 
                    onClick={handleStopImpersonation}
                    disabled={stopImpersonationMutation.isPending}
                    data-testid="button-stop-impersonation"
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    {stopImpersonationMutation.isPending ? "Stopping..." : "Stop Impersonation"}
                  </Button>
                ) : (
                  <Link href="/admin">
                    <Button data-testid="button-back-admin">
                      Back to Admin Console
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}