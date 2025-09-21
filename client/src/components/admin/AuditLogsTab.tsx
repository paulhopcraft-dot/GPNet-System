import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Search, 
  Calendar,
  Loader2,
  User,
  Building,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react";

interface AuditEvent {
  id: string;
  timestamp: string;
  eventType: string;
  eventCategory: string;
  actorId: string;
  actorType: string;
  actorEmail: string;
  organizationId?: string;
  organizationName?: string;
  targetType?: string;
  targetId?: string;
  action: string;
  result: 'success' | 'failure' | 'error';
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export default function AuditLogsTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [selectedOrganization, setSelectedOrganization] = useState<string>("all");

  // Fetch audit logs
  const { 
    data: auditLogs = [], 
    isLoading,
    error 
  } = useQuery<AuditEvent[]>({ 
    queryKey: ["/api/admin/audit-logs"] 
  });

  // Fetch organizations for filter
  const { data: organizations = [] } = useQuery<any[]>({ 
    queryKey: ["/api/admin/organizations"] 
  });

  // Get unique event types for filter
  const eventTypes = Array.from(new Set(auditLogs.map(log => log.eventType)));

  // Filter audit logs
  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.eventType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEventType = eventTypeFilter === "all" || log.eventType === eventTypeFilter;
    const matchesResult = resultFilter === "all" || log.result === resultFilter;
    const matchesOrganization = selectedOrganization === "all" || log.organizationId === selectedOrganization;
    
    return matchesSearch && matchesEventType && matchesResult && matchesOrganization;
  });

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getResultBadge = (result: string) => {
    const variant = result === 'success' ? 'default' : result === 'failure' ? 'destructive' : 'secondary';
    return (
      <Badge variant={variant} className="text-xs">
        {result}
      </Badge>
    );
  };

  const getEventTypeBadge = (eventType: string) => {
    const colors: Record<string, string> = {
      USER_LOGIN: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      USER_LOGOUT: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      ADMIN_IMPERSONATION_STARTED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      ADMIN_IMPERSONATION_STOPPED: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      ORGANIZATION_CREATED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      ORGANIZATION_UPDATED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      USER_CREATED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      USER_UPDATED: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };
    
    return (
      <Badge variant="outline" className={`text-xs ${colors[eventType] || ""}`}>
        {eventType.replace(/_/g, ' ')}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading audit logs...</span>
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
            <p className="text-red-600">Error loading audit logs</p>
            <p className="text-muted-foreground text-sm mt-2">
              {error.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Audit Logs ({auditLogs.length})
          </CardTitle>
          <CardDescription>
            View system activity and security events across all organizations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search audit logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-audit-logs"
              />
            </div>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-48" data-testid="select-event-type-filter">
                <SelectValue placeholder="All Event Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {eventTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-32" data-testid="select-result-filter">
                <SelectValue placeholder="All Results" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failure</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedOrganization} onValueChange={setSelectedOrganization}>
              <SelectTrigger className="w-48" data-testid="select-organization-filter">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Audit Logs Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <div>
                          <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getEventTypeBadge(log.eventType)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <div>
                          <div className="text-sm font-medium">{log.actorEmail}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.actorType}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.organizationName ? (
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          <span className="text-sm">{log.organizationName}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">System</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-64">
                      <div className="truncate" title={log.action}>
                        {log.action}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getResultIcon(log.result)}
                        {getResultBadge(log.result)}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-48">
                      {log.details && (
                        <div className="truncate" title={JSON.stringify(log.details, null, 2)}>
                          {Object.entries(log.details).map(([key, value]) => (
                            <span key={key}>{key}: {String(value)} </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No audit logs found</h3>
              <p className="text-muted-foreground">
                {searchTerm || eventTypeFilter !== "all" || resultFilter !== "all" || selectedOrganization !== "all"
                  ? "No logs match your search criteria."
                  : "No audit events have been recorded yet."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}