import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import CaseCard from "@/components/CaseCard";
import CaseDetailsModal from "@/components/CaseDetailsModal";
import PersonProfilePanel from "@/components/PersonProfilePanel";
import { Search, FileText, Download, Filter } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DashboardCase {
  ticketId: string;
  workerId?: string;
  caseType: string;
  claimType?: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  workerName: string;
  email: string;
  phone: string;
  roleApplied: string;
  company: string;
  ragScore: string;
  fitClassification: string;
  recommendations: string[];
  notes: string;
  nextStep?: string;
  lastStep?: string;
  lastStepCompletedAt?: string;
  assignedTo?: string;
  formData?: any;
}

interface CasesResponse {
  cases: DashboardCase[];
  total: number;
  success: boolean;
}

// Case type options with their display names
const CASE_TYPES = [
  { value: 'pre_employment', label: 'Pre-Employment Check' },
  { value: 'injury', label: 'Injury Assessment' },
  { value: 'rtw', label: 'Return to Work' },
  { value: 'capacity', label: 'Capacity Assessment' },
  { value: 'surveillance', label: 'Health Surveillance' },
  { value: 'fitness', label: 'Fitness for Duty' },
  { value: 'workcover', label: 'WorkCover Claim' },
] as const;

export default function AdminCasesTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCase, setSelectedCase] = useState<DashboardCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  
  // Load selected case types from sessionStorage on mount
  const [selectedCaseTypes, setSelectedCaseTypes] = useState<string[]>(() => {
    const stored = sessionStorage.getItem('adminCasesTab_selectedCaseTypes');
    return stored ? JSON.parse(stored) : [];
  });
  
  // Persist selected case types to sessionStorage whenever they change
  useEffect(() => {
    sessionStorage.setItem('adminCasesTab_selectedCaseTypes', JSON.stringify(selectedCaseTypes));
  }, [selectedCaseTypes]);
  
  const toggleCaseType = (value: string) => {
    setSelectedCaseTypes(prev => 
      prev.includes(value) 
        ? prev.filter(t => t !== value)
        : [...prev, value]
    );
  };
  
  const clearCaseTypeFilters = () => {
    setSelectedCaseTypes([]);
  };

  // Fetch all cases (admin sees all cases across all organizations)
  const { 
    data: casesResponse, 
    isLoading: casesLoading, 
    error: casesError 
  } = useQuery<CasesResponse>({ 
    queryKey: ["/api/cases"]
  });

  // Mutations for updating case data
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      return apiRequest("PUT", `/api/cases/${ticketId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
    },
  });

  const updateRecommendationsMutation = useMutation({
    mutationFn: async ({ ticketId, recommendations }: { ticketId: string; recommendations: string[] }) => {
      return apiRequest("PUT", `/api/cases/${ticketId}/recommendations`, { recommendations });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
    },
  });

  const cases = casesResponse?.cases || [];
  const totalCases = casesResponse?.total || 0;

  // Filter cases based on search term and case types
  const filteredCases = cases.filter(caseItem => {
    // Apply search filter
    const matchesSearch = searchTerm === '' || 
      caseItem.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Apply case type filter (if any types are selected)
    const matchesCaseType = selectedCaseTypes.length === 0 || 
      selectedCaseTypes.includes(caseItem.caseType);
    
    return matchesSearch && matchesCaseType;
  });

  const handleViewCase = (caseData: DashboardCase) => {
    console.log("Opening case details for:", caseData.ticketId);
    setSelectedCase(caseData);
    setIsModalOpen(true);
  };

  const handleStatusUpdate = (ticketId: string, newStatus: string) => {
    console.log("Status update requested:", ticketId, newStatus);
    updateStatusMutation.mutate({ ticketId, status: newStatus });
  };

  const handleRecommendationsUpdate = (ticketId: string, recommendations: string[]) => {
    console.log("Recommendations update requested:", ticketId, recommendations);
    updateRecommendationsMutation.mutate({ ticketId, recommendations });
  };
  
  const handleWorkerClick = (workerId: string) => {
    console.log("Opening worker profile:", workerId);
    setSelectedWorkerId(workerId);
    setIsProfilePanelOpen(true);
  };

  if (casesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cases Management
          </CardTitle>
          <CardDescription>Loading cases...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (casesError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cases Management
          </CardTitle>
          <CardDescription>Error loading cases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load cases. Please try again.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cases Management
          </CardTitle>
          <CardDescription>
            View and manage all cases across all organizations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalCases}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                Total Cases
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {cases.filter(c => c.ragScore === 'green').length}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                Green (Low Risk)
              </div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {cases.filter(c => c.ragScore === 'amber').length}
              </div>
              <div className="text-sm text-amber-600 dark:text-amber-400">
                Amber (Medium Risk)
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {cases.filter(c => c.ragScore === 'red').length}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                Red (High Risk)
              </div>
            </div>
          </div>

          {/* Search and Actions */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search cases by worker, company, or case ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-cases"
              />
            </div>
            <div className="flex items-center gap-2">
              {/* Case Type Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-filter-case-type">
                    <Filter className="h-4 w-4 mr-2" />
                    Case Type
                    {selectedCaseTypes.length > 0 && (
                      <Badge variant="secondary" className="ml-2 px-1.5 py-0 min-w-5 h-5 text-xs">
                        {selectedCaseTypes.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end" data-testid="popover-case-type-filter">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Filter by Case Type</h4>
                      {selectedCaseTypes.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-auto py-1 px-2 text-xs"
                          onClick={clearCaseTypeFilters}
                          data-testid="button-clear-case-type-filters"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {CASE_TYPES.map((type) => (
                        <div key={type.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`case-type-${type.value}`}
                            checked={selectedCaseTypes.includes(type.value)}
                            onCheckedChange={() => toggleCaseType(type.value)}
                            data-testid={`checkbox-case-type-${type.value}`}
                          />
                          <Label
                            htmlFor={`case-type-${type.value}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {type.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="sm" data-testid="button-export-cases">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Cases Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Cases ({totalCases} total, {filteredCases.length} shown)
              </h3>
            </div>

            {filteredCases.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {searchTerm ? "No cases found matching your search criteria." : "No cases available."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCases.map((caseItem: DashboardCase) => (
                  <CaseCard
                    key={caseItem.ticketId}
                    ticketId={caseItem.ticketId}
                    workerId={caseItem.workerId}
                    caseType={caseItem.caseType as "pre_employment" | "injury"}
                    claimType={caseItem.claimType}
                    priority={caseItem.priority}
                    workerName={caseItem.workerName}
                    roleApplied={caseItem.roleApplied}
                    company={caseItem.company}
                    status={caseItem.status as any}
                    ragScore={caseItem.ragScore as "green" | "amber" | "red" | undefined}
                    createdAt={new Date(caseItem.createdAt)}
                    nextStep={caseItem.nextStep}
                    lastStep={caseItem.lastStep}
                    lastStepCompletedAt={caseItem.lastStepCompletedAt}
                    assignedTo={caseItem.assignedTo}
                    onViewCase={() => handleViewCase(caseItem)}
                    onWorkerClick={handleWorkerClick}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Case Details Modal */}
      <CaseDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        caseDetails={selectedCase ? {
          ...selectedCase,
          createdAt: new Date(selectedCase.createdAt),
          claimType: selectedCase.claimType || undefined
        } as any : null}
        onStatusUpdate={handleStatusUpdate}
        onRecommendationsUpdate={handleRecommendationsUpdate}
      />
      
      {/* Person Profile Panel */}
      <PersonProfilePanel
        workerId={selectedWorkerId}
        open={isProfilePanelOpen}
        onOpenChange={setIsProfilePanelOpen}
      />
    </>
  );
}