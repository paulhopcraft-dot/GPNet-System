import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, FileText, Clock, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CaseSummaryData {
  ticketId: string;
  caseType: string;
  workerName: string;
  company: string;
  dateOfInjury?: string;
  injuryStatus?: string;
  latestCertificate?: {
    status: string;
    expiryDate: string;
    issuedBy: string;
  };
  recentSteps: Array<{
    step: string;
    completedAt: string;
  }>;
  suggestedNextStep: {
    action: string;
    assignedTo?: string;
    dueDate?: string;
    priority: string;
    urgency: string;
    reasoning: string;
  };
  currentStatus: string;
}

interface CaseSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CaseSummaryData | null;
  isLoading?: boolean;
}

export function CaseSummaryDialog({ open, onOpenChange, data, isLoading }: CaseSummaryDialogProps) {
  if (!data && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-case-summary">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            {isLoading ? "Analyzing Case..." : "Case Summary & Analysis"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : data && (
          <div className="space-y-6">
            {/* Case Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Worker</p>
                <p className="font-medium" data-testid="text-worker-name">{data.workerName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium" data-testid="text-company-name">{data.company}</p>
              </div>
              {data.dateOfInjury && (
                <div>
                  <p className="text-sm text-muted-foreground">Date of Injury</p>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium" data-testid="text-date-of-injury">
                      {new Date(data.dateOfInjury).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}
              {data.injuryStatus && (
                <div>
                  <p className="text-sm text-muted-foreground">Injury Status</p>
                  <Badge variant="outline" data-testid="badge-injury-status">{data.injuryStatus}</Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Latest Medical Certificate */}
            {data.latestCertificate && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Latest Medical Certificate
                  </h3>
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge data-testid="badge-cert-status">{data.latestCertificate.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Expiry Date</span>
                      <span className="font-medium" data-testid="text-cert-expiry">
                        {new Date(data.latestCertificate.expiryDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Issued By</span>
                      <span className="font-medium" data-testid="text-cert-issuer">{data.latestCertificate.issuedBy}</span>
                    </div>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Recent Steps */}
            {data.recentSteps.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Recent Steps
                  </h3>
                  <div className="space-y-2">
                    {data.recentSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-md" data-testid={`step-${idx}`}>
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm">{step.step}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(step.completedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Suggested Next Step */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Suggested Next Step
              </h3>
              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-3">
                <p className="font-medium text-lg" data-testid="text-suggested-next-step">{data.suggestedNextStep.action}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {data.suggestedNextStep.assignedTo && (
                    <div>
                      <p className="text-muted-foreground">Assigned To</p>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4" />
                        <p className="font-medium" data-testid="text-assigned-to">{data.suggestedNextStep.assignedTo}</p>
                      </div>
                    </div>
                  )}
                  {data.suggestedNextStep.dueDate && (
                    <div>
                      <p className="text-muted-foreground">Due Date</p>
                      <p className="font-medium mt-1" data-testid="text-due-date">
                        {new Date(data.suggestedNextStep.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Priority</p>
                    <Badge className="mt-1" data-testid="badge-priority">{data.suggestedNextStep.priority}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Urgency</p>
                    <Badge variant="outline" className="mt-1" data-testid="badge-urgency">{data.suggestedNextStep.urgency}</Badge>
                  </div>
                </div>
                
                {data.suggestedNextStep.reasoning && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reasoning</p>
                    <p className="text-sm mt-1" data-testid="text-reasoning">{data.suggestedNextStep.reasoning}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Current Status */}
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <span className="font-medium">Current Status</span>
              <Badge variant="secondary" data-testid="badge-current-status">{data.currentStatus}</Badge>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close">
                Close
              </Button>
              <Button onClick={() => onOpenChange(false)} data-testid="button-apply">
                Apply Next Step
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
