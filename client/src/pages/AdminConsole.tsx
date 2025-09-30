import { useState } from "react";
import { useUser } from "@/components/UserContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building, 
  Users, 
  Shield, 
  Activity, 
  Settings, 
  BarChart3,
  Database,
  UserCheck,
  Archive,
  Eye,
  Mail,
  FileText,
  Download,
  Upload,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import OrganizationsTab from "@/components/admin/OrganizationsTab";
import ClientUsersTab from "@/components/admin/ClientUsersTab";
import AdminUsersTab from "@/components/admin/AdminUsersTab";
import AuditLogsTab from "@/components/admin/AuditLogsTab";
import SystemStatsTab from "@/components/admin/SystemStatsTab";
import CrossTenantAnalyticsTab from "@/components/admin/CrossTenantAnalyticsTab";
import UnmatchedEmailsTab from "@/components/admin/UnmatchedEmailsTab";
import AdminCasesTab from "@/components/admin/AdminCasesTab";
import CompaniesTab from "@/components/admin/CompaniesTab";
import { FreshdeskTab } from "@/components/admin/FreshdeskTab";

// Database Migration Card Component
function DatabaseMigrationCard() {
  const { toast } = useToast();
  
  const migrationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/execute-migration', {});
      return res;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Migration Successful!",
        description: data.message || `Database now has ${data.casesImported} cases`,
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Migration Failed",
        description: error.message || "Failed to migrate data. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleMigration = () => {
    if (confirm("This will import 108 demo cases into the current database. Continue?")) {
      migrationMutation.mutate();
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Database Migration
        </CardTitle>
        <CardDescription>
          Import 108 demo cases into your production database
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="font-medium mb-1">One-Click Migration</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Click the button below to import all 108 demo patient cases, workers, and admin users into the current database. This operation is safe and can be run multiple times.
            </p>
            <Button 
              onClick={handleMigration}
              disabled={migrationMutation.isPending}
              className="gap-2"
              data-testid="button-execute-migration"
            >
              {migrationMutation.isPending ? (
                <>
                  <Upload className="h-4 w-4 animate-pulse" />
                  Migrating...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import 108 Demo Cases
                </>
              )}
            </Button>
          </div>
        </div>
        
        {migrationMutation.isSuccess && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-700 font-medium">
              Migration completed successfully!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminConsole() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState("overview");

  // TEMPORARY: Bypass authentication for development
  const mockUser = user || {
    id: 'dev-user',
    email: 'support@gpnet.au',
    name: 'Natalie Support',
    userType: 'admin' as const,
    permissions: ['admin', 'superuser']
  };

  // Check if user has admin access (TEMPORARILY DISABLED FOR DEVELOPMENT)
  // if (!user || user.userType !== 'admin') {
  //   return (
  //     <div className="container mx-auto px-6 py-8">
  //       <Card>
  //         <CardContent className="pt-6">
  //           <div className="text-center py-12">
  //             <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
  //             <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
  //             <p className="text-muted-foreground">
  //               You don't have permission to access the admin console.
  //             </p>
  //           </div>
  //         </CardContent>
  //       </Card>
  //     </div>
  //   );
  // }

  return (
    <div className="container mx-auto px-6 py-8">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-admin-console-title">
            GPNet Admin Console
          </h1>
          <p className="text-lg text-primary mt-1 mb-2" data-testid="text-greeting">
            Good afternoon {mockUser.name?.split(' ')[0] || 'Natalie'}
          </p>
          <p className="text-muted-foreground">
            Manage organizations, users, and system administration
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="default" data-testid="badge-admin-role">
              <Shield className="w-3 h-3 mr-1" />
              Administrator
            </Badge>
            {mockUser.permissions?.includes('superuser') && (
              <Badge variant="secondary" data-testid="badge-superuser-role">
                <UserCheck className="w-3 h-3 mr-1" />
                Superuser
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Admin Console Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${mockUser.permissions?.includes('superuser') ? 'grid-cols-11' : 'grid-cols-10'}`}>
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="companies" className="flex items-center gap-2" data-testid="tab-companies">
            <Building className="h-4 w-4" />
            Companies
          </TabsTrigger>
          <TabsTrigger value="cases" className="flex items-center gap-2" data-testid="tab-cases">
            <FileText className="h-4 w-4" />
            Cases
          </TabsTrigger>
          {mockUser.permissions?.includes('superuser') && (
            <TabsTrigger value="cross-tenant" className="flex items-center gap-2" data-testid="tab-cross-tenant">
              <Eye className="h-4 w-4" />
              Cross-Tenant
            </TabsTrigger>
          )}
          <TabsTrigger value="organizations" className="flex items-center gap-2" data-testid="tab-organizations">
            <Building className="h-4 w-4" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="client-users" className="flex items-center gap-2" data-testid="tab-client-users">
            <Users className="h-4 w-4" />
            Client Users
          </TabsTrigger>
          <TabsTrigger value="admin-users" className="flex items-center gap-2" data-testid="tab-admin-users">
            <Shield className="h-4 w-4" />
            Admin Users
          </TabsTrigger>
          <TabsTrigger value="audit-logs" className="flex items-center gap-2" data-testid="tab-audit-logs">
            <Activity className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="unmatched-emails" className="flex items-center gap-2" data-testid="tab-unmatched-emails">
            <Mail className="h-4 w-4" />
            Unmatched Emails
          </TabsTrigger>
          <TabsTrigger value="freshdesk" className="flex items-center gap-2" data-testid="tab-freshdesk">
            <Database className="h-4 w-4" />
            Freshdesk
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2" data-testid="tab-system">
            <Settings className="h-4 w-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SystemStatsTab />
        </TabsContent>

        <TabsContent value="companies" className="space-y-6">
          <CompaniesTab />
        </TabsContent>

        <TabsContent value="cases" className="space-y-6">
          <AdminCasesTab />
        </TabsContent>

        {mockUser.permissions?.includes('superuser') && (
          <TabsContent value="cross-tenant" className="space-y-6">
            <CrossTenantAnalyticsTab />
          </TabsContent>
        )}

        <TabsContent value="organizations" className="space-y-6">
          <OrganizationsTab />
        </TabsContent>

        <TabsContent value="client-users" className="space-y-6">
          <ClientUsersTab />
        </TabsContent>

        <TabsContent value="admin-users" className="space-y-6">
          <AdminUsersTab />
        </TabsContent>

        <TabsContent value="audit-logs" className="space-y-6">
          <AuditLogsTab />
        </TabsContent>

        <TabsContent value="unmatched-emails" className="space-y-6">
          <UnmatchedEmailsTab />
        </TabsContent>

        <TabsContent value="freshdesk" className="space-y-6">
          <FreshdeskTab />
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          {mockUser.permissions?.includes('superuser') && (
            <DatabaseMigrationCard />
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Settings
              </CardTitle>
              <CardDescription>
                System configuration and maintenance options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Archive className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">Archive Management</h3>
                      <p className="text-sm text-muted-foreground">View and restore archived data</p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Settings className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <h3 className="font-medium">System Configuration</h3>
                      <p className="text-sm text-muted-foreground">Application settings and preferences</p>
                    </div>
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}