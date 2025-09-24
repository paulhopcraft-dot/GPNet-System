import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  Calendar, 
  User, 
  Building, 
  FileText, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Stethoscope,
  Clock,
  Target
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface CaseSummaryProps {
  caseDetails: {
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
    caseType?: string;
    claimType?: string;
    assignedTo?: string;
    nextStep?: string;
    lastStep?: string;
    lastStepCompletedAt?: Date;
    formData?: any;
  };
}

const ragConfig = {
  red: { 
    icon: XCircle, 
    className: "text-red-600", 
    bgClass: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800",
    label: "High Risk",
    status: "Urgent attention required"
  },
  amber: { 
    icon: AlertTriangle, 
    className: "text-yellow-600", 
    bgClass: "bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800",
    label: "Medium Risk",
    status: "Monitor closely"
  },
  green: { 
    icon: CheckCircle, 
    className: "text-green-600", 
    bgClass: "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800",
    label: "Low Risk",
    status: "Standard monitoring"
  },
};

const statusConfig = {
  NEW: { label: "New", variant: "secondary" as const },
  ANALYSING: { label: "Analysing", variant: "default" as const },
  AWAITING_REVIEW: { label: "Awaiting Review", variant: "outline" as const },
  READY_TO_SEND: { label: "Ready to Send", variant: "default" as const },
  COMPLETE: { label: "Complete", variant: "secondary" as const },
};

const caseTypeConfig = {
  pre_employment: { label: "Pre-Employment Check", icon: User },
  injury: { label: "Injury Assessment", icon: Stethoscope },
  mental_health: { label: "Mental Health Check", icon: User },
  exit: { label: "Exit Check", icon: User },
  prevention: { label: "Prevention Check", icon: User },
  general_health: { label: "General Health Check", icon: User },
};

export default function CaseSummary({ caseDetails }: CaseSummaryProps) {
  const ragInfo = ragConfig[caseDetails.ragScore];
  const RagIcon = ragInfo.icon;
  const caseTypeInfo = caseTypeConfig[caseDetails.caseType as keyof typeof caseTypeConfig] || caseTypeConfig.pre_employment;
  const CaseIcon = caseTypeInfo.icon;

  // Extract key information from form data if available
  const getIncidentInfo = () => {
    if (!caseDetails.formData) return null;
    
    // Handle different form structures
    const data = caseDetails.formData;
    
    if (data.incidentDate || data.dateOfInjury) {
      return {
        date: data.incidentDate || data.dateOfInjury,
        description: data.incidentDescription || data.howDidInjuryOccur || "Incident details not provided",
        workplace: data.workplace || caseDetails.company
      };
    }
    
    return null;
  };

  const getHealthConditions = () => {
    if (!caseDetails.formData) return [];
    
    const data = caseDetails.formData;
    const conditions = [];
    
    // Check for various health indicators
    if (data.currentMedications && data.currentMedications !== "none") {
      conditions.push(`Current medications: ${data.currentMedications}`);
    }
    
    if (data.medicalConditions && data.medicalConditions.length > 0) {
      conditions.push(`Medical conditions: ${data.medicalConditions.join(", ")}`);
    }
    
    if (data.injuryType) {
      conditions.push(`Injury type: ${data.injuryType}`);
    }
    
    if (data.bodyParts && data.bodyParts.length > 0) {
      conditions.push(`Affected areas: ${data.bodyParts.join(", ")}`);
    }
    
    return conditions;
  };

  const getCapacityInfo = () => {
    if (!caseDetails.formData) return null;
    
    const data = caseDetails.formData;
    
    if (data.liftingCapacity || data.currentCapacity) {
      return {
        lifting: data.liftingCapacity || data.currentCapacity,
        restrictions: data.workRestrictions || [],
        timeOff: data.timeOffWork || data.expectedTimeOff
      };
    }
    
    return null;
  };

  const incidentInfo = getIncidentInfo();
  const healthConditions = getHealthConditions();
  const capacityInfo = getCapacityInfo();

  return (
    <div className="space-y-6" data-testid="case-summary">
      {/* Header Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CaseIcon className="h-6 w-6 text-muted-foreground" />
              <div>
                <CardTitle className="text-xl" data-testid="text-case-title">
                  {caseDetails.workerName}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Case #{caseDetails.ticketId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge {...statusConfig[caseDetails.status as keyof typeof statusConfig]}>
                {statusConfig[caseDetails.status as keyof typeof statusConfig]?.label || caseDetails.status}
              </Badge>
              <Badge className={ragInfo.className}>
                <RagIcon className="h-3 w-3 mr-1" />
                {ragInfo.label}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium text-muted-foreground">Consultant</p>
              <p data-testid="text-assigned-to">{caseDetails.assignedTo || "Unassigned"}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Host Employer</p>
              <p data-testid="text-company">{caseDetails.company}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Role Applied</p>
              <p data-testid="text-role">{caseDetails.roleApplied}</p>
            </div>
            <div>
              <p className="font-medium text-muted-foreground">Case Type</p>
              <p data-testid="text-case-type">{caseTypeInfo.label}</p>
            </div>
          </div>
          
          {incidentInfo && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-muted-foreground">Date of Incident</p>
                  <p data-testid="text-incident-date">{incidentInfo.date}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Contact</p>
                  <p data-testid="text-contact">{caseDetails.phone}</p>
                </div>
                <div>
                  <p className="font-medium text-muted-foreground">Created</p>
                  <p data-testid="text-created-date">{format(caseDetails.createdAt, "dd/MM/yyyy")}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident Overview */}
      {incidentInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incident Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="font-medium">Where it happened:</p>
                <p className="text-sm text-muted-foreground">{incidentInfo.workplace}</p>
              </div>
              <div>
                <p className="font-medium">What happened:</p>
                <p className="text-sm text-muted-foreground">{incidentInfo.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary & Current Status */}
      <Card className={ragInfo.bgClass}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RagIcon className={`h-5 w-5 ${ragInfo.className}`} />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-medium">Current Status:</p>
              <p className="text-sm">{ragInfo.status}</p>
            </div>
            
            {caseDetails.fitClassification && (
              <div>
                <p className="font-medium">Fit Classification:</p>
                <p className="text-sm capitalize">{caseDetails.fitClassification.replace('_', ' ')}</p>
              </div>
            )}
            
            {capacityInfo && (
              <div>
                <p className="font-medium">Current Capacity:</p>
                <p className="text-sm">
                  Lifting capacity: {capacityInfo.lifting}kg
                  {capacityInfo.timeOff && ` • Expected time off: ${capacityInfo.timeOff}`}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Health Conditions & Diagnosis */}
      {healthConditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Medical Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {healthConditions.map((condition, index) => (
                <div key={index} className="text-sm">
                  <span className="font-medium">•</span> {condition}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations & Treatment Plan */}
      {caseDetails.recommendations && caseDetails.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Recommendations & Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {caseDetails.recommendations.map((rec, index) => (
                <div key={index} className="text-sm">
                  <span className="font-medium">•</span> {rec}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Current Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {caseDetails.lastStep && (
              <div>
                <p className="font-medium">Last Completed Step:</p>
                <p className="text-sm text-muted-foreground">{caseDetails.lastStep}</p>
                {caseDetails.lastStepCompletedAt && (
                  <p className="text-xs text-muted-foreground">
                    Completed {formatDistanceToNow(caseDetails.lastStepCompletedAt)} ago
                  </p>
                )}
              </div>
            )}
            
            {caseDetails.nextStep && (
              <div>
                <p className="font-medium">Next Required Action:</p>
                <p className="text-sm text-muted-foreground">{caseDetails.nextStep}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Additional Notes */}
      {caseDetails.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Additional Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {caseDetails.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}