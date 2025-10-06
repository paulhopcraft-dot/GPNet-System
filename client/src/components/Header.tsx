import { Bell, Search, Settings, User, Shield, UserCheck, LogOut, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser } from "@/components/UserContext";
import { useSearch } from "@/contexts/SearchContext";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import gpnetLogo from "@assets/GPNet Logo Design_1758707602382.png";

export default function Header() {
  const { user, setUser } = useUser();
  const { searchQuery, setSearchQuery } = useSearch();
  const [, setLocation] = useLocation();

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

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // Clear user context and redirect to appropriate login based on user type
      const isAdmin = user?.userType === 'admin';
      setUser(null);
      queryClient.clear();
      setLocation(isAdmin ? "/login/admin" : "/login/client");
    },
  });

  const handleStopImpersonation = () => {
    if (confirm("Are you sure you want to stop impersonating? This will return you to your admin account.")) {
      stopImpersonationMutation.mutate();
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Get time-appropriate greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Check if user is admin and show personalized greeting
  const showAdminGreeting = user?.userType === 'admin' && user?.name?.includes('Natalie');

  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo and Brand */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <img 
              src={gpnetLogo} 
              alt="GPNet" 
              className="h-10 w-10 cursor-pointer hover-elevate rounded-full"
              data-testid="logo-home"
            />
          </Link>
          
          {/* Impersonation Indicator */}
          {user?.isImpersonating && (
            <div className="flex items-center gap-3 px-4 py-2 bg-orange-50 dark:bg-orange-950 border border-orange-300 dark:border-orange-700 rounded-lg">
              <Badge variant="outline" className="text-sm bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-600">
                <UserCheck className="h-4 w-4 mr-1" />
                Viewing as Default Organization
              </Badge>
              <Button 
                size="default" 
                variant="destructive" 
                onClick={handleStopImpersonation}
                disabled={stopImpersonationMutation.isPending}
                data-testid="button-stop-impersonation"
                className="font-semibold"
              >
                <LogOut className="h-4 w-4 mr-2" />
                {stopImpersonationMutation.isPending ? "Stopping..." : "Exit to Admin View"}
              </Button>
            </div>
          )}
        </div>

        {/* Admin Greeting */}
        {showAdminGreeting && (
          <div className="flex items-center">
            <h2 className="text-lg font-medium text-foreground" data-testid="text-admin-greeting">
              {getGreeting()} Natalie
            </h2>
          </div>
        )}

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cases, workers, or tickets..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" data-testid="button-notifications">
            <Bell className="h-4 w-4" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs">
              3
            </Badge>
          </Button>

          <Button size="icon" variant="ghost" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>

          {/* Admin Console Access */}
          {user?.userType === 'admin' && (
            <Link href="/admin">
              <Button size="icon" variant="ghost" data-testid="button-admin-console">
                <Shield className="h-4 w-4" />
              </Button>
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-user-menu">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2 py-1.5 text-sm">
                <div className="font-medium">{user?.name || "Unknown User"}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
                <div className="flex items-center gap-1 mt-1">
                  {user?.userType === 'admin' && (
                    <Badge variant="secondary" className="text-xs">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  {user?.permissions?.includes('superuser') && (
                    <Badge variant="default" className="text-xs">
                      Superuser
                    </Badge>
                  )}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem data-testid="menu-profile">
                <User className="h-4 w-4 mr-2" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="menu-settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              {user?.userType === 'admin' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="w-full">
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Console
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}