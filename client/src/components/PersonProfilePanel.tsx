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
import {
  User,
  Mail,
  Phone,
  Calendar,
  Building,
  Briefcase,
  FileText,
  ExternalLink,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { format } from 'date-fns';

interface PersonProfilePanelProps {
  workerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface WorkerProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  roleApplied: string;
  site?: string;
  organizationId: string;
}

interface CaseSummary {
  ticketId: string;
  caseType: string;
  status: string;
  priority: string;
  ragScore: string;
  createdAt: string;
  updatedAt?: string;
  company: string;
  nextStep?: string;
}

interface WorkerCasesResponse {
  worker: WorkerProfile;
  activeCases: CaseSummary[];
  allCases: CaseSummary[];
  stats: {
    totalCases: number;
    activeCases: number;
    completedCases: number;
    redFlags: number;
    amberFlags: number;
    greenFlags: number;
  };
}

export default function PersonProfilePanel({ workerId, open, onOpenChange }: PersonProfilePanelProps) {
  const [activeTab, setActiveTab] = useState('active');

  // Fetch worker profile and cases
  const { data, isLoading, error } = useQuery<WorkerCasesResponse>({
    queryKey: ['/api/workers', workerId, 'profile'],
    enabled: !!workerId && open,
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
    <Card className="hover-elevate cursor-pointer" data-testid={`case-item-${caseItem.ticketId}`}>
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
            <h4 className="font-medium text-sm mb-1 truncate">
              {caseItem.caseType.replace('_', ' ').toUpperCase()}
            </h4>
            <p className="text-xs text-muted-foreground mb-2">
              {caseItem.company}
            </p>
            {caseItem.nextStep && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                Next: {caseItem.nextStep}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {format(new Date(caseItem.createdAt), 'MMM dd, yyyy')}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-auto py-1 px-2"
              onClick={() => {
                window.open(`/tickets?id=${caseItem.ticketId}`, '_blank');
              }}
              data-testid={`button-view-case-${caseItem.ticketId}`}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!workerId || !open) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-person-profile">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <p className="text-muted-foreground">Failed to load worker profile</p>
            </div>
          </div>
        )}

        {data && (
          <>
            <SheetHeader className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-2xl" data-testid="text-worker-name">
                    {data.worker.firstName} {data.worker.lastName}
                  </SheetTitle>
                  <SheetDescription data-testid="text-worker-role">
                    {data.worker.roleApplied}
                  </SheetDescription>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3 pt-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-primary" data-testid="stat-total-cases">
                      {data.stats.totalCases}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Cases</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600" data-testid="stat-active-cases">
                      {data.stats.activeCases}
                    </div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-green-600" data-testid="stat-completed-cases">
                      {data.stats.completedCases}
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </CardContent>
                </Card>
              </div>
            </SheetHeader>

            <Separator className="my-6" />

            {/* Contact Information */}
            <div className="space-y-4 mb-6">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                Contact Information
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3" data-testid="contact-email">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{data.worker.email}</span>
                </div>
                <div className="flex items-center gap-3" data-testid="contact-phone">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{data.worker.phone}</span>
                </div>
                <div className="flex items-center gap-3" data-testid="contact-dob">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">DOB: {data.worker.dateOfBirth}</span>
                </div>
                {data.worker.site && (
                  <div className="flex items-center gap-3" data-testid="contact-site">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{data.worker.site}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Cases Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active" data-testid="tab-active-cases">
                  Active Cases ({data.activeCases.length})
                </TabsTrigger>
                <TabsTrigger value="all" data-testid="tab-all-cases">
                  All Cases ({data.allCases.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-3" data-testid="content-active-cases">
                {data.activeCases.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No active cases</p>
                    </CardContent>
                  </Card>
                ) : (
                  data.activeCases.map((caseItem) => (
                    <CaseListItem key={caseItem.ticketId} case={caseItem} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="all" className="space-y-3" data-testid="content-all-cases">
                {data.allCases.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No cases found</p>
                    </CardContent>
                  </Card>
                ) : (
                  data.allCases.map((caseItem) => (
                    <CaseListItem key={caseItem.ticketId} case={caseItem} />
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
