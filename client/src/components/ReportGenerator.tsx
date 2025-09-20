import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Download, FileText, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ReportType {
  type: string;
  name: string;
  description: string;
  url: string;
  available: boolean;
}

interface AvailableReportsResponse {
  caseId: string;
  caseType: string;
  availableReports: ReportType[];
}

interface ReportGeneratorProps {
  caseId: string;
  "data-testid"?: string;
}

export function ReportGenerator({ caseId, "data-testid": testId }: ReportGeneratorProps) {
  const [generatingReports, setGeneratingReports] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Fetch available reports for this case
  const { data: reportsData, isLoading, error } = useQuery<AvailableReportsResponse>({
    queryKey: [`/api/cases/${caseId}/reports`],
    enabled: !!caseId
  });

  const generateReport = async (reportType: string, reportUrl: string, reportName: string) => {
    setGeneratingReports(prev => new Set(prev).add(reportType));
    
    try {
      const response = await fetch(reportUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to generate ${reportName}`);
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '') 
        : `${reportType}-${caseId}.pdf`;
        
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Report Generated",
        description: `${reportName} has been downloaded successfully.`,
      });
      
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Report Generation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setGeneratingReports(prev => {
        const newSet = new Set(prev);
        newSet.delete(reportType);
        return newSet;
      });
    }
  };

  const getReportIcon = (reportType: string) => {
    switch (reportType) {
      case "pre-employment":
        return <FileText className="h-5 w-5 text-green-600" />;
      case "injury":
        return <FileText className="h-5 w-5 text-red-600" />;
      case "compliance-audit":
        return <FileText className="h-5 w-5 text-purple-600" />;
      default:
        return <FileText className="h-5 w-5 text-blue-600" />;
    }
  };

  const getReportBadgeColor = (reportType: string) => {
    switch (reportType) {
      case "pre-employment":
        return "bg-green-100 text-green-800 hover:bg-green-200";
      case "injury":
        return "bg-red-100 text-red-800 hover:bg-red-200";
      case "compliance-audit":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200";
      default:
        return "bg-blue-100 text-blue-800 hover:bg-blue-200";
    }
  };

  if (isLoading) {
    return (
      <Card data-testid={testId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Generation
          </CardTitle>
          <CardDescription>Loading available reports...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid={testId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Generation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load available reports. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!reportsData || reportsData.availableReports.length === 0) {
    return (
      <Card data-testid={testId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Generation
          </CardTitle>
          <CardDescription>No reports available for this case type</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Report Generation
        </CardTitle>
        <CardDescription>
          Generate professional PDF reports for case documentation and compliance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {reportsData.availableReports.map((report) => (
            <div 
              key={report.type} 
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover-elevate"
              data-testid={`report-card-${report.type}`}
            >
              <div className="flex items-start gap-3 flex-1">
                <div className="mt-1">
                  {getReportIcon(report.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900" data-testid={`text-report-name-${report.type}`}>
                      {report.name}
                    </h4>
                    <Badge 
                      variant="secondary" 
                      className={getReportBadgeColor(report.type)}
                      data-testid={`badge-report-type-${report.type}`}
                    >
                      {report.type.replace('-', ' ')}
                    </Badge>
                    {report.available ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Available
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600" data-testid={`text-report-description-${report.type}`}>
                    {report.description}
                  </p>
                  {!report.available && (
                    <p className="text-xs text-yellow-600 mt-1">
                      Complete the required assessments to generate this report
                    </p>
                  )}
                </div>
              </div>
              <div className="ml-4">
                <Button
                  onClick={() => generateReport(report.type, report.url, report.name)}
                  disabled={!report.available || generatingReports.has(report.type)}
                  variant={report.available ? "default" : "secondary"}
                  size="sm"
                  className="min-w-[100px]"
                  data-testid={`button-generate-${report.type}`}
                >
                  {generatingReports.has(report.type) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">Report Information</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Reports are generated in real-time with the latest case data</li>
                <li>• All reports include professional formatting and compliance documentation</li>
                <li>• Generated PDFs are automatically downloaded to your device</li>
                <li>• Reports contain sensitive information and should be handled securely</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}