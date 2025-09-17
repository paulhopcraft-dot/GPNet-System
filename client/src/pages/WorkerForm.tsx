import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import PreEmploymentForm from "@/components/PreEmploymentForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { type PreEmploymentFormData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function WorkerForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    ticketId: string;
    status: string;
    message: string;
  } | null>(null);

  const submitFormMutation = useMutation({
    mutationFn: async (formData: PreEmploymentFormData) => {
      const response = await apiRequest("POST", "/api/webhook/jotform", formData);
      return await response.json() as {
        success: boolean;
        ticketId: string;
        status: string;
        message: string;
      };
    },
    onSuccess: (result) => {
      console.log("Form submitted successfully:", result);
      setSubmissionResult({
        ticketId: result.ticketId,
        status: result.status,
        message: result.message,
      });
      setIsSubmitted(true);
    },
    onError: (error) => {
      console.error("Form submission failed:", error);
    },
  });

  const handleFormSubmit = (data: PreEmploymentFormData) => {
    console.log("Worker form submitted:", data);
    submitFormMutation.mutate(data);
  };

  const handleSubmitAnother = () => {
    setIsSubmitted(false);
    setSubmissionResult(null);
    submitFormMutation.reset();
  };

  if (isSubmitted && submissionResult) {
    return (
      <div className="min-h-screen bg-muted/30">
        {/* Header */}
        <header className="border-b bg-background">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground font-bold text-sm">GP</span>
                  </div>
                  <span className="text-xl font-semibold">GPNet</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Pre-Employment Check
                </Badge>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Success Content */}
        <main className="container mx-auto px-6 py-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="mb-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2" data-testid="text-success-title">
                Assessment Submitted Successfully
              </h1>
              <p className="text-muted-foreground">
                Your pre-employment health assessment has been received and is now being processed.
              </p>
            </div>

            <div className="bg-background rounded-lg border p-6 mb-8 text-left">
              <h2 className="font-semibold mb-4">Submission Details</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Case ID:</span>
                  <span className="font-mono" data-testid="text-case-id">{submissionResult.ticketId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" data-testid="badge-status">{submissionResult.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted:</span>
                  <span>{new Date().toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A qualified health professional will review your assessment. You will be contacted if any additional information is required.
              </p>
              
              <Button 
                onClick={handleSubmitAnother}
                variant="outline" 
                data-testid="button-submit-another"
              >
                Submit Another Assessment
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Simple Header for Worker Form */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">GP</span>
                </div>
                <span className="text-xl font-semibold">GPNet</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                Pre-Employment Check
              </Badge>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-form-title">
            Pre-Employment Health Assessment
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Please complete this confidential health assessment as part of your pre-employment process. 
            All information will be reviewed by qualified health professionals and shared only with your prospective employer as necessary.
          </p>
        </div>

        <PreEmploymentForm
          onSubmit={handleFormSubmit}
          isSubmitting={submitFormMutation.isPending}
        />

        {/* Error Message */}
        {submitFormMutation.isError && (
          <div className="max-w-4xl mx-auto mt-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-destructive text-sm" data-testid="text-error-message">
                There was an error submitting your assessment. Please try again or contact support if the problem persists.
              </p>
            </div>
          </div>
        )}

        {/* Footer Information */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            This assessment is conducted in accordance with workplace health and safety regulations.
            For questions or assistance, please contact our support team.
          </p>
        </div>
      </main>
    </div>
  );
}