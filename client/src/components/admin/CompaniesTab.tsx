import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Building, 
  Search, 
  Loader2,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowLeft
} from "lucide-react";
import CaseCard from "@/components/CaseCard";

interface Organization {
  id: string;
  name: string;
  caseCount?: number;
}

interface CaseData {
  ticketId: string;
  workerId?: string;
  workerName: string;
  caseType: "pre_employment" | "injury";
  status: string;
  priority?: string;
  ragScore: "green" | "amber" | "red";
  createdAt: string;
  updatedAt?: string;
  nextStep?: string | null;
}

interface OrganizationOverview {
  organization: Organization;
  activeCases: CaseData[];
  completedCases: CaseData[];
  allWorkers: any[];
  stats: {
    totalCases: number;
    activeCases: number;
    completedCases: number;
    totalWorkers: number;
    redFlags: number;
    amberFlags: number;
    greenFlags: number;
  };
}

export default function CompaniesTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  // Fetch all organizations
  const { 
    data: organizationsData, 
    isLoading: isLoadingOrgs,
    error: orgsError 
  } = useQuery<{ organizations: Organization[]; totalActive: number; totalCases: number }>({ 
    queryKey: ["/api/dashboard/organizations"] 
  });

  // Fetch selected organization overview
  const { 
    data: orgOverview, 
    isLoading: isLoadingOverview,
    error: overviewError,
    refetch: refetchOverview
  } = useQuery<OrganizationOverview>({ 
    queryKey: [`/api/organizations/${selectedOrganizationId}/overview`],
    enabled: !!selectedOrganizationId,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0 // Don't cache old data
  });

  const organizations = organizationsData?.organizations || [];

  // Filter organizations based on search
  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBackToList = () => {
    setSelectedOrganizationId(null);
  };

  // If an organization is selected, show its cases
  if (selectedOrganizationId) {
    if (isLoadingOverview) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin mr-2" />
              <span>Loading company details...</span>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (overviewError) {
      return (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-red-600">Error loading company details</p>
              <p className="text-muted-foreground text-sm mt-2">
                {overviewError.message}
              </p>
              <Button onClick={handleBackToList} className="mt-4" data-testid="button-back-to-companies">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Companies
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    const allCases = [...(orgOverview?.activeCases || []), ...(orgOverview?.completedCases || [])];

    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Button 
                  variant="ghost" 
                  onClick={handleBackToList} 
                  className="mb-2"
                  data-testid="button-back-to-list"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Companies
                </Button>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  {orgOverview?.organization.name}
                </CardTitle>
                <CardDescription>
                  Viewing all cases for this company
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        {orgOverview?.stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-stat-total-cases">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Cases
                </CardTitle>
                <FileText className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orgOverview.stats.totalCases}</div>
                <p className="text-xs text-muted-foreground">
                  {orgOverview.stats.activeCases} active
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-workers">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Workers
                </CardTitle>
                <Users className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orgOverview.stats.totalWorkers}</div>
                <p className="text-xs text-muted-foreground">
                  Total workers
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-red-flags">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Red Flags
                </CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orgOverview.stats.redFlags}</div>
                <p className="text-xs text-muted-foreground">
                  High risk cases
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-stat-completed">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{orgOverview.stats.completedCases}</div>
                <p className="text-xs text-muted-foreground">
                  Finished cases
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cases Grid */}
        <Card>
          <CardHeader>
            <CardTitle>All Cases ({allCases.length})</CardTitle>
            <CardDescription>
              Complete case list for {orgOverview?.organization.name}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {allCases.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No cases found for this company.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allCases.map((caseItem) => (
                  <CaseCard
                    key={caseItem.ticketId}
                    ticketId={caseItem.ticketId}
                    workerId={caseItem.workerId}
                    caseType={caseItem.caseType}
                    claimType={null}
                    priority={caseItem.priority}
                    workerName={caseItem.workerName}
                    roleApplied=""
                    company={orgOverview?.organization.name || ""}
                    status={caseItem.status as any}
                    ragScore={caseItem.ragScore}
                    createdAt={new Date(caseItem.createdAt)}
                    nextStep={caseItem.nextStep}
                    lastStep={null}
                    lastStepCompletedAt={null}
                    assignedTo={null}
                    onViewCase={() => {}}
                    onWorkerClick={() => {}}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show list of companies
  if (isLoadingOrgs) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading companies...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (orgsError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-red-600">Error loading companies</p>
            <p className="text-muted-foreground text-sm mt-2">
              {orgsError.message}
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Companies ({organizations.length})
              </CardTitle>
              <CardDescription>
                Search and view cases for each company
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-companies"
              />
            </div>
          </div>

          {/* Companies Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead className="text-center">Total Cases</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      No companies found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map((org) => (
                    <TableRow key={org.id} data-testid={`row-company-${org.id}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          {org.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" data-testid={`badge-case-count-${org.id}`}>
                          {org.caseCount || 0} cases
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrganizationId(org.id)}
                          data-testid={`button-view-cases-${org.id}`}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Cases
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
