import { useState } from "react";
import Header from "@/components/Header";
import StatusBoard from "@/components/StatusBoard";
import CaseCard from "@/components/CaseCard";
import CaseDetailsModal from "@/components/CaseDetailsModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Filter, Download, Loader2 } from "lucide-react";
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
  status: string;
  createdAt: string;
  workerName: string;
  email: string;
  phone: string;
  roleApplied: string;
  company: string;
  ragScore: "green" | "amber" | "red";
  fitClassification: string;
  recommendations: string[];
  notes: string;
}

export default function Dashboard() {
  const [selectedCase, setSelectedCase] = useState<DashboardCase | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch dashboard statistics
  const { 
    data: stats, 
    isLoading: statsLoading, 
    error: statsError 
  } = useQuery<DashboardStats>({ 
    queryKey: ["/api/dashboard/stats"] 
  });

  // Fetch all cases
  const { 
    data: cases, 
    isLoading: casesLoading, 
    error: casesError 
  } = useQuery<DashboardCase[]>({ 
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

  const filteredCases = (cases || []).filter((caseItem: DashboardCase) => {
    const matchesStatus = statusFilter === "all" || caseItem.status === statusFilter;
    const matchesSearch = searchQuery === "" || 
      caseItem.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.ticketId.includes(searchQuery) ||
      caseItem.company.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
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
              Pre-Employment Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage and review pre-employment health assessments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button data-testid="button-new-case">
              <Plus className="h-4 w-4 mr-2" />
              New Case
            </Button>
          </div>
        </div>

        {/* Status Board */}
        <div className="mb-8">
          <StatusBoard 
            stats={stats || { total: 0, new: 0, inProgress: 0, awaiting: 0, complete: 0, flagged: 0 }}
            todayCount={8}
            weeklyGrowth={15}
          />
        </div>

        {/* Filters and Search */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <Input
                placeholder="Search cases, workers, or companies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sm:max-w-sm"
                data-testid="input-search-cases"
              />
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="ANALYSING">Analyzing</SelectItem>
                  <SelectItem value="AWAITING_REVIEW">Awaiting Review</SelectItem>
                  <SelectItem value="REVISIONS_REQUIRED">Revisions Required</SelectItem>
                  <SelectItem value="READY_TO_SEND">Ready to Send</SelectItem>
                  <SelectItem value="COMPLETE">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" data-testid="button-filters">
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {/* Active filters display */}
          {(statusFilter !== "all" || searchQuery) && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="text-xs">
                  Status: {statusFilter}
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="secondary" className="text-xs">
                  Search: {searchQuery}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Cases Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Recent Cases ({filteredCases.length})
            </h2>
          </div>

          {filteredCases.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No cases found matching your criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCases.map((caseItem) => (
                <CaseCard
                  key={caseItem.ticketId}
                  ticketId={caseItem.ticketId}
                  workerName={caseItem.workerName}
                  roleApplied={caseItem.roleApplied}
                  company={caseItem.company}
                  status={caseItem.status as any}
                  ragScore={caseItem.ragScore}
                  createdAt={new Date(caseItem.createdAt)}
                  onViewCase={() => handleViewCase(caseItem)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Case Details Modal */}
      <CaseDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        caseDetails={selectedCase ? {
          ...selectedCase,
          createdAt: new Date(selectedCase.createdAt)
        } : null}
        onStatusUpdate={handleStatusUpdate}
        onRecommendationsUpdate={handleRecommendationsUpdate}
      />
    </div>
  );
}