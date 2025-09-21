import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Mail, 
  Clock,
  User,
  Building,
  Loader2,
  ExternalLink
} from "lucide-react";

interface UnmatchedEmail {
  id: string;
  organizationId: string;
  originalSender: string;
  originalSenderName?: string;
  originalSubject: string;
  subject: string;
  forwardedBy: string;
  forwardedAt: string;
  processingStatus: string;
  aiSummary?: string;
  urgencyLevel?: string;
  needsAdminReview: boolean;
  createdAt: string;
}

export default function UnmatchedEmailsTab() {
  const { 
    data: unmatchedEmails, 
    isLoading,
    error 
  } = useQuery<UnmatchedEmail[]>({ 
    queryKey: ["/api/admin/unmatched-emails"],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <span>Loading unmatched emails...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <p className="text-red-600">Error loading unmatched emails</p>
            <p className="text-muted-foreground text-sm mt-2">
              {error.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!unmatchedEmails || unmatchedEmails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-green-600" />
            Unmatched Emails
          </CardTitle>
          <CardDescription>
            External emails that couldn't be matched to cases and need admin review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="bg-green-50 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <Mail className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">All Clear!</h3>
            <p className="text-muted-foreground">No unmatched emails require admin attention at this time.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'outline';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unmatched': return 'destructive';
      case 'error': return 'destructive';
      case 'pending': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Unmatched Emails Requiring Review
            <Badge variant="destructive" className="ml-auto">
              {unmatchedEmails.length} Emails
            </Badge>
          </CardTitle>
          <CardDescription>
            External emails that couldn't be automatically matched to existing cases and need admin attention
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {unmatchedEmails.map((email) => (
          <Card key={email.id} className="hover-elevate" data-testid={`unmatched-email-${email.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    {email.originalSubject || email.subject}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{email.originalSenderName || email.originalSender}</span>
                    <span className="text-xs">({email.originalSender})</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {email.urgencyLevel && (
                    <Badge variant={getUrgencyColor(email.urgencyLevel)} className="text-xs">
                      {email.urgencyLevel.toUpperCase()}
                    </Badge>
                  )}
                  <Badge variant={getStatusColor(email.processingStatus)} className="text-xs">
                    {email.processingStatus.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {email.aiSummary && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-1">AI Summary:</h4>
                  <p className="text-sm text-muted-foreground">{email.aiSummary}</p>
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    <span>Org: {email.organizationId}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>Forwarded by: {email.forwardedBy}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(email.forwardedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs"
                  data-testid={`button-review-${email.id}`}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Review Email
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}