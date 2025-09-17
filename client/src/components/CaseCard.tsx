import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, User, Building, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CaseCardProps {
  ticketId: string;
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

export default function CaseCard({
  ticketId,
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
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">#{ticketId}</span>
              <Badge {...statusConfig[status]} data-testid={`badge-status-${status.toLowerCase()}`}>
                {statusConfig[status].label}
              </Badge>
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
            <Button size="icon" variant="ghost" onClick={handleViewCase} data-testid={`button-view-${ticketId}`}>
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