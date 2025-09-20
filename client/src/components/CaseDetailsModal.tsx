import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Building, 
  Calendar, 
  FileText, 
  Send, 
  Edit,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Bot,
  Shield
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { MichelleChat } from "./MichelleChat";
import { ReportGenerator } from "./ReportGenerator";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CaseDetails {
  ticketId: string;
  workerName: string;
  email: string;
  phone: string;
  roleApplied: string;
  company: string;
  status: string;
  ragScore: "red" | "amber" | "green";
  createdAt: Date;
  fitClassification?: string;
  recommendations?: string[];
  notes?: string;
}

interface CaseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseDetails: CaseDetails | null;
  onStatusUpdate?: (ticketId: string, newStatus: string) => void;
  onRecommendationsUpdate?: (ticketId: string, recommendations: string[]) => void;
}

const ragConfig = {
  red: { 
    icon: XCircle, 
    className: "text-red-600", 
    bgClass: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
    label: "High Risk" 
  },
  amber: { 
    icon: AlertTriangle, 
    className: "text-yellow-600", 
    bgClass: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
    label: "Medium Risk" 
  },
  green: { 
    icon: CheckCircle, 
    className: "text-green-600", 
    bgClass: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    label: "Low Risk" 
  },
};

export default function CaseDetailsModal({
  isOpen,
  onClose,
  caseDetails,
  onStatusUpdate,
  onRecommendationsUpdate,
}: CaseDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRecommendations, setEditedRecommendations] = useState<string>("");
  const { toast } = useToast();

  // Risk level update mutation
  const updateRiskLevelMutation = useMutation({
    mutationFn: async ({ ticketId, ragScore }: { ticketId: string; ragScore: "green" | "amber" | "red" }) => {
      return apiRequest("PUT", `/api/cases/${ticketId}/risk-level`, { ragScore });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Risk Level Updated",
        description: "Case risk level has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update risk level",
      });
    },
  });

  if (!caseDetails) return null;

  const ragInfo = ragConfig[caseDetails.ragScore];
  const RagIcon = ragInfo.icon;

  const handleEdit = () => {
    setEditedRecommendations(caseDetails.recommendations?.join("\n") || "");
    setIsEditing(true);
  };

  const handleSave = () => {
    const newRecommendations = editedRecommendations
      .split("\n")
      .filter(line => line.trim())
      .map(line => line.trim());
    
    console.log("Saving recommendations:", newRecommendations);
    onRecommendationsUpdate?.(caseDetails.ticketId, newRecommendations);
    setIsEditing(false);
  };

  const handleApprove = () => {
    console.log("Approving case:", caseDetails.ticketId);
    onStatusUpdate?.(caseDetails.ticketId, "READY_TO_SEND");
  };

  const handleRequestRevisions = () => {
    console.log("Requesting revisions for case:", caseDetails.ticketId);
    onStatusUpdate?.(caseDetails.ticketId, "REVISIONS_REQUIRED");
  };

  const handleRiskLevelChange = (newRiskLevel: "green" | "amber" | "red") => {
    console.log("Updating risk level:", caseDetails.ticketId, newRiskLevel);
    updateRiskLevelMutation.mutate({ ticketId: caseDetails.ticketId, ragScore: newRiskLevel });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Case #{caseDetails.ticketId}</span>
            <Badge variant="outline" data-testid="badge-modal-status">
              {caseDetails.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="analysis" data-testid="tab-analysis">Analysis</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
            <TabsTrigger value="michelle" data-testid="tab-michelle">Michelle AI</TabsTrigger>
            <TabsTrigger value="actions" data-testid="tab-actions">Actions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Worker Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Worker Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-semibold text-lg" data-testid="text-modal-worker-name">
                      {caseDetails.workerName}
                    </p>
                    <p className="text-sm text-muted-foreground">{caseDetails.email}</p>
                    <p className="text-sm text-muted-foreground">{caseDetails.phone}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{caseDetails.company}</span>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium">Role Applied For:</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-modal-role">
                      {caseDetails.roleApplied}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Case Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Case Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Created {formatDistanceToNow(caseDetails.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium mb-2">Risk Assessment:</p>
                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${ragInfo.bgClass}`}>
                      <RagIcon className={`h-5 w-5 ${ragInfo.className}`} />
                      <span className={`font-medium ${ragInfo.className}`}>
                        {ragInfo.label}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Automated Analysis Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {caseDetails.fitClassification && (
                  <div>
                    <p className="font-medium mb-2">Fit Classification:</p>
                    <Badge variant="outline" className="text-base py-1 px-3">
                      {caseDetails.fitClassification}
                    </Badge>
                  </div>
                )}

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">Recommendations:</p>
                    {!isEditing && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={handleEdit}
                        data-testid="button-edit-recommendations"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <Textarea
                        value={editedRecommendations}
                        onChange={(e) => setEditedRecommendations(e.target.value)}
                        placeholder="Enter recommendations, one per line..."
                        rows={6}
                        data-testid="textarea-edit-recommendations"
                      />
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={handleSave}
                          data-testid="button-save-recommendations"
                        >
                          Save Changes
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setIsEditing(false)}
                          data-testid="button-cancel-edit"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {caseDetails.recommendations?.map((rec, index) => (
                        <div 
                          key={index} 
                          className="flex items-start gap-2 p-2 bg-muted/50 rounded"
                          data-testid={`text-recommendation-${index}`}
                        >
                          <span className="text-xs bg-primary text-primary-foreground rounded-full h-5 w-5 flex items-center justify-center mt-0.5">
                            {index + 1}
                          </span>
                          <span className="text-sm">{rec}</span>
                        </div>
                      )) || (
                        <p className="text-sm text-muted-foreground italic">
                          No recommendations available
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {caseDetails.notes && (
                  <>
                    <Separator />
                    <div>
                      <p className="font-medium mb-2">Analysis Notes:</p>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                        {caseDetails.notes}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportGenerator 
              caseId={caseDetails.ticketId} 
              data-testid="report-generator-modal" 
            />
          </TabsContent>

          <TabsContent value="michelle" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Michelle AI Assistant
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Chat with Michelle about this case. She can help answer questions about the worker's health assessment, 
                  provide guidance on return-to-work processes, and offer compliance recommendations.
                </p>
                <MichelleChat 
                  ticketId={caseDetails.ticketId}
                  conversationId={`case-${caseDetails.ticketId}`}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Consultant Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleApprove}
                    className="h-12"
                    data-testid="button-approve-case"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Send Report
                  </Button>
                  
                  <Button 
                    variant="outline"
                    onClick={handleRequestRevisions}
                    className="h-12"
                    data-testid="button-request-revisions"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Request Revisions
                  </Button>
                </div>

                <Separator />

                <div>
                  <p className="font-medium mb-2">Quick Actions:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => console.log("Download PDF")}
                      data-testid="button-download-pdf"
                    >
                      Download PDF
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => console.log("Send email")}
                      data-testid="button-send-email"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Send Email
                    </Button>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="font-medium mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Risk Level Override:
                  </p>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Current: <Badge className={ragConfig[caseDetails.ragScore].className.replace('text-', 'bg-').replace('800', '100')}>{ragConfig[caseDetails.ragScore].label}</Badge>
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant={caseDetails.ragScore === "green" ? "default" : "outline"}
                        onClick={() => handleRiskLevelChange("green")}
                        disabled={updateRiskLevelMutation.isPending}
                        className="flex items-center gap-1 text-green-700 border-green-300 hover:bg-green-50 data-[state=active]:bg-green-600"
                        data-testid="button-risk-green"
                      >
                        <CheckCircle className="h-3 w-3" />
                        Low Risk
                      </Button>
                      <Button
                        size="sm"
                        variant={caseDetails.ragScore === "amber" ? "default" : "outline"}
                        onClick={() => handleRiskLevelChange("amber")}
                        disabled={updateRiskLevelMutation.isPending}
                        className="flex items-center gap-1 text-yellow-700 border-yellow-300 hover:bg-yellow-50 data-[state=active]:bg-yellow-600"
                        data-testid="button-risk-amber"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Medium Risk
                      </Button>
                      <Button
                        size="sm"
                        variant={caseDetails.ragScore === "red" ? "default" : "outline"}
                        onClick={() => handleRiskLevelChange("red")}
                        disabled={updateRiskLevelMutation.isPending}
                        className="flex items-center gap-1 text-red-700 border-red-300 hover:bg-red-50 data-[state=active]:bg-red-600"
                        data-testid="button-risk-red"
                      >
                        <XCircle className="h-3 w-3" />
                        High Risk
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}