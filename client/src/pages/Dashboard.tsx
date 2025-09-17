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
import { Plus, Filter, Download } from "lucide-react";

// Mock data for demonstration - todo: remove mock functionality
const mockStats = {
  total: 147,
  new: 23,
  inProgress: 34,
  awaiting: 12,
  complete: 78,
  flagged: 5,
};

const mockCases = [
  {
    ticketId: "1234",
    workerName: "John Smith",
    roleApplied: "Warehouse Operator",
    company: "ABC Logistics",
    status: "AWAITING_REVIEW" as const,
    ragScore: "amber" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    email: "john.smith@email.com",
    phone: "+1 (555) 123-4567",
    fitClassification: "Fit with Restrictions",
    recommendations: [
      "Recommend ergonomic assessment for lifting tasks",
      "Provide back support training before starting role"
    ],
    notes: "Previous back strain history but good functional capacity"
  },
  {
    ticketId: "5678",
    workerName: "Maria Lopez",
    roleApplied: "Office Administrator",
    company: "XYZ Corp",
    status: "COMPLETE" as const,
    ragScore: "green" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    email: "maria.lopez@email.com",
    phone: "+1 (555) 987-6543",
    fitClassification: "Fit without restriction",
    recommendations: ["No restrictions required"],
    notes: "Excellent health profile, no concerns identified"
  },
  {
    ticketId: "9012",
    workerName: "David Wilson",
    roleApplied: "Construction Worker",
    company: "BuildCorp",
    status: "REVISIONS_REQUIRED" as const,
    ragScore: "red" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
    email: "david.wilson@email.com",
    phone: "+1 (555) 456-7890",
    fitClassification: "Not fit",
    recommendations: [
      "Recommend GP clearance for shoulder injury",
      "Physiotherapy assessment required"
    ],
    notes: "Current shoulder injury requires medical clearance"
  },
  {
    ticketId: "3456",
    workerName: "Sarah Johnson",
    roleApplied: "Delivery Driver",
    company: "Fast Delivery Co",
    status: "NEW" as const,
    ragScore: "green" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    email: "sarah.johnson@email.com",
    phone: "+1 (555) 234-5678",
    fitClassification: "Fit without restriction",
    recommendations: ["Standard driving medical clearance"],
    notes: "No health concerns identified"
  },
  {
    ticketId: "7890",
    workerName: "Michael Brown",
    roleApplied: "Factory Supervisor",
    company: "Manufacturing Plus",
    status: "READY_TO_SEND" as const,
    ragScore: "amber" as const,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
    email: "michael.brown@email.com",
    phone: "+1 (555) 345-6789",
    fitClassification: "Fit with restrictions",
    recommendations: [
      "Limit standing to 4-hour periods",
      "Provide ergonomic support for knee condition"
    ],
    notes: "Minor knee condition managed with restrictions"
  }
];

export default function Dashboard() {
  const [selectedCase, setSelectedCase] = useState<typeof mockCases[0] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleViewCase = (caseData: typeof mockCases[0]) => {
    console.log("Opening case details for:", caseData.ticketId);
    setSelectedCase(caseData);
    setIsModalOpen(true);
  };

  const handleStatusUpdate = (ticketId: string, newStatus: string) => {
    console.log("Status update requested:", ticketId, newStatus);
    // todo: remove mock functionality - implement real status update
  };

  const handleRecommendationsUpdate = (ticketId: string, recommendations: string[]) => {
    console.log("Recommendations update requested:", ticketId, recommendations);
    // todo: remove mock functionality - implement real recommendations update
  };

  const filteredCases = mockCases.filter(caseItem => {
    const matchesStatus = statusFilter === "all" || caseItem.status === statusFilter;
    const matchesSearch = searchQuery === "" || 
      caseItem.workerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      caseItem.ticketId.includes(searchQuery) ||
      caseItem.company.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesStatus && matchesSearch;
  });

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
            stats={mockStats}
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
                  status={caseItem.status}
                  ragScore={caseItem.ragScore}
                  createdAt={caseItem.createdAt}
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
        caseDetails={selectedCase}
        onStatusUpdate={handleStatusUpdate}
        onRecommendationsUpdate={handleRecommendationsUpdate}
      />
    </div>
  );
}