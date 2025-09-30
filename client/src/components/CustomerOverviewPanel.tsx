import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Building,
  Mail,
  Phone,
  Users,
  FileText,
  ExternalLink,
  AlertCircle,
  Search,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

interface CustomerOverviewPanelProps {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Organization {
  id: string;
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

interface CaseSummary {
  ticketId: string;
  workerId: string;
  workerName: string;
  caseType: string;
  status: string;
  priority: string;
  ragScore: string;
  createdAt: string;
  updatedAt?: string;
  nextStep?: string;
}

interface WorkerSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  totalCases: number;
  activeCases: number;
}

interface CustomerOverviewResponse {
  organization: Organization;
  activeCases: CaseSummary[];
  completedCases: CaseSummary[];
  allWorkers: WorkerSummary[];
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

export default function CustomerOverviewPanel({ 
  organizationId, 
  open, 
  onOpenChange 
}: CustomerOverviewPanelProps) {
  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch customer overview data
  const { data, isLoading, error } = useQuery<CustomerOverviewResponse>({
    queryKey: ['/api/organizations', organizationId, 'overview'],
    enabled: !!organizationId && open,
  });

  const getStatusBadgeVariant = (status: string) => {
    const statusMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      NEW: 'secondary',
      ANALYSING: 'default',
      AWAITING_REVIEW: 'default',
      READY_TO_SEND: 'default',
      COMPLETE: 'secondary',
    };
    return statusMap[status] || 'outline';
  };

  const getRagColor = (ragScore: string) => {
    const colorMap: Record<string, string> = {
      red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return colorMap[ragScore] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const CaseListItem = ({ case: caseItem }: { case: CaseSummary }) => (
    <Card className="hover-elevate cursor-pointer" data-testid={`customer-case-${caseItem.ticketId}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={getStatusBadgeVariant(caseItem.status)}>
                {caseItem.status}
              </Badge>
              <Badge className={getRagColor(caseItem.ragScore)}>
                {caseItem.ragScore.toUpperCase()}
              </Badge>
            </div>
            <h4 className="font-medium text-sm mb-1">
              {caseItem.workerName}
            </h4>
            <p className="text-xs text-muted-foreground mb-1">
              {caseItem.caseType.replace('_', ' ').toUpperCase()}
            </p>
            {caseItem.nextStep && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                Next: {caseItem.nextStep}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {format(new Date(caseItem.createdAt), 'MMM dd')}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-auto py-1 px-2"
              onClick={() => {
                window.open(`/tickets?id=${caseItem.ticketId}`, '_blank');
              }}
              data-testid={`button-view-customer-case-${caseItem.ticketId}`}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const WorkerListItem = ({ worker }: { worker: WorkerSummary }) => (
    <Card className="hover-elevate cursor-pointer" data-testid={`customer-worker-${worker.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm mb-1">
              {worker.firstName} {worker.lastName}
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              {worker.email}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {worker.totalCases} total cases
              </span>
              {worker.activeCases > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {worker.activeCases} active
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Filter workers by search term
  const filteredWorkers = data?.allWorkers.filter(worker =>
    `${worker.firstName} ${worker.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    worker.email.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (!organizationId || !open) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-customer-overview">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">Failed to load customer overview</p>
            </div>
          </div>
        )}

        {data && (
          <>
            <SheetHeader className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-2xl" data-testid="text-customer-name">
                    {data.organization.name}
                  </SheetTitle>
                  <SheetDescription data-testid="text-customer-id">
                    Organization ID: {data.organization.id.substring(0, 8)}
                  </SheetDescription>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3 pt-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-primary" data-testid="stat-customer-total-cases">
                      {data.stats.totalCases}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Cases</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600" data-testid="stat-customer-active-cases">
                      {data.stats.activeCases}
                    </div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-green-600" data-testid="stat-customer-workers">
                      {data.stats.totalWorkers}
                    </div>
                    <div className="text-xs text-muted-foreground">Workers</div>
                  </CardContent>
                </Card>
              </div>
            </SheetHeader>

            <Separator className="my-6" />

            {/* Contact Information */}
            {(data.organization.contactEmail || data.organization.contactPhone) && (
              <>
                <div className="space-y-4 mb-6">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Contact Information
                  </h3>
                  <div className="space-y-3">
                    {data.organization.contactEmail && (
                      <div className="flex items-center gap-3" data-testid="customer-contact-email">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{data.organization.contactEmail}</span>
                      </div>
                    )}
                    {data.organization.contactPhone && (
                      <div className="flex items-center gap-3" data-testid="customer-contact-phone">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{data.organization.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator className="my-6" />
              </>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active" data-testid="tab-customer-active-cases">
                  Active ({data.activeCases.length})
                </TabsTrigger>
                <TabsTrigger value="completed" data-testid="tab-customer-completed-cases">
                  Completed ({data.completedCases.length})
                </TabsTrigger>
                <TabsTrigger value="workers" data-testid="tab-customer-workers">
                  Workers ({data.allWorkers.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-3" data-testid="content-customer-active-cases">
                {data.activeCases.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No active cases</p>
                    </CardContent>
                  </Card>
                ) : (
                  data.activeCases.map((caseItem) => (
                    <CaseListItem key={caseItem.ticketId} case={caseItem} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-3" data-testid="content-customer-completed-cases">
                {data.completedCases.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No completed cases</p>
                    </CardContent>
                  </Card>
                ) : (
                  data.completedCases.map((caseItem) => (
                    <CaseListItem key={caseItem.ticketId} case={caseItem} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="workers" className="space-y-3" data-testid="content-customer-workers">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search workers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-customer-workers"
                  />
                </div>
                {filteredWorkers.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        {searchTerm ? 'No workers found' : 'No workers'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredWorkers.map((worker) => (
                    <WorkerListItem key={worker.id} worker={worker} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
