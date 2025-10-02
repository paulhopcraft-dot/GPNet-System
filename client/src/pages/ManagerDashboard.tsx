import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Mail, 
  Upload, 
  BarChart3, 
  Users, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Bot,
  FileText,
  Briefcase,
  TrendingUp,
  UserPlus
} from 'lucide-react';
import EmailForwardingForm from '@/components/EmailForwardingForm';
import EmailProcessingStatus from '@/components/EmailProcessingStatus';
import InitiatePreEmploymentDialog from '@/components/InitiatePreEmploymentDialog';

interface ManagerDashboardProps {
  organizationId: string;
  managerEmail: string;
  managerName: string;
}

export default function ManagerDashboard({ 
  organizationId, 
  managerEmail, 
  managerName 
}: ManagerDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [initiateDialogOpen, setInitiateDialogOpen] = useState(false);

  // Fetch organization summary
  const { data: orgSummary } = useQuery({
    queryKey: ['/api/organizations', organizationId, 'summary'],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/summary`);
      if (!response.ok) throw new Error('Failed to fetch organization summary');
      return response.json();
    }
  });

  // Fetch recent case activity
  const { data: recentActivity } = useQuery({
    queryKey: ['/api/tickets', 'recent', organizationId],
    queryFn: async () => {
      const response = await fetch(`/api/tickets?organizationId=${organizationId}&limit=5&recent=true`);
      if (!response.ok) throw new Error('Failed to fetch recent activity');
      return response.json();
    }
  });

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl" data-testid="page-manager-dashboard">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Manager Dashboard
        </h1>
        <p className="text-gray-600">
          Welcome back, {managerName}. Forward emails and track case processing for your organization.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Cases</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="stat-active-cases">
                  {orgSummary?.activeCases || 0}
                </p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Processed Emails</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-processed-emails">
                  {orgSummary?.processedEmails || 0}
                </p>
              </div>
              <Mail className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">AI Recommendations</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="stat-ai-recommendations">
                  {orgSummary?.aiRecommendations || 0}
                </p>
              </div>
              <Bot className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-monthly-activity">
                  {orgSummary?.monthlyActivity || 0}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="forward-email" data-testid="tab-forward-email">
            <Upload className="h-4 w-4 mr-2" />
            Forward Email
          </TabsTrigger>
          <TabsTrigger value="email-status" data-testid="tab-email-status">
            <Clock className="h-4 w-4 mr-2" />
            Email Status
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Common tasks for case management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  className="w-full justify-start" 
                  onClick={() => setInitiateDialogOpen(true)}
                  data-testid="button-initiate-pre-employment"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Initiate Pre-Employment Check
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start" 
                  onClick={() => setActiveTab('forward-email')}
                  data-testid="button-forward-new-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Forward New Email
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setActiveTab('email-status')}
                  data-testid="button-check-processing-status"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Check Processing Status
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-view-analytics"
                  onClick={() => setActiveTab('analytics')}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Analytics
                </Button>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Case Activity
                </CardTitle>
                <CardDescription>
                  Latest updates on your cases
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity && recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.slice(0, 5).map((case_: any) => (
                      <div 
                        key={case_.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        data-testid={`recent-case-${case_.id}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            Case #{case_.id.substring(0, 8)}
                          </p>
                          <p className="text-xs text-gray-600">
                            {case_.workerId ? `Worker: ${case_.workerId}` : 'Unassigned'}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="text-xs">
                            {case_.status}
                          </Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            {case_.updatedAt ? new Date(case_.updatedAt).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 text-sm">No recent activity</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Key Features Info */}
          <Card>
            <CardHeader>
              <CardTitle>How Email-to-Case Integration Works</CardTitle>
              <CardDescription>
                Streamline your case management with AI-powered email processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Mail className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Forward Emails</h3>
                  <p className="text-sm text-gray-600">
                    Forward worker emails or inquiries from managers directly into the system
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <Bot className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold mb-2">2. AI Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Michelle AI analyzes content, matches to existing cases, and provides recommendations
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-2">3. Case Integration</h3>
                  <p className="text-sm text-gray-600">
                    Emails are automatically added to cases with actionable insights for coordinators
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Forward Email Tab */}
        <TabsContent value="forward-email">
          <EmailForwardingForm 
            organizationId={organizationId}
            managerEmail={managerEmail}
            onSuccess={() => setActiveTab('email-status')}
          />
        </TabsContent>

        {/* Email Status Tab */}
        <TabsContent value="email-status">
          <EmailProcessingStatus 
            organizationId={organizationId}
            managerEmail={managerEmail}
          />
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Processing Analytics</CardTitle>
              <CardDescription>
                Insights into email processing performance and case creation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Analytics Coming Soon</h3>
                <p className="text-gray-600 mb-4">
                  Detailed analytics and reporting features will be available in the next release.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-blue-900">Processing Time</p>
                    <p className="text-xs text-blue-700">Average email processing speed</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-900">Match Accuracy</p>
                    <p className="text-xs text-green-700">AI case matching success rate</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium text-purple-900">Recommendations</p>
                    <p className="text-xs text-purple-700">AI recommendation quality</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <InitiatePreEmploymentDialog 
        open={initiateDialogOpen}
        onOpenChange={setInitiateDialogOpen}
        organizationId={organizationId}
      />
    </div>
  );
}