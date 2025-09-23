import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import PreEmploymentForm from "@/components/PreEmploymentForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { type PreEmploymentFormData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function WorkerPreEmploymentCheck() {
  const [, setLocation] = useLocation();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    ticketId: string;
    status: string;
    message: string;
  } | null>(null);

  // Get token from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  // Validate token on page load
  const tokenValidationQuery = useQuery({
    queryKey: ['/api/pre-employment/validate-token', token],
    queryFn: async () => {
      if (!token) {
        throw new Error('No invitation token provided');
      }
      const response = await apiRequest("GET", `/api/pre-employment/validate-token?token=${token}`);
      return await response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Submit form mutation
  const submitFormMutation = useMutation({
    mutationFn: async (formData: PreEmploymentFormData) => {
      if (!token) {
        throw new Error('No invitation token available');
      }
      
      const payload = {
        ...formData,
        invitationToken: token,
      };
      
      const response = await apiRequest("POST", "/api/pre-employment/submit", payload);
      return await response.json() as {
        success: boolean;
        ticketId: string;
        status: string;
        message: string;
      };
    },
    onSuccess: (result) => {
      console.log("Pre-employment form submitted successfully:", result);
      setSubmissionResult({
        ticketId: result.ticketId,
        status: result.status,
        message: result.message,
      });
      setIsSubmitted(true);
    },
    onError: (error) => {
      console.error("Pre-employment form submission failed:", error);
    },
  });

  const handleFormSubmit = (data: PreEmploymentFormData) => {
    console.log("Worker pre-employment form submitted:", data);
    submitFormMutation.mutate(data);
  };

  // Show loading state while validating token
  if (!token) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Invalid Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This invitation link is invalid. Please check that you copied the complete URL from your email, or contact your manager for a new invitation.
            </p>
            <Button 
              onClick={() => setLocation('/')}
              className="w-full"
              data-testid="button-go-home"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenValidationQuery.isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Validating invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenValidationQuery.error) {
    const error = tokenValidationQuery.error as Error;
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Invalid or Expired
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {error.message || 'This invitation link has expired or is invalid. Please contact your manager for a new invitation.'}
            </p>
            <Button 
              onClick={() => setLocation('/')}
              className="w-full"
              data-testid="button-go-home"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success page after submission
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
                  Pre-Employment Health Check
                </Badge>
              </div>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="container mx-auto px-6 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2" data-testid="text-success-title">
                Assessment Complete
              </h1>
              <p className="text-muted-foreground text-lg">
                Thank you for completing your pre-employment health assessment
              </p>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">What happens next?</h3>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Your responses have been securely submitted and are being reviewed</p>
                      <p>• A qualified health professional will assess your information</p>
                      <p>• You will be contacted within 2-3 business days with the results</p>
                      <p>• Your employer will receive a fit-for-work certificate if appropriate</p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="font-medium text-sm">Reference: {submissionResult.ticketId}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please keep this reference number for your records
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                If you have any questions about this assessment, please contact your manager or HR department.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Show form if token is valid
  const tokenData = tokenValidationQuery.data;
  
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
                Pre-Employment Health Check
              </Badge>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {/* Welcome Card */}
        <div className="max-w-4xl mx-auto mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Your Pre-Employment Health Assessment</CardTitle>
              <CardDescription>
                Hello {tokenData?.workerName || 'there'}! Please complete this health assessment for your upcoming role at {tokenData?.organizationName || 'the organization'}. 
                This assessment helps ensure a safe and suitable work environment for everyone.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Form */}
        <div className="max-w-4xl mx-auto">
          <PreEmploymentForm 
            onSubmit={handleFormSubmit} 
            isSubmitting={submitFormMutation.isPending}
          />
        </div>

        {/* Error Display */}
        {submitFormMutation.error && (
          <div className="max-w-4xl mx-auto mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <h3 className="font-semibold">Submission Failed</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      There was an error submitting your assessment. Please try again or contact support if the problem persists.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}