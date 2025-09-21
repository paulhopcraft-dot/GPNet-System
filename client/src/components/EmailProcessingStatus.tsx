import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Mail, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Eye, 
  FileText,
  Bot,
  User,
  Calendar,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';

interface ExternalEmail {
  id: string;
  messageId: string;
  originalSender: string;
  originalSenderName?: string;
  subject: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  matchedTicketId?: string;
  aiRecommendations?: any[];
  forwardedBy: string;
  receivedAt: string;
  processedAt?: string;
  organizationId: string;
}

interface TicketSummary {
  id: string;
  workerId?: string;
  status: string;
  priority: string;
  claimType?: string;
}

interface EmailProcessingStatusProps {
  organizationId: string;
  managerEmail?: string;
}

export default function EmailProcessingStatus({ 
  organizationId, 
  managerEmail 
}: EmailProcessingStatusProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch external emails
  const { data: emails, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/external-emails', organizationId, managerEmail],
    queryFn: async () => {
      const params = new URLSearchParams({
        organizationId,
        ...(managerEmail && { forwardedBy: managerEmail })
      });
      
      const response = await fetch(`/api/external-emails?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch emails');
      }
      return response.json();
    }
  });

  // Filter emails based on search and status
  const filteredEmails = emails?.filter((email: ExternalEmail) => {
    const matchesSearch = !searchTerm || 
      email.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.originalSender.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.originalSenderName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || email.processingStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

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

  const getStatusStats = () => {
    if (!emails) return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    
    return emails.reduce((acc: any, email: ExternalEmail) => {
      acc.total++;
      acc[email.processingStatus]++;
      return acc;
    }, { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 });
  };

  const stats = getStatusStats();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <Bot className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading email processing status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">Failed to load email processing status</p>
            <Button onClick={() => refetch()} className="mt-4">Try Again</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="container-email-processing-status">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Emails</p>
                <p className="text-2xl font-bold" data-testid="stat-total">{stats.total}</p>
              </div>
              <Mail className="h-8 w-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="stat-pending">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Processing</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-processing">{stats.processing}</p>
              </div>
              <Bot className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Completed</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-completed">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Failed</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-failed">{stats.failed}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by subject, sender, or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-emails"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                data-testid="select-status-filter"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <Button
                variant="outline"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email List */}
      <Card>
        <CardHeader>
          <CardTitle>Email Processing History</CardTitle>
          <CardDescription>
            Track the status of forwarded emails and their AI analysis results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEmails.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No emails found matching your criteria</p>
              {searchTerm && (
                <Button 
                  variant="outline" 
                  onClick={() => setSearchTerm('')}
                  className="mt-2"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEmails.map((email: ExternalEmail) => (
                <Card key={email.id} className="border-l-4 border-l-blue-500" data-testid={`email-card-${email.id}`}>
                  <CardContent className="p-4">
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
                            {format(new Date(email.receivedAt), 'MMM d, yyyy h:mm a')}
                          </span>
                          {email.matchedTicketId && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              Case: {email.matchedTicketId}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(email.processingStatus)}
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-view-email-${email.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* AI Recommendations */}
                    {email.aiRecommendations && email.aiRecommendations.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-1">
                          <Bot className="h-4 w-4" />
                          AI Recommendations ({email.aiRecommendations.length})
                        </h4>
                        <div className="space-y-1">
                          {email.aiRecommendations.slice(0, 2).map((rec: any, index: number) => (
                            <p key={index} className="text-sm text-blue-800">
                              • {rec.recommendation || rec.title || 'Recommendation available'}
                            </p>
                          ))}
                          {email.aiRecommendations.length > 2 && (
                            <p className="text-sm text-blue-600">
                              +{email.aiRecommendations.length - 2} more recommendations
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Processing Details */}
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
                          AI is currently analyzing this email for case matching and recommendations...
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}