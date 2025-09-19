import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  ArrowLeft,
  Download,
  FileText,
  Stethoscope,
  Building,
  User,
  Calendar,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Printer,
  Send,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import InjuryReport from "@/components/InjuryReport";
import Header from "@/components/Header";

interface CaseDetails {
  ticketId: string;
  caseType: string;
  claimType?: string;
  priority?: string;
  status: string;
  createdAt: string;
  workerName: string;
  email: string;
  phone: string;
  roleApplied: string;
  company: string;
  ragScore: string;
  fitClassification: string;
  recommendations: string[];
  notes: string;
  formData: any;
}

interface InjuryDetails {
  id: string;
  ticketId: string;
  incidentDate: string;
  incidentTime: string;
  location: string;
  description: string;
  bodyPartsAffected: string[];
  injuryType: string;
  severity: string;
  witnessDetails?: string;
  immediateAction?: string;
  medicalTreatment: string;
  timeOffWork: boolean;
  estimatedRecovery?: string;
  createdAt: string;
  updatedAt: string;
}

export default function FitForWorkAssessment() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const { toast } = useToast();
  
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);

  // Fetch case details
  const { 
    data: caseDetails, 
    isLoading: isCaseLoading,
    error: caseError 
  } = useQuery<CaseDetails>({
    queryKey: ["/api/cases", ticketId],
    enabled: !!ticketId,
  });

  // Fetch injury details for injury cases
  const { 
    data: injuryDetails,
    isLoading: isInjuryLoading 
  } = useQuery<InjuryDetails>({
    queryKey: ["/api/cases", ticketId, "injury"],
    enabled: !!ticketId && caseDetails?.caseType === "injury",
  });

  // Regenerate analysis mutation
  const regenerateAnalysisMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/cases/${ticketId}/regenerate-analysis`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId] });
      toast({
        title: "Analysis Regenerated",
        description: "Injury analysis has been updated with latest assessment algorithms.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Regenerating Analysis",
        description: error.message || "Failed to regenerate analysis. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update assessment notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      return apiRequest("PUT", `/api/cases/${ticketId}/assessment-notes`, { notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", ticketId] });
      toast({
        title: "Notes Updated",
        description: "Assessment notes have been saved successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error Updating Notes",
        description: error.message || "Failed to update notes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveNotes = () => {
    if (assessmentNotes.trim()) {
      updateNotesMutation.mutate(assessmentNotes);
    }
  };

  const handleRegenerateAnalysis = () => {
    regenerateAnalysisMutation.mutate();
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportReport = () => {
    // In a real implementation, this would generate and download a PDF
    toast({
      title: "Export Initiated",
      description: "Report export will be available shortly.",
    });
  };

  if (isCaseLoading || isInjuryLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading fit-for-work assessment...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (caseError || !caseDetails) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error Loading Assessment</h2>
            <p className="text-muted-foreground">
              Unable to load fit-for-work assessment for this case.
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (caseDetails.caseType !== "injury") {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-6 py-8">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Not an Injury Case</h2>
            <p className="text-muted-foreground">
              Fit-for-work assessments are only available for workplace injury cases.
            </p>
          </div>
        </main>
      </div>
    );
  }

  // Prepare analysis data for the injury report
  const analysisData = {
    ragScore: caseDetails.ragScore as "green" | "amber" | "red",
    fitClassification: caseDetails.fitClassification as "fit" | "fit_with_restrictions" | "not_fit",
    recommendations: caseDetails.recommendations || [],
    notes: caseDetails.notes || "",
    // These would come from the enhanced analysis engine
    riskFactors: caseDetails.formData?.riskFactors || [],
    workCapacityAssessment: caseDetails.formData?.workCapacityAssessment || [],
    medicalRecommendations: caseDetails.formData?.medicalRecommendations || [],
    workplaceModifications: caseDetails.formData?.workplaceModifications || [],
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => window.history.back()}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-assessment-title">
                Fit-for-Work Assessment
              </h1>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>Case #{caseDetails.ticketId}</span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{caseDetails.workerName}</span>
                </div>
                {injuryDetails && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Injury: {format(new Date(injuryDetails.incidentDate), "MMM d, yyyy")}</span>
                  </div>
                )}
                <Badge variant={caseDetails.claimType === "workcover" ? "default" : "secondary"}>
                  {caseDetails.claimType === "workcover" ? "WorkCover Claim" : "Standard Claim"}
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRegenerateAnalysis}
                disabled={regenerateAnalysisMutation.isPending}
                data-testid="button-regenerate-analysis"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {regenerateAnalysisMutation.isPending ? "Regenerating..." : "Regenerate Analysis"}
              </Button>
              
              <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-view-full-report">
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Report
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Complete Injury Assessment Report</DialogTitle>
                  </DialogHeader>
                  <InjuryReport
                    workerName={caseDetails.workerName}
                    injuryDate={injuryDetails?.incidentDate || caseDetails.createdAt}
                    caseId={caseDetails.ticketId}
                    analysis={analysisData}
                  />
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" onClick={handlePrintReport} data-testid="button-print">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              
              <Button onClick={handleExportReport} data-testid="button-export">
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>

        {/* Assessment Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Fit Classification */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Work Fitness Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge 
                  variant={caseDetails.fitClassification === "fit" ? "default" : "secondary"}
                  className="text-sm"
                  data-testid="badge-fit-status"
                >
                  {caseDetails.fitClassification?.replace("_", " ").toUpperCase()}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Current assessment based on injury analysis
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Risk Level */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Risk Level
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge 
                  variant={caseDetails.ragScore === "green" ? "default" : caseDetails.ragScore === "amber" ? "secondary" : "destructive"}
                  data-testid="badge-risk-level"
                >
                  {caseDetails.ragScore.toUpperCase()} RISK
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Automated risk assessment score
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Case Priority */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Case Priority
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant="outline" data-testid="badge-priority">
                  {caseDetails.priority?.toUpperCase() || "STANDARD"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Management priority level
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Injury Details Summary */}
        {injuryDetails && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Injury Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium">Injury Type</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-injury-type">
                    {injuryDetails.injuryType}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Severity</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-severity">
                    {injuryDetails.severity}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-location">
                    {injuryDetails.location}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Body Parts Affected</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-body-parts">
                    {injuryDetails.bodyPartsAffected.join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Embedded Injury Report */}
        <InjuryReport
          workerName={caseDetails.workerName}
          injuryDate={injuryDetails?.incidentDate || caseDetails.createdAt}
          caseId={caseDetails.ticketId}
          analysis={analysisData}
          className="mb-8"
        />

        {/* Assessment Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assessment Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Add your professional assessment notes here..."
              value={assessmentNotes}
              onChange={(e) => setAssessmentNotes(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-assessment-notes"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Professional notes will be included in the final assessment report
              </p>
              <Button 
                onClick={handleSaveNotes}
                disabled={!assessmentNotes.trim() || updateNotesMutation.isPending}
                data-testid="button-save-notes"
              >
                <Send className="h-4 w-4 mr-2" />
                {updateNotesMutation.isPending ? "Saving..." : "Save Notes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}