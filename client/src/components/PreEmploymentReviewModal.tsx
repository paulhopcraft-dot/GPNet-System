import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  Briefcase, 
  MapPin,
  X,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PreEmploymentReviewModalProps {
  ticketId: string;
  onClose: () => void;
}

export default function PreEmploymentReviewModal({ 
  ticketId, 
  onClose 
}: PreEmploymentReviewModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Fetch ticket and form submission details
  const ticketQuery = useQuery({
    queryKey: ['/api/pre-employment/review', ticketId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/pre-employment/review/${ticketId}`);
      return await response.json();
    },
  });

  // Submit review decision
  const reviewMutation = useMutation({
    mutationFn: async (reviewData: { decision: 'approve' | 'reject'; notes: string }) => {
      const response = await apiRequest("POST", `/api/pre-employment/review/${ticketId}`, reviewData);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Review Submitted",
        description: `Pre-employment assessment ${reviewDecision === 'approve' ? 'approved' : 'rejected'} successfully`,
      });
      // Invalidate relevant queries to refresh the dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/cases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Review Failed",
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitReview = () => {
    if (!reviewDecision || !reviewNotes.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a decision and provide review notes",
        variant: "destructive",
      });
      return;
    }

    reviewMutation.mutate({
      decision: reviewDecision,
      notes: reviewNotes.trim(),
    });
  };

  if (ticketQuery.isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 animate-pulse" />
              <span>Loading assessment details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (ticketQuery.error || !ticketQuery.data) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Error Loading Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Unable to load assessment details. Please try again.
            </p>
            <Button onClick={onClose} className="w-full">Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { ticket, worker, formSubmission, organization } = ticketQuery.data;
  const formData = formSubmission.rawData;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background max-w-5xl w-full rounded-lg shadow-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Pre-Employment Assessment Review</h2>
              <p className="text-muted-foreground mt-1">
                Review and approve health assessment for {worker.firstName} {worker.lastName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {ticket.status}
              </Badge>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                data-testid="button-close-review"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Left Panel - Assessment Details */}
          <div className="flex-1 p-6 border-r">
            <ScrollArea className="h-full">
              <div className="space-y-6">
                {/* Worker Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Worker Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Full Name</Label>
                        <p className="font-medium">{formData.firstName} {formData.lastName}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Date of Birth</Label>
                        <p className="font-medium">{formData.dateOfBirth}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Email</Label>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{formData.email}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Phone</Label>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{formData.phone}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Role Applied</Label>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{formData.roleApplied}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Site</Label>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{formData.site || 'Not specified'}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Medical History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Medical History</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Previous Injuries</Label>
                      <p className="text-sm mt-1">{formData.previousInjuries || 'None reported'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Current Medical Conditions</Label>
                      <p className="text-sm mt-1">
                        {formData.conditions?.length > 0 ? formData.conditions.join(', ') : 'None reported'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Current Medications</Label>
                      <p className="text-sm mt-1">{formData.medications || 'None reported'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Allergies</Label>
                      <p className="text-sm mt-1">{formData.allergies || 'None reported'}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Functional Capacity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Functional Capacity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Lifting Capacity</Label>
                        <p className="font-medium">{formData.liftingKg}kg</p>
                        {formData.liftingKg < 15 && (
                          <Badge variant="destructive" className="mt-1 text-xs">
                            Below minimum requirement (15kg)
                          </Badge>
                        )}
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Standing Duration</Label>
                        <p className="font-medium">{formData.standingMins} minutes</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Walking Duration</Label>
                        <p className="font-medium">{formData.walkingMins} minutes</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Repetitive Tasks</Label>
                        <p className="font-medium capitalize">{formData.repetitiveTasks}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Musculoskeletal Assessment */}
                <Card>
                  <CardHeader>
                    <CardTitle>Musculoskeletal Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {[
                        { key: 'mskBack', label: 'Back' },
                        { key: 'mskNeck', label: 'Neck' },
                        { key: 'mskShoulders', label: 'Shoulders' },
                        { key: 'mskElbows', label: 'Elbows' },
                        { key: 'mskWrists', label: 'Wrists' },
                        { key: 'mskHips', label: 'Hips' },
                        { key: 'mskKnees', label: 'Knees' },
                        { key: 'mskAnkles', label: 'Ankles' },
                      ].map(({ key, label }) => {
                        const value = formData[key] || 'none';
                        return (
                          <div key={key}>
                            <Label className="text-muted-foreground">{label}</Label>
                            <div className="flex items-center gap-2">
                              <p className="font-medium capitalize">{value}</p>
                              {value !== 'none' && (
                                <Badge variant="secondary" className="text-xs">
                                  Issue reported
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Psychosocial Screening */}
                <Card>
                  <CardHeader>
                    <CardTitle>Psychosocial Screening</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-muted-foreground">Sleep Quality</Label>
                        <p className="font-medium">{formData.sleepRating}/5</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Stress Level</Label>
                        <p className="font-medium">{formData.stressRating}/5</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Support Network</Label>
                        <p className="font-medium">{formData.supportRating}/5</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Review Actions */}
          <div className="w-80 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-4">Review Decision</h3>
                
                <div className="space-y-3">
                  <Button
                    variant={reviewDecision === 'approve' ? 'default' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setReviewDecision('approve')}
                    data-testid="button-approve"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Assessment
                  </Button>
                  
                  <Button
                    variant={reviewDecision === 'reject' ? 'destructive' : 'outline'}
                    className="w-full justify-start"
                    onClick={() => setReviewDecision('reject')}
                    data-testid="button-reject"
                  >
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Reject Assessment
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <Label htmlFor="reviewNotes" className="text-sm font-medium">
                  Review Notes *
                </Label>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  {reviewDecision === 'approve' 
                    ? 'Explain why this assessment is approved and any conditions for employment.'
                    : 'Explain the reasons for rejection and any required follow-up actions.'
                  }
                </p>
                <Textarea
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    reviewDecision === 'approve'
                      ? "Worker is fit for the role with no restrictions. All health indicators are within acceptable limits..."
                      : "Assessment rejected due to lifting capacity below minimum requirement. Worker should complete functional capacity evaluation before reapplying..."
                  }
                  className="min-h-32"
                  data-testid="textarea-review-notes"
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleSubmitReview}
                  disabled={!reviewDecision || !reviewNotes.trim() || reviewMutation.isPending}
                  className="w-full"
                  data-testid="button-submit-review"
                >
                  {reviewMutation.isPending ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      {reviewDecision === 'approve' ? (
                        <ThumbsUp className="h-4 w-4 mr-2" />
                      ) : (
                        <ThumbsDown className="h-4 w-4 mr-2" />
                      )}
                      Submit Review
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={reviewMutation.isPending}
                  className="w-full"
                  data-testid="button-cancel-review"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}