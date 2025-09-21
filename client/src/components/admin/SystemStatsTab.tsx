import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  Users, 
  Building, 
  Shield, 
  Activity, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Loader2
} from "lucide-react";

interface SystemStats {
  organizations: {
    total: number;
    active: number;
    inactive: number;
    archived: number;
  };
  users: {
    clientUsers: number;
    adminUsers: number;
    activeUsers: number;
    totalLogins: number;
  };
  cases: {
    total: number;
    new: number;
    inProgress: number;
    completed: number;
    red: number;
    amber: number;
    green: number;
  };
  externalEmails: {
    total: number;
    processed: number;
    unmatched: number;
    needingReview: number;
    pending: number;
    errors: number;
  };
  system: {
    auditEvents: number;
    uptime: string;
    lastBackup?: string;
    version: string;
  };
  recentActivity: {
    logins: number;
    cases: number;
    registrations: number;
  };
}

export default function SystemStatsTab() {
  // Fetch system statistics
  const { 
    data: stats, 
    isLoading,
    error 
  } = useQuery<SystemStats>({ 
    queryKey: ["/api/admin/system-stats"] 
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading system statistics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-red-600">Error loading system statistics</p>
            <p className="text-muted-foreground text-sm mt-2">
              {error.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground">No statistics available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.organizations.total}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="default" className="text-xs">
                {stats.organizations.active} Active
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {stats.organizations.inactive} Inactive
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users.clientUsers + stats.users.adminUsers}</div>
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {stats.users.clientUsers} Clients
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                {stats.users.adminUsers} Admins
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cases</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cases.total}</div>
            <div className="flex gap-1 mt-2">
              <Badge variant="destructive" className="text-xs">
                {stats.cases.red} Red
              </Badge>
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                {stats.cases.amber} Amber
              </Badge>
              <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-300">
                {stats.cases.green} Green
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Healthy</div>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Uptime: {stats.system.uptime}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">External Emails</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.externalEmails.total}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              <Badge variant="default" className="text-xs">
                {stats.externalEmails.processed} Processed
              </Badge>
              {stats.externalEmails.needingReview > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {stats.externalEmails.needingReview} Need Review
                </Badge>
              )}
              {stats.externalEmails.pending > 0 && (
                <Badge variant="outline" className="text-xs">
                  {stats.externalEmails.pending} Pending
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              User Activity (Last 24 Hours)
            </CardTitle>
            <CardDescription>
              Recent user engagement and system usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.recentActivity.logins}</div>
                <div className="text-sm text-muted-foreground">Logins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.recentActivity.cases}</div>
                <div className="text-sm text-muted-foreground">New Cases</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.recentActivity.registrations}</div>
                <div className="text-sm text-muted-foreground">Registrations</div>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Users</span>
                <span className="text-sm text-muted-foreground">{stats.users.activeUsers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Logins</span>
                <span className="text-sm text-muted-foreground">{stats.users.totalLogins}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>
              Platform status and configuration details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Platform Version</span>
                <Badge variant="outline" className="text-xs">
                  {stats.system.version}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Audit Events</span>
                <span className="text-sm text-muted-foreground">{stats.system.auditEvents}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">System Uptime</span>
                <span className="text-sm text-muted-foreground">{stats.system.uptime}</span>
              </div>
              
              {stats.system.lastBackup && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Backup</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(stats.system.lastBackup).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-600 font-medium">All systems operational</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Case Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Case Status Distribution
          </CardTitle>
          <CardDescription>
            Overview of current case statuses and progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.cases.new}</div>
              <div className="text-sm text-muted-foreground">New Cases</div>
              <div className="text-xs text-muted-foreground mt-1">
                {((stats.cases.new / stats.cases.total) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{stats.cases.inProgress}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
              <div className="text-xs text-muted-foreground mt-1">
                {((stats.cases.inProgress / stats.cases.total) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.cases.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-xs text-muted-foreground mt-1">
                {((stats.cases.completed / stats.cases.total) * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-red-600">{stats.cases.red}</div>
              <div className="text-sm text-muted-foreground">High Risk</div>
              <div className="text-xs text-muted-foreground mt-1">
                {((stats.cases.red / stats.cases.total) * 100).toFixed(1)}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}