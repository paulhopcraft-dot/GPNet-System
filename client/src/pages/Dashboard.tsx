import { useState, useEffect } from "react";
import Header from "@/components/Header";
import StatusBoard from "@/components/StatusBoard";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import CaseCard from "@/components/CaseCard";
import CaseDetailsModal from "@/components/CaseDetailsModal";
import AdvancedCaseFilters from "@/components/AdvancedCaseFilters";
import MichelleDashboardPanel from "@/components/MichelleDashboardPanel";
import PreEmploymentInvitationForm from "@/components/PreEmploymentInvitationForm";
import PreEmploymentReviewModal from "@/components/PreEmploymentReviewModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUser } from "@/components/UserContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Plus, Download, Loader2, BarChart3, Grid3X3, Settings, Briefcase, ChevronDown, UserCheck, AlertTriangle, Shield, Heart, Brain, DoorOpen } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface DashboardStats {
  total: number;
  new: number;
  inProgress: number;
  awaiting: number;
  complete: number;
  flagged: number;
}

interface DashboardCase {
  ticketId: string;
  caseType: "pre_employment" | "injury";
  claimType?: string | null;
  priority?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  workerName: string;
  email: string;
  phone: string;
  roleApplied: string;
  company: string;
  ragScore: "green" | "amber" | "red";
  fitClassification: string;
  recommendations: string[];
  notes: string;
  nextStep?: string | null;
  lastStep?: string | null;
  lastStepCompletedAt?: string | null;
  assignedTo?: string | null;
}

interface CasesResponse {
  cases: DashboardCase[];
  total: number;
  page: number;
  hasMore: boolean;
}

interface FilterState {
  search: string;
  status: string;
  caseType: string;
  claimType: string;
  priority: string;
  ragScore: string;
  fitClassification: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy: string;
  sortOrder: string;
}

export default function Dashboard() {
  const { user } = useUser(); // Get user context
  const [selectedCase, setSelectedCase] = useState<DashboardCase | null>(null);
  
  // Show navigation buttons at the top
  const NavigationPanel = () => (
    <div className="mb-8 p-6 bg-card rounded-lg border">
      <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
      <div className="flex gap-4">
        <Link href="/admin">
          <Button size="lg" className="flex items-center gap-2" data-testid="button-admin-access">
            <Settings className="h-5 w-5" />
            Admin Console
          </Button>
        </Link>
        <Link href="/manager">
          <Button size="lg" variant="outline" className="flex items-center gap-2" data-testid="button-company-access">
            <Briefcase className="h-5 w-5" />
            Manager Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showInvitationForm, setShowInvitationForm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewTicketId, setReviewTicketId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCheckType, setSelectedCheckType] = useState<string>("pre_employment");

  // Health check types configuration
  const healthCheckTypes = [
    {
      id: "pre_employment",
      label: "Pre employment", 
      icon: UserCheck,
      description: "Medical assessment for job candidates"
    },
    {
      id: "injury",
      label: "Injury",
      icon: AlertTriangle,
      description: "Workplace injury assessment and management"
    },
    {
      id: "prevention",
      label: "Prevention",
      icon: Shield,
      description: "Preventive health screening and risk assessment"
    },
    {
      id: "general_health_wellbeing",
      label: "General health and well-being",
      icon: Heart,
      description: "Comprehensive health and wellness evaluation"
    },
    {
      id: "mental_health",
      label: "Mental health",
      icon: Brain,
      description: "Mental health assessment and support"
    },
    {
      id: "exit",
      label: "Exit",
      icon: DoorOpen,
      description: "Exit medical examination"
    }
  ];

  // Handle health check type selection
  const handleCheckTypeSelect = (checkType: string) => {
    setSelectedCheckType(checkType);
    setShowInvitationForm(true);
  };
  
  // Advanced filter state
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    caseType: "all",
    claimType: "all",
    priority: "all",
    ragScore: "all",
    fitClassification: "all",
    dateFrom: undefined,
    dateTo: undefined,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  // Fetch dashboard statistics
  const { 
    data: stats, 
    isLoading: statsLoading, 
    error: statsError 
  } = useQuery<DashboardStats>({ 
    queryKey: ["/api/dashboard/stats"] 
  });

  // Construct query parameters from filters
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.status !== 'all') params.append('status', filters.status);
    if (filters.caseType !== 'all') params.append('caseType', filters.caseType);
    if (filters.claimType !== 'all') params.append('claimType', filters.claimType);
    if (filters.priority !== 'all') params.append('priority', filters.priority);
    if (filters.ragScore !== 'all') params.append('ragScore', filters.ragScore);
    if (filters.fitClassification !== 'all') params.append('fitClassification', filters.fitClassification);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString());
    if (filters.dateTo) params.append('dateTo', filters.dateTo.toISOString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    
    return params.toString();
  };

  // Fetch cases with filtering
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
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
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

  // Handle filter changes
  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      caseType: "all",
      claimType: "all",
      priority: "all",
      ragScore: "all",
      fitClassification: "all",
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  };

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status !== 'all') count++;
    if (filters.caseType !== 'all') count++;
    if (filters.claimType !== 'all') count++;
    if (filters.priority !== 'all') count++;
    if (filters.ragScore !== 'all') count++;
    if (filters.fitClassification !== 'all') count++;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    return count;
  };

  // Handle case interactions
  const handleCaseClick = (caseData: DashboardCase) => {
    setSelectedCase(caseData);
    setIsModalOpen(true);
  };

  const handleReviewClick = (ticketId: string) => {
    setReviewTicketId(ticketId);
    setShowReviewModal(true);
  };

  const handleCloseReviewModal = () => {
    setShowReviewModal(false);
    setReviewTicketId(null);
  };

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

  // Event listeners for Michelle's custom events
  useEffect(() => {
    const handleMichelleFilterCases = (event: CustomEvent) => {
      const filterUpdates = event.detail;
      setFilters(prevFilters => ({
        ...prevFilters,
        ...filterUpdates
      }));
    };

    const handleMichelleSwitchTab = (event: CustomEvent) => {
      const { tab } = event.detail;
      setActiveTab(tab);
    };

    window.addEventListener('michelle-filter-cases', handleMichelleFilterCases as EventListener);
    window.addEventListener('michelle-switch-tab', handleMichelleSwitchTab as EventListener);

    return () => {
      window.removeEventListener('michelle-filter-cases', handleMichelleFilterCases as EventListener);
      window.removeEventListener('michelle-switch-tab', handleMichelleSwitchTab as EventListener);
    };
  }, []);

  // Extract cases from response
  const cases: DashboardCase[] = casesResponse?.cases || [];
  const totalCases: number = casesResponse?.total || 0;
  
  // Apply client-side filtering since we're using simple API call
  const filteredCases = cases.filter(caseItem => {
    // Status filter
    if (filters.status !== 'all' && caseItem.status !== filters.status) {
      return false;
    }
    // Case type filter
    if (filters.caseType !== 'all' && caseItem.caseType !== filters.caseType) {
      return false;
    }
    // Priority filter
    if (filters.priority !== 'all' && caseItem.priority !== filters.priority) {
      return false;
    }
    // RAG score filter
    if (filters.ragScore !== 'all' && caseItem.ragScore !== filters.ragScore) {
      return false;
    }
    // Text search
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchableText = [
        caseItem.ticketId,
        caseItem.workerName,
        caseItem.email,
        caseItem.roleApplied,
        caseItem.company
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(searchTerm)) {
        return false;
      }
    }
    return true;
  });

  // Handle loading states
  if (statsLoading || casesLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading dashboard...</span>
          </div>
        </main>
      </div>
    );
  }

  // Handle error states
  if (statsError || casesError) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <p className="text-red-600">Error loading dashboard data</p>
            <p className="text-muted-foreground text-sm mt-2">
              {statsError?.message || casesError?.message}
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">
              GPNet Case Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and review pre-employment health assessments and workplace injury cases
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="button-new-case">
                  <Plus className="h-4 w-4 mr-2" />
                  New Health Check
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end">
                {healthCheckTypes.map((checkType) => {
                  const IconComponent = checkType.icon;
                  return (
                    <DropdownMenuItem
                      key={checkType.id}
                      onClick={() => handleCheckTypeSelect(checkType.id)}
                      className="flex items-start gap-3 p-3 cursor-pointer"
                      data-testid={`menu-item-${checkType.id}`}
                    >
                      <IconComponent className="h-5 w-5 mt-0.5 text-muted-foreground" />
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{checkType.label}</span>
                        <span className="text-sm text-muted-foreground">
                          {checkType.description}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Michelle Dashboard Panel */}
        <div className="mb-8">
          <MichelleDashboardPanel 
            stats={stats}
            recentCases={cases.slice(0, 5)} // Pass top 5 recent cases
            userName={user?.name || "there"}
          />
        </div>

        {/* Navigation Panel */}
        <NavigationPanel />

        {/* Status Board */}
        <div className="mb-8">
          <StatusBoard 
            stats={stats || { total: 0, new: 0, inProgress: 0, awaiting: 0, complete: 0, flagged: 0 }}
            todayCount={8}
            weeklyGrowth={15}
          />
        </div>

        {/* Dashboard Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
              <Grid3X3 className="h-4 w-4" />
              Case Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Advanced Case Filters */}
            <AdvancedCaseFilters
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onClearFilters={handleClearFilters}
              activeFilterCount={getActiveFilterCount()}
            />

            {/* Cases Grid */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Cases ({totalCases} total, {filteredCases.length} shown)
                </h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" data-testid="button-export">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>

              {filteredCases.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No cases found matching your criteria.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCases.map((caseItem: DashboardCase) => (
                    <CaseCard
                      key={caseItem.ticketId}
                      ticketId={caseItem.ticketId}
                      caseType={caseItem.caseType}
                      claimType={caseItem.claimType}
                      priority={caseItem.priority}
                      workerName={caseItem.workerName}
                      roleApplied={caseItem.roleApplied}
                      company={caseItem.company}
                      status={caseItem.status as any}
                      ragScore={caseItem.ragScore}
                      createdAt={new Date(caseItem.createdAt)}
                      nextStep={caseItem.nextStep}
                      lastStep={caseItem.lastStep}
                      lastStepCompletedAt={caseItem.lastStepCompletedAt}
                      assignedTo={caseItem.assignedTo}
                      onViewCase={() => handleViewCase(caseItem)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard />
          </TabsContent>
        </Tabs>
      </main>

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

      {/* Pre-Employment Invitation Form */}
      {showInvitationForm && (
        <PreEmploymentInvitationForm
          onClose={() => setShowInvitationForm(false)}
          checkType={selectedCheckType}
        />
      )}

      {/* Pre-Employment Review Modal */}
      {showReviewModal && reviewTicketId && (
        <PreEmploymentReviewModal
          ticketId={reviewTicketId}
          onClose={handleCloseReviewModal}
        />
      )}
    </div>
  );
}