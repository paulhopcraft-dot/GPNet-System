import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, TrendingDown, Target, Clock, Users, AlertTriangle,
  Building, BarChart3, Scale, Crown, Eye, Zap
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface CrossTenantAnalytics {
  summary: {
    totalOrganizations: number;
    activeOrganizations: number;
    totalCases: number;
    avgCompletionRate: number;
    avgProcessingTime: number;
    riskDistribution: { green: number; amber: number; red: number; };
  };
  organizationMetrics: Array<{
    organizationId: string;
    organizationName: string;
    status: string;
    trends: {
      case_completion_rate: number;
      avg_processing_time_days: number;
      risk_distribution: { green: number; amber: number; red: number; };
    };
    dashboard: {
      total: number;
      new: number;
      complete: number;
    };
    employeeCount: number;
    industryType: string;
  }>;
  industryBenchmarks: Record<string, {
    organizationCount: number;
    totalCases: number;
    avgCompletionRate: number;
    avgProcessingTime: number;
    riskDistribution: { green: number; amber: number; red: number; };
  }>;
  topPerformers: Array<{
    organizationId: string;
    organizationName: string;
    trends: { case_completion_rate: number; avg_processing_time_days: number; };
  }>;
  needsAttention: Array<{
    organizationId: string;
    organizationName: string;
    trends: { case_completion_rate: number; risk_distribution: { red: number; }; };
    dashboard: { total: number; };
  }>;
}

interface OrganizationComparison {
  comparisonData: Array<{
    organizationId: string;
    organizationName: string;
    industryType: string;
    employeeCount: number;
    metrics: {
      completionRate: number;
      processingTime: number;
      totalCases: number;
      riskDistribution: { green: number; amber: number; red: number; };
      monthlyGrowth: number;
    };
  }>;
  rankings: {
    completionRate: any[];
    processingTime: any[];
    caseVolume: any[];
    riskManagement: any[];
  };
  benchmarks: {
    avgCompletionRate: number;
    avgProcessingTime: number;
    totalCasesAcrossOrgs: number;
  };
}

export default function CrossTenantAnalyticsTab() {
  const [analyticsPeriod, setAnalyticsPeriod] = useState("30");
  const [selectedOrganizations, setSelectedOrganizations] = useState<string[]>([]);
  const [comparisonMetric, setComparisonMetric] = useState("completion_rate");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch cross-tenant analytics
  const { data: crossTenantData, isLoading: crossTenantLoading, error: crossTenantError } = useQuery<CrossTenantAnalytics>({
    queryKey: ["/api/analytics/cross-tenant", analyticsPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/cross-tenant?days=${analyticsPeriod}`);
      if (!response.ok) {
        throw new Error("Failed to fetch cross-tenant analytics");
      }
      return response.json();
    }
  });

  // Fetch organization comparison (only when organizations are selected)
  const { data: comparisonData, isLoading: comparisonLoading } = useQuery<OrganizationComparison>({
    queryKey: ["/api/analytics/organization-comparison", selectedOrganizations, comparisonMetric, analyticsPeriod],
    queryFn: async () => {
      if (selectedOrganizations.length === 0) return null;
      
      const params = new URLSearchParams({
        metric: comparisonMetric,
        period: analyticsPeriod
      });
      
      selectedOrganizations.forEach(orgId => {
        params.append('organizationIds', orgId);
      });
      
      const response = await fetch(`/api/analytics/organization-comparison?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch organization comparison");
      }
      return response.json();
    },
    enabled: selectedOrganizations.length > 0
  });

  if (crossTenantError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-center py-8">
            <div>
              <AlertTriangle className="h-16 w-16 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                Cross-tenant analytics requires superuser permissions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (crossTenantLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Loading cross-tenant analytics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!crossTenantData) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            No cross-tenant analytics data available.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for charts
  const riskDistributionData = [
    { name: "Green", value: crossTenantData.summary.riskDistribution.green, color: "#22c55e" },
    { name: "Amber", value: crossTenantData.summary.riskDistribution.amber, color: "#f59e0b" },
    { name: "Red", value: crossTenantData.summary.riskDistribution.red, color: "#ef4444" },
  ];

  const industryBenchmarkData = Object.entries(crossTenantData.industryBenchmarks).map(([industry, data]) => ({
    industry,
    organizations: data.organizationCount,
    cases: data.totalCases,
    completionRate: Math.round(data.avgCompletionRate * 10) / 10,
    processingTime: Math.round(data.avgProcessingTime * 10) / 10
  }));

  const organizationPerformanceData = crossTenantData.organizationMetrics.map(org => ({
    name: org.organizationName.length > 15 ? org.organizationName.substring(0, 15) + '...' : org.organizationName,
    completionRate: org.trends?.case_completion_rate || 0,
    processingTime: org.trends?.avg_processing_time_days || 0,
    totalCases: org.dashboard?.total || 0,
    greenCases: org.trends?.risk_distribution.green || 0,
    redCases: org.trends?.risk_distribution.red || 0
  }));

  const toggleOrganizationSelection = (orgId: string) => {
    setSelectedOrganizations(prev => 
      prev.includes(orgId) 
        ? prev.filter(id => id !== orgId)
        : [...prev, orgId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-cross-tenant-title">
            <Eye className="h-6 w-6" />
            Cross-Tenant Analytics
          </h2>
          <p className="text-muted-foreground">Platform-wide insights and organization benchmarking</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={analyticsPeriod} onValueChange={setAnalyticsPeriod} data-testid="select-analytics-period">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="organizations" data-testid="tab-organizations">Organizations</TabsTrigger>
          <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">Industry Benchmarks</TabsTrigger>
          <TabsTrigger value="comparison" data-testid="tab-comparison">Compare</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-organizations">
                  {crossTenantData.summary.totalOrganizations}
                </div>
                <p className="text-xs text-muted-foreground">
                  {crossTenantData.summary.activeOrganizations} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-cases">
                  {crossTenantData.summary.totalCases.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Across all organizations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-completion">
                  {crossTenantData.summary.avgCompletionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Platform average
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-avg-processing">
                  {crossTenantData.summary.avgProcessingTime.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  days on average
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Risk Distribution</CardTitle>
                <CardDescription>Cases by RAG score across all organizations</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={riskDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {riskDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Organization Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Organization Performance</CardTitle>
                <CardDescription>Completion rate vs processing time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={organizationPerformanceData.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="completionRate" fill="#3b82f6" name="Completion Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers and Needs Attention */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Top Performers
                </CardTitle>
                <CardDescription>Organizations with best performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {crossTenantData.topPerformers.map((org, index) => (
                    <div key={org.organizationId} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                          {index + 1}
                        </Badge>
                        <div>
                          <p className="font-medium">{org.organizationName}</p>
                          <p className="text-xs text-muted-foreground">
                            {org.trends.case_completion_rate.toFixed(1)}% completion, 
                            {org.trends.avg_processing_time_days.toFixed(1)} days avg
                          </p>
                        </div>
                      </div>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Needs Attention
                </CardTitle>
                <CardDescription>Organizations requiring intervention</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {crossTenantData.needsAttention.map((org) => (
                    <div key={org.organizationId} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                      <div>
                        <p className="font-medium">{org.organizationName}</p>
                        <p className="text-xs text-muted-foreground">
                          {org.trends.case_completion_rate.toFixed(1)}% completion, 
                          {org.trends.risk_distribution.red} red cases
                        </p>
                      </div>
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Selection</CardTitle>
              <CardDescription>
                Select organizations to compare in the comparison tab
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {crossTenantData.organizationMetrics.map((org) => (
                  <div key={org.organizationId} className="flex items-center space-x-2 p-3 border rounded-lg">
                    <Checkbox
                      id={`org-${org.organizationId}`}
                      checked={selectedOrganizations.includes(org.organizationId)}
                      onCheckedChange={() => toggleOrganizationSelection(org.organizationId)}
                      data-testid={`checkbox-org-${org.organizationId}`}
                    />
                    <div className="flex-1">
                      <label htmlFor={`org-${org.organizationId}`} className="text-sm font-medium cursor-pointer">
                        {org.organizationName}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {org.employeeCount} employees • {org.industryType}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <Badge 
                          variant={org.status === 'active' ? 'default' : 'secondary'} 
                          className="text-xs"
                        >
                          {org.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {org.dashboard?.total || 0} cases
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {selectedOrganizations.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {selectedOrganizations.length} organization{selectedOrganizations.length !== 1 ? 's' : ''} selected for comparison
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Industry Benchmarks Tab */}
        <TabsContent value="benchmarks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Industry Benchmarks</CardTitle>
              <CardDescription>Performance metrics by industry type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {industryBenchmarkData.map((industry) => (
                  <Card key={industry.industry} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{industry.industry}</h4>
                        <p className="text-sm text-muted-foreground">
                          {industry.organizations} organizations • {industry.cases} total cases
                        </p>
                      </div>
                      <Scale className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {industry.completionRate}%
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Completion Rate</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {industry.processingTime}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg Processing Days</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6">
          {selectedOrganizations.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>Select organizations from the Organizations tab to compare their performance metrics.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {comparisonLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <div className="animate-pulse">Loading comparison data...</div>
                    </div>
                  </CardContent>
                </Card>
              ) : comparisonData ? (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <Select value={comparisonMetric} onValueChange={setComparisonMetric}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completion_rate">Completion Rate</SelectItem>
                        <SelectItem value="processing_time">Processing Time</SelectItem>
                        <SelectItem value="case_volume">Case Volume</SelectItem>
                        <SelectItem value="risk_management">Risk Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Organization Comparison</CardTitle>
                      <CardDescription>
                        Comparing {comparisonData.comparisonData.length} organizations
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {comparisonData.comparisonData.map((org) => (
                          <Card key={org.organizationId} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-semibold">{org.organizationName}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {org.industryType} • {org.employeeCount} employees
                                </p>
                              </div>
                              <Badge variant="outline">{org.metrics.totalCases} cases</Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="font-medium text-green-600">
                                  {org.metrics.completionRate.toFixed(1)}%
                                </p>
                                <p className="text-muted-foreground">Completion</p>
                              </div>
                              <div>
                                <p className="font-medium text-blue-600">
                                  {org.metrics.processingTime.toFixed(1)}d
                                </p>
                                <p className="text-muted-foreground">Processing</p>
                              </div>
                              <div>
                                <p className="font-medium text-purple-600">
                                  {org.metrics.riskDistribution.green}/{org.metrics.riskDistribution.red}
                                </p>
                                <p className="text-muted-foreground">Green/Red</p>
                              </div>
                              <div>
                                <p className={`font-medium ${org.metrics.monthlyGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {org.metrics.monthlyGrowth >= 0 ? '+' : ''}{org.metrics.monthlyGrowth.toFixed(1)}%
                                </p>
                                <p className="text-muted-foreground">Growth</p>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                      
                      {/* Benchmarks */}
                      <div className="mt-6 pt-6 border-t">
                        <h4 className="font-semibold mb-3">Comparison Benchmarks</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="font-medium">{comparisonData.benchmarks.avgCompletionRate.toFixed(1)}%</p>
                            <p className="text-muted-foreground">Avg Completion</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="font-medium">{comparisonData.benchmarks.avgProcessingTime.toFixed(1)}d</p>
                            <p className="text-muted-foreground">Avg Processing</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="font-medium">{comparisonData.benchmarks.totalCasesAcrossOrgs.toLocaleString()}</p>
                            <p className="text-muted-foreground">Total Cases</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}