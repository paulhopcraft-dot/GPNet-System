import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Building, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CaseCardProps {
  ticketId: string;
  caseType: "pre_employment" | "injury";
  claimType?: string | null;
  priority?: string | null;
  workerName: string;
  roleApplied: string;
  company?: string;
  status: "NEW" | "ANALYSING" | "AWAITING_REVIEW" | "REVISIONS_REQUIRED" | "READY_TO_SEND" | "COMPLETE";
  ragScore?: "red" | "amber" | "green";
  createdAt: Date;
  onViewCase?: () => void;
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

const caseTypeConfig = {
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
};

const priorityConfig = {
  low: { variant: "secondary" as const, label: "Low Priority" },
  medium: { variant: "secondary" as const, label: "Medium Priority" },
  high: { variant: "destructive" as const, label: "High Priority" },
};

export default function CaseCard({
  ticketId,
  caseType,
  claimType,
  priority,
  workerName,
  roleApplied,
  company,
  status,
  ragScore,
  createdAt,
  onViewCase,
}: CaseCardProps) {
  const handleViewCase = () => {
    console.log(`Viewing case ${ticketId}`);
    onViewCase?.();
  };

  return (
    <Card className="hover-elevate cursor-pointer" onClick={handleViewCase} data-testid={`card-case-${ticketId}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground">#{ticketId}</span>
              <Badge 
                className={caseTypeConfig[caseType].className}
                data-testid={`badge-case-type-${caseType}`}
              >
                {caseTypeConfig[caseType].label}
              </Badge>
              <Badge {...statusConfig[status]} data-testid={`badge-status-${status.toLowerCase()}`}>
                {statusConfig[status].label}
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
            <h3 className="font-semibold text-lg" data-testid={`text-worker-name-${ticketId}`}>
              {workerName}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {ragScore && (
              <Badge 
                className={ragConfig[ragScore].className}
                data-testid={`badge-rag-${ragScore}`}
              >
                {ragConfig[ragScore].label}
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
                <span data-testid={`text-company-${ticketId}`}>{company}</span>
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