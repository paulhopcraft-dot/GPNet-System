import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Building, Eye, CheckCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MLAlertBadge } from "./MLAlertBadge";

interface CaseCardProps {
  ticketId: string;
  fdId?: number | null;
  workerId?: string;
  caseType: "pre_employment" | "injury" | "rtw" | "capacity" | "surveillance" | "fitness" | "workcover";
  claimType?: string | null;
  priority?: string | null;
  workerName: string;
  roleApplied: string;
  company?: string;
  status: "NEW" | "ANALYSING" | "AWAITING_REVIEW" | "REVISIONS_REQUIRED" | "READY_TO_SEND" | "COMPLETE";
  ragScore?: "red" | "amber" | "green";
  createdAt: Date;
  nextStep?: string | null;
  lastStep?: string | null;
  lastStepCompletedAt?: Date | string | null;
  assignedTo?: string | null;
  onViewCase?: () => void;
  onWorkerClick?: (workerId: string) => void;
  onCompanyClick?: (organizationId: string, companyName: string) => void;
  organizationId?: string;
}

const statusConfig = {
  NEW: { variant: "secondary" as const, label: "New" },
  ANALYSING: { variant: "secondary" as const, label: "Analyzing" },
  AWAITING_REVIEW: { variant: "default" as const, label: "Awaiting Review" },
  REVISIONS_REQUIRED: { variant: "destructive" as const, label: "Revisions Required" },
  READY_TO_SEND: { variant: "default" as const, label: "Ready to Send" },
  COMPLETE: { variant: "outline" as const, label: "Complete" },
};

const ragConfig = {
  red: { className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", label: "High Risk" },
  amber: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", label: "Medium Risk" },
  green: { className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", label: "Low Risk" },
};

const caseTypeConfig: Record<string, { variant: "outline"; label: string; className: string }> = {
  pre_employment: { 
    variant: "outline" as const, 
    label: "Pre-Employment",
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
  },
  injury: { 
    variant: "outline" as const, 
    label: "Workplace Injury",
    className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
  },
  rtw: {
    variant: "outline" as const,
    label: "Return to Work",
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
  },
  capacity: {
    variant: "outline" as const,
    label: "Capacity Assessment",
    className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800"
  },
  surveillance: {
    variant: "outline" as const,
    label: "Health Surveillance",
    className: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800"
  },
  fitness: {
    variant: "outline" as const,
    label: "Fitness for Duty",
    className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
  },
  workcover: {
    variant: "outline" as const,
    label: "WorkCover Claim",
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
  },
};

const priorityConfig = {
  low: { variant: "secondary" as const, label: "Low Priority" },
  medium: { variant: "secondary" as const, label: "Medium Priority" },
  high: { variant: "destructive" as const, label: "High Priority" },
};

export default function CaseCard({
  ticketId,
  fdId,
  workerId,
  caseType,
  claimType,
  priority,
  workerName,
  roleApplied,
  company,
  status,
  ragScore,
  createdAt,
  nextStep,
  lastStep,
  lastStepCompletedAt,
  assignedTo,
  onViewCase,
  onWorkerClick,
  onCompanyClick,
  organizationId,
}: CaseCardProps) {
  const handleViewCase = () => {
    onViewCase?.();
  };
  
  const handleWorkerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (workerId && onWorkerClick) {
      onWorkerClick(workerId);
    }
  };
  
  const handleCompanyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (organizationId && onCompanyClick && company) {
      onCompanyClick(organizationId, company);
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`card-case-${ticketId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">
                #{fdId || ticketId.substring(0, 8).toUpperCase()}
              </span>
              <Badge 
                className={caseTypeConfig[caseType]?.className || "bg-gray-50 text-gray-700 border-gray-200"}
                data-testid={`badge-case-type-${caseType}`}
              >
                {caseTypeConfig[caseType]?.label || caseType || 'Unknown'}
              </Badge>
              <Badge {...(statusConfig[status] || {})} data-testid={`badge-status-${status.toLowerCase()}`}>
                {statusConfig[status]?.label || status || 'Unknown'}
              </Badge>
              {priority && priority !== "medium" && (
                <Badge 
                  {...priorityConfig[priority as keyof typeof priorityConfig]} 
                  data-testid={`badge-priority-${priority}`}
                >
                  {priorityConfig[priority as keyof typeof priorityConfig].label}
                </Badge>
              )}
            </div>
            <h3 
              className={`font-semibold text-lg ${workerId && onWorkerClick ? 'text-primary hover:underline cursor-pointer' : ''}`}
              onClick={workerId && onWorkerClick ? handleWorkerClick : undefined}
              data-testid={`text-worker-name-${ticketId}`}
            >
              {workerName}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {ragScore && (
              <Badge 
                className={ragConfig[ragScore]?.className || "bg-gray-50 text-gray-700 border-gray-200"}
                data-testid={`badge-rag-${ragScore}`}
              >
                {ragConfig[ragScore]?.label || ragScore || 'Unknown'}
              </Badge>
            )}
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={(e) => { e.stopPropagation(); handleViewCase(); }} 
              data-testid={`button-view-${ticketId}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span data-testid={`text-role-${ticketId}`}>{roleApplied}</span>
            </div>
            {company && (
              <div className="flex items-center gap-1">
                <Building className="h-4 w-4" />
                <span 
                  className={`${organizationId && onCompanyClick ? 'text-primary hover:underline cursor-pointer' : ''}`}
                  onClick={organizationId && onCompanyClick ? handleCompanyClick : undefined}
                  data-testid={`text-company-${ticketId}`}
                >
                  {company}
                </span>
              </div>
            )}
          </div>
          
          {/* Show claim type for injury cases */}
          {caseType === "injury" && claimType && (
            <div className="flex items-center gap-2">
              <Badge 
                variant={claimType === "workcover" ? "default" : "secondary"}
                className="text-xs"
                data-testid={`badge-claim-type-${claimType}`}
              >
                {claimType === "workcover" ? "WorkCover Claim" : "Standard Claim"}
              </Badge>
            </div>
          )}
          
          {/* Step tracking information */}
          <div className="space-y-2 pt-2 border-t">
            {nextStep && (
              <div className="flex items-center gap-2 text-sm">
                <ArrowRight className="h-4 w-4 text-blue-500" />
                <span className="text-foreground font-medium" data-testid={`text-next-step-${ticketId}`}>
                  Next: {nextStep}
                </span>
                {assignedTo && (
                  <Badge variant="outline" className="text-xs" data-testid={`badge-assigned-${ticketId}`}>
                    {assignedTo}
                  </Badge>
                )}
              </div>
            )}
            
            {lastStep && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span data-testid={`text-last-step-${ticketId}`}>
                  Last: {lastStep}
                </span>
                {lastStepCompletedAt && (
                  <span className="text-xs" data-testid={`text-last-completed-${ticketId}`}>
                    ({formatDistanceToNow(new Date(lastStepCompletedAt), { addSuffix: true })})
                  </span>
                )}
              </div>
            )}
            
            {!nextStep && !lastStep && (
              <div className="flex items-center gap-2 text-sm text-orange-600">
                <Clock className="h-4 w-4" />
                <span data-testid={`text-no-steps-${ticketId}`}>⚠️ Missing workflow steps - needs assignment</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span data-testid={`text-created-${ticketId}`}>
              {formatDistanceToNow(createdAt, { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}