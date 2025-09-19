import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import InjuryForm from "@/components/InjuryForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { type InjuryFormData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function InjuryFormPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    ticketId: string;
    caseType: string;
    claimType: string;
    status: string;
    message: string;
  } | null>(null);

  const submitFormMutation = useMutation({
    mutationFn: async (formData: InjuryFormData) => {
      const response = await apiRequest("POST", "/api/webhook/injury", formData);
      return await response.json() as {
        success: boolean;
        ticketId: string;
        caseType: string;
        claimType: string;
        status: string;
        message: string;
      };
    },
    onSuccess: (result) => {
      console.log("Injury form submitted successfully:", result);
      setSubmissionResult({
        ticketId: result.ticketId,
        caseType: result.caseType,
        claimType: result.claimType,
        status: result.status,
        message: result.message,
      });
      setIsSubmitted(true);
    },
    onError: (error) => {
      console.error("Injury form submission failed:", error);
    },
  });

  const handleFormSubmit = (data: InjuryFormData) => {
    console.log("Injury form submitted:", data);
    submitFormMutation.mutate(data);
  };

  const handleSubmitAnother = () => {
    setIsSubmitted(false);
    setSubmissionResult(null);
    submitFormMutation.reset();
  };

  if (isSubmitted && submissionResult) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">GP</span>
                  </div>
                  <span className="text-xl font-bold text-foreground">GPNet</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Injury Report System
                </Badge>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                Injury Report Submitted Successfully
              </h1>
              <p className="text-lg text-muted-foreground">
                Your workplace injury report has been received and is being processed.
              </p>
            </div>

            <div className="bg-card border rounded-lg p-6 space-y-4 text-left max-w-md mx-auto">
              <h2 className="font-semibold text-foreground">Report Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket ID:</span>
                  <span className="font-mono text-foreground" data-testid="text-ticketId">
                    {submissionResult.ticketId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Case Type:</span>
                  <span className="capitalize text-foreground">{submissionResult.caseType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claim Type:</span>
                  <Badge variant={submissionResult.claimType === 'workcover' ? 'destructive' : 'secondary'}>
                    {submissionResult.claimType === 'workcover' ? 'WorkCover' : 'Standard'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" data-testid="text-status">
                    {submissionResult.status}
                  </Badge>
                </div>
              </div>
            </div>

            {submissionResult.claimType === 'workcover' && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 max-w-md mx-auto">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <h3 className="font-medium text-amber-800 dark:text-amber-200">
                      WorkCover Claim Processing
                    </h3>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Your injury report will be forwarded to WorkCover for processing. You may be contacted by a case manager within 48-72 hours.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground">
                {submissionResult.message}
              </p>
              <p className="text-sm text-muted-foreground">
                Please keep your ticket ID for reference. You will receive email updates on the progress of your case.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-6">
              <Button 
                onClick={handleSubmitAnother}
                variant="outline"
                data-testid="button-submit-another"
              >
                Submit Another Report
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                data-testid="button-dashboard"
              >
                View Dashboard
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (submitFormMutation.isError) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">GP</span>
                  </div>
                  <span className="text-xl font-bold text-foreground">GPNet</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Injury Report System
                </Badge>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">
                Submission Failed
              </h1>
              <p className="text-lg text-muted-foreground">
                There was an error submitting your injury report. Please try again.
              </p>
            </div>

            <div className="bg-card border rounded-lg p-6 max-w-md mx-auto">
              <p className="text-sm text-muted-foreground">
                If the problem persists, please contact your supervisor or IT support.
              </p>
            </div>

            <Button 
              onClick={() => {
                submitFormMutation.reset();
                setIsSubmitted(false);
              }}
              data-testid="button-try-again"
            >
              Try Again
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-foreground">GP</span>
                </div>
                <span className="text-xl font-bold text-foreground">GPNet</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                Injury Report System
              </Badge>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main>
        <InjuryForm 
          onSubmit={handleFormSubmit} 
          isSubmitting={submitFormMutation.isPending}
        />
      </main>
    </div>
  );
}