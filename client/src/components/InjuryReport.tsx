import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  CheckCircle, 
  AlertCircle, 
  Activity,
  FileText,
  Stethoscope,
  Building,
  Clock,
  User,
  Shield,
  TrendingUp,
  Heart
} from "lucide-react";
import { format } from "date-fns";

interface InjuryAnalysis {
  ragScore: "green" | "amber" | "red";
  fitClassification: "fit" | "fit_with_restrictions" | "not_fit";
  recommendations: string[];
  notes: string;
  riskFactors?: string[];
  workCapacityAssessment?: string[];
  medicalRecommendations?: string[];
  workplaceModifications?: string[];
}

interface InjuryReportProps {
  workerName: string;
  injuryDate: string;
  caseId: string;
  analysis: InjuryAnalysis;
  className?: string;
}

const ragScoreConfig = {
  green: {
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle,
    label: "Low Risk",
    description: "Minor concerns with standard management"
  },
  amber: {
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: AlertCircle,
    label: "Medium Risk",
    description: "Requires monitoring and modified approach"
  },
  red: {
    color: "bg-red-100 text-red-800 border-red-200",
    icon: AlertTriangle,
    label: "High Risk",
    description: "Immediate attention and comprehensive management required"
  }
};

const fitClassificationConfig = {
  fit: {
    color: "bg-green-100 text-green-800 border-green-200",
    icon: CheckCircle,
    label: "Fit for Work",
    description: "Can perform normal duties without restrictions"
  },
  fit_with_restrictions: {
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: AlertCircle,
    label: "Fit with Restrictions",
    description: "Can work with specified limitations and modifications"
  },
  not_fit: {
    color: "bg-red-100 text-red-800 border-red-200",
    icon: AlertTriangle,
    label: "Not Fit for Work",
    description: "Unable to perform work duties at this time"
  }
};

export default function InjuryReport({ 
  workerName, 
  injuryDate, 
  caseId, 
  analysis,
  className = ""
}: InjuryReportProps) {
  const ragConfig = ragScoreConfig[analysis.ragScore];
  const fitConfig = fitClassificationConfig[analysis.fitClassification];
  const RagIcon = ragConfig.icon;
  const FitIcon = fitConfig.icon;

  return (
    <div className={`space-y-6 ${className}`} data-testid="injury-report">
      {/* Report Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-3">
                <FileText className="h-6 w-6" />
                Injury Assessment Report
              </CardTitle>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span data-testid="text-worker-name">{workerName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span data-testid="text-injury-date">
                    {format(new Date(injuryDate), "MMMM d, yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  <span>Case #{caseId}</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Generated {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Assessment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RAG Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Risk Assessment (RAG Score)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={ragConfig.color} data-testid="badge-rag-score">
                  <RagIcon className="h-4 w-4 mr-2" />
                  {ragConfig.label}
                </Badge>
                <span className="text-sm font-medium uppercase tracking-wide">
                  {analysis.ragScore.toUpperCase()} RISK
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {ragConfig.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fit Classification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Work Fitness Classification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className={fitConfig.color} data-testid="badge-fit-classification">
                  <FitIcon className="h-4 w-4 mr-2" />
                  {fitConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {fitConfig.description}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Factors */}
        {analysis.riskFactors && analysis.riskFactors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Identified Risk Factors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.riskFactors.map((risk, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-md"
                    data-testid={`risk-factor-${index}`}
                  >
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{risk}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Work Capacity Assessment */}
        {analysis.workCapacityAssessment && analysis.workCapacityAssessment.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Work Capacity Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.workCapacityAssessment.map((assessment, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md"
                    data-testid={`work-capacity-${index}`}
                  >
                    <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{assessment}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Medical Recommendations */}
        {analysis.medicalRecommendations && analysis.medicalRecommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Medical Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.medicalRecommendations.map((recommendation, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-md"
                    data-testid={`medical-recommendation-${index}`}
                  >
                    <Heart className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{recommendation}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workplace Modifications */}
        {analysis.workplaceModifications && analysis.workplaceModifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Workplace Modifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.workplaceModifications.map((modification, index) => (
                  <div 
                    key={index} 
                    className="flex items-start gap-2 p-3 bg-purple-50 border border-purple-200 rounded-md"
                    data-testid={`workplace-modification-${index}`}
                  >
                    <Building className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{modification}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* General Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              General Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analysis.recommendations.map((recommendation, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md"
                  data-testid={`general-recommendation-${index}`}
                >
                  <CheckCircle className="h-4 w-4 text-slate-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">{recommendation}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analysis Notes */}
      {analysis.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Analysis Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <p className="text-sm" data-testid="analysis-notes">
                {analysis.notes}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Footer */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              This report is generated by GPNet's automated injury assessment system
            </span>
            <span>
              Report ID: {caseId}-{format(new Date(), "yyyyMMdd")}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}