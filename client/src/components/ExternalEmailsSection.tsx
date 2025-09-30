import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  User, 
  Calendar, 
  Clock, 
  Bot, 
  ExternalLink,
  FileText,
  AlertCircle,
  CheckCircle2,
  Eye,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';

interface ExternalEmail {
  id: string;
  messageId: string;
  originalSender: string;
  originalSenderName?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  aiRecommendations?: any[];
  forwardedBy: string;
  forwardedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  attachments?: Array<{
    id: string;
    filename: string;
    contentType: string;
    fileSize: number;
  }>;
}

interface ExternalEmailsSectionProps {
  ticketId: string;
}

export default function ExternalEmailsSection({ ticketId }: ExternalEmailsSectionProps) {
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  // Helper function to safely format dates
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'Date unknown';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return format(date, 'MMM d, yyyy h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  // Fetch external emails for this ticket
  const { data: emails, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/external-emails', 'ticket', ticketId],
    queryFn: async () => {
      const response = await fetch(`/api/external-emails/ticket/${ticketId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch external emails');
      }
      return response.json();
    }
  });

  const toggleEmailExpansion = (emailId: string) => {
    setExpandedEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case 'processing':
        return <Badge variant="default" className="gap-1"><Bot className="h-3 w-3" />Processing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="gap-1 text-green-600 border-green-200"><CheckCircle2 className="h-3 w-3" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <Bot className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading external emails...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            External Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">Failed to load external emails</p>
            <Button onClick={() => refetch()} variant="outline">Try Again</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            External Emails
          </CardTitle>
          <CardDescription>
            Emails forwarded by managers and external stakeholders related to this case
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No External Emails</h3>
            <p className="text-gray-600 mb-4">
              No emails have been forwarded for this case yet.
            </p>
            <p className="text-sm text-gray-500">
              Managers can forward relevant emails to automatically add them to this case with AI analysis.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="section-external-emails">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            External Emails ({emails.length})
          </CardTitle>
          <CardDescription>
            Emails forwarded by managers and external stakeholders with AI analysis and recommendations
          </CardDescription>
        </CardHeader>
      </Card>

      {emails.map((email: ExternalEmail) => {
        const isExpanded = expandedEmails.has(email.id);
        
        return (
          <Card key={email.id} className="border-l-4 border-l-blue-500" data-testid={`external-email-${email.id}`}>
            <CardContent className="p-4">
              {/* Email Header */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1" data-testid={`email-subject-${email.id}`}>
                    {email.subject}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {email.originalSenderName || email.originalSender}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(email.forwardedAt || email.createdAt)}
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <ExternalLink className="h-3 w-3" />
                      Forwarded by: {email.forwardedBy}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(email.processingStatus)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleEmailExpansion(email.id)}
                    data-testid={`button-toggle-email-${email.id}`}
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* AI Recommendations Preview */}
              {email.aiRecommendations && email.aiRecommendations.length > 0 && (
                <div className="mb-3 p-3 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-1">
                    <Bot className="h-4 w-4" />
                    AI Recommendations ({email.aiRecommendations.length})
                  </h4>
                  <div className="space-y-1">
                    {email.aiRecommendations.slice(0, isExpanded ? email.aiRecommendations.length : 2).map((rec: any, index: number) => (
                      <p key={index} className="text-sm text-blue-800">
                        • {rec.recommendation || rec.title || 'Recommendation available'}
                      </p>
                    ))}
                    {!isExpanded && email.aiRecommendations.length > 2 && (
                      <p className="text-sm text-blue-600">
                        +{email.aiRecommendations.length - 2} more recommendations (click to expand)
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Expanded Email Content */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  <Separator />
                  
                  {/* Email Body */}
                  <div>
                    <h4 className="font-medium mb-2">Email Content:</h4>
                    <div className="p-3 bg-gray-50 rounded-lg border max-h-96 overflow-y-auto">
                      <pre className="text-sm whitespace-pre-wrap font-sans">
                        {email.body}
                      </pre>
                    </div>
                  </div>

                  {/* Attachments */}
                  {email.attachments && email.attachments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Attachments ({email.attachments.length}):</h4>
                      <div className="space-y-2">
                        {email.attachments.map((attachment, index) => (
                          <div 
                            key={attachment.id} 
                            className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                            data-testid={`attachment-${attachment.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="text-sm font-medium">{attachment.filename}</span>
                              <span className="text-xs text-gray-500">
                                ({(attachment.fileSize / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-view-attachment-${attachment.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Processing Details */}
                  <div>
                    <h4 className="font-medium mb-2">Processing Details:</h4>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-medium">Message ID:</span>
                        <span className="font-mono text-xs">{email.messageId}</span>
                        <span className="font-medium">Status:</span>
                        <span>{email.processingStatus}</span>
                        <span className="font-medium">Forwarded:</span>
                        <span>{formatDate(email.forwardedAt || email.createdAt)}</span>
                        {email.updatedAt && email.updatedAt !== email.createdAt && (
                          <>
                            <span className="font-medium">Updated:</span>
                            <span>{formatDate(email.updatedAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Processing Status Messages */}
              {email.processingStatus === 'failed' && (
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-800">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    Processing failed. Contact support for assistance.
                  </p>
                </div>
              )}

              {email.processingStatus === 'processing' && (
                <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <Bot className="h-4 w-4 inline mr-1" />
                    AI is currently analyzing this email for additional recommendations...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}