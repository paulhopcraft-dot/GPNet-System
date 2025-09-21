import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  Download,
  Building,
  Users,
  TrendingUp,
  Clock,
  Ticket,
  Loader2
} from "lucide-react";

interface FreshdeskStatus {
  connected: boolean;
  domain?: string;
  error?: string;
}

interface FreshdeskPreview {
  success: boolean;
  preview?: {
    tickets: Array<{
      id: number;
      subject: string;
      status: string;
      priority: string;
      company_id?: number;
      created_at: string;
      age_days: number;
    }>;
    companies: Array<{
      id: number;
      name: string;
      domains?: string[];
    }>;
    totalTickets: number;
    totalCompanies: number;
    note: string;
  };
  error?: string;
  details?: string;
}

interface FreshdeskImportResult {
  success: boolean;
  message?: string;
  data?: {
    totalTickets: number;
    totalCompanies: number;
    ticketsByCompany: Record<string, {
      companyName: string;
      tickets: Array<{
        id: number;
        subject: string;
        status: string;
        priority: string;
        createdAt: string;
        ageDays: number;
      }>;
    }>;
    unmappedTickets: Array<{
      id: number;
      subject: string;
      status: string;
      priority: string;
      createdAt: string;
      ageDays: number;
    }>;
    summary: {
      openTickets: number;
      pendingTickets: number;
      resolvedTickets: number;
      closedTickets: number;
      avgTicketAge: number;
    };
  };
  error?: string;
  details?: string;
}

export function FreshdeskTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [importInProgress, setImportInProgress] = useState(false);

  // Query Freshdesk connection status
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useQuery<FreshdeskStatus>({
    queryKey: ['/api/freshdesk/status'],
    refetchInterval: false
  });

  // Query preview data
  const { data: preview, isLoading: previewLoading, refetch: refetchPreview } = useQuery<FreshdeskPreview>({
    queryKey: ['/api/freshdesk/preview'],
    enabled: status?.connected === true,
    refetchInterval: false
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (): Promise<FreshdeskImportResult> => {
      const response = await fetch('/api/freshdesk/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Import Successful",
          description: `Imported ${data.data?.totalTickets || 0} tickets from ${data.data?.totalCompanies || 0} companies`
        });
      } else {
        toast({
          title: "Import Failed",
          description: data.error || "Unknown error occurred",
          variant: "destructive"
        });
      }
      setImportInProgress(false);
    },
    onError: (error) => {
      toast({
        title: "Import Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
      setImportInProgress(false);
    }
  });

  const handleImport = async () => {
    setImportInProgress(true);
    importMutation.mutate();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6" data-testid="freshdesk-tab">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-2">Freshdesk Integration</h2>
        <p className="text-muted-foreground">
          Import and categorize tickets from your Freshdesk instance. This allows you to sync existing support tickets with GPNet for comprehensive case management.
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Connection Status
          </CardTitle>
          <CardDescription>
            Check your Freshdesk integration status and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {statusLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : status?.connected ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              
              <div>
                <p className="font-medium">
                  {statusLoading 
                    ? "Checking connection..." 
                    : status?.connected 
                      ? "Connected to Freshdesk" 
                      : "Not Connected"
                  }
                </p>
                {status?.domain && (
                  <p className="text-sm text-muted-foreground">
                    Domain: {status.domain}
                  </p>
                )}
                {status?.error && (
                  <p className="text-sm text-red-600">
                    Error: {status.error}
                  </p>
                )}
              </div>
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchStatus()}
              disabled={statusLoading}
              data-testid="button-refresh-status"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Help */}
      {!status?.connected && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              Configuration Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <p>To connect to Freshdesk, you need to configure the following environment variables:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="bg-white px-2 py-1 rounded">FRESHDESK_API_KEY</code> - Your Freshdesk API key</li>
                <li><code className="bg-white px-2 py-1 rounded">FRESHDESK_DOMAIN</code> - Your Freshdesk domain (e.g., yourcompany.freshdesk.com)</li>
              </ul>
              <p className="text-yellow-700">
                Please contact your system administrator to configure these credentials.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Section */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Preview Data
            </CardTitle>
            <CardDescription>
              Preview of tickets and companies that will be imported from Freshdesk
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Click preview to see a sample of your Freshdesk data
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchPreview()}
                  disabled={previewLoading}
                  data-testid="button-preview-data"
                >
                  {previewLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Preview Data
                </Button>
              </div>

              {preview?.success && preview.preview && (
                <div className="space-y-4">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-600">Total Tickets</span>
                      </div>
                      <p className="text-lg font-bold text-blue-800">{preview.preview.totalTickets}</p>
                    </div>
                    
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-600">Companies</span>
                      </div>
                      <p className="text-lg font-bold text-green-800">{preview.preview.totalCompanies}</p>
                    </div>
                    
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-600">Preview Tickets</span>
                      </div>
                      <p className="text-lg font-bold text-orange-800">{preview.preview.tickets.length}</p>
                    </div>
                    
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-600">Preview Companies</span>
                      </div>
                      <p className="text-lg font-bold text-purple-800">{preview.preview.companies.length}</p>
                    </div>
                  </div>

                  {/* Sample Tickets */}
                  <div>
                    <h4 className="font-semibold mb-3">Sample Tickets</h4>
                    <div className="space-y-2">
                      {preview.preview.tickets.slice(0, 5).map((ticket) => (
                        <div key={ticket.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{ticket.subject}</p>
                            <p className="text-sm text-muted-foreground">
                              ID: {ticket.id} • Created: {formatDate(ticket.created_at)} • Age: {ticket.age_days} days
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(ticket.status)}>{ticket.status}</Badge>
                            <Badge className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sample Companies */}
                  <div>
                    <h4 className="font-semibold mb-3">Sample Companies</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {preview.preview.companies.slice(0, 6).map((company) => (
                        <div key={company.id} className="p-3 border rounded-lg">
                          <p className="font-medium">{company.name}</p>
                          <p className="text-sm text-muted-foreground">ID: {company.id}</p>
                          {company.domains && company.domains.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Domains: {company.domains.join(', ')}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {preview?.error && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-red-800 font-medium">Preview Failed</p>
                  <p className="text-red-600 text-sm">{preview.error}</p>
                  {preview.details && (
                    <p className="text-red-500 text-xs mt-1">{preview.details}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Section */}
      {status?.connected && preview?.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Import Tickets
            </CardTitle>
            <CardDescription>
              Import all tickets from Freshdesk and categorize them by company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">What happens during import:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Fetches all tickets and companies from your Freshdesk instance</li>
                  <li>• Categorizes tickets by their associated companies</li>
                  <li>• Provides summary analytics and insights</li>
                  <li>• Shows unmapped tickets without company associations</li>
                </ul>
              </div>

              <div className="flex items-center gap-4">
                <Button 
                  onClick={handleImport}
                  disabled={importInProgress || importMutation.isPending}
                  className="min-w-32"
                  data-testid="button-import-tickets"
                >
                  {(importInProgress || importMutation.isPending) ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import All Tickets
                    </>
                  )}
                </Button>
                
                <p className="text-sm text-muted-foreground">
                  This may take a few minutes for large datasets
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}