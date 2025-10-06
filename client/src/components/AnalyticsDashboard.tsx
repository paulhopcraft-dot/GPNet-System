import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, TrendingDown, Target, Clock, Users, AlertTriangle,
  Calendar, CheckCircle, Activity, BarChart3, Scale 
} from "lucide-react";
import { useState } from "react";

interface TrendAnalytics {
  daily_cases: { date: string; count: number; }[];
  case_completion_rate: number;
  avg_processing_time_days: number;
  risk_distribution: { green: number; amber: number; red: number; };
  injury_types: { type: string; count: number; }[];
  compliance_status: { compliant: number; at_risk: number; non_compliant: number; };
}

interface PerformanceMetrics {
  cases_this_month: number;
  cases_last_month: number;
  completion_rate: number;
  avg_response_time: number;
  participation_rate: number;
  risk_cases_resolved: number;
}

export default function AnalyticsDashboard() {
  const [trendPeriod, setTrendPeriod] = useState("30");

  // Fetch trend analytics
  const { data: trendData, isLoading: trendsLoading, error: trendsError } = useQuery<TrendAnalytics>({
    queryKey: ["/api/analytics/trends", trendPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/trends?days=${trendPeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch trend analytics');
      }
      return response.json();
    },
  });

  // Fetch performance metrics
  const { data: performanceData, isLoading: performanceLoading, error: performanceError } = useQuery<PerformanceMetrics>({
    queryKey: ["/api/analytics/performance"],
    queryFn: async () => {
      const response = await fetch('/api/analytics/performance');
      if (!response.ok) {
        throw new Error('Failed to fetch performance metrics');
      }
      return response.json();
    },
  });

  if (trendsLoading || performanceLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Loading analytics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (trendsError || performanceError) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p>Failed to load analytics data</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for charts
  const riskDistributionData = trendData ? [
    { name: "Green", value: trendData.risk_distribution.green, color: "#22c55e" },
    { name: "Amber", value: trendData.risk_distribution.amber, color: "#f59e0b" },
    { name: "Red", value: trendData.risk_distribution.red, color: "#ef4444" },
  ] : [];

  const complianceData = trendData ? [
    { name: "Compliant", value: trendData.compliance_status.compliant, color: "#22c55e" },
    { name: "At Risk", value: trendData.compliance_status.at_risk, color: "#f59e0b" },
    { name: "Non-Compliant", value: trendData.compliance_status.non_compliant, color: "#ef4444" },
  ] : [];

  // Performance metrics cards
  const performanceCards = performanceData ? [
    {
      title: "Cases This Month",
      value: performanceData.cases_this_month,
      change: performanceData.cases_last_month,
      changeLabel: "vs last month",
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Completion Rate",
      value: `${performanceData.completion_rate.toFixed(1)}%`,
      change: null,
      changeLabel: "overall",
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Avg Response Time",
      value: `${performanceData.avg_response_time.toFixed(1)}h`,
      change: null,
      changeLabel: "processing time",
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "Risk Cases Resolved",
      value: performanceData.risk_cases_resolved,
      change: null,
      changeLabel: "high-risk closed",
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Performance Metrics Cards */}
      {performanceData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {performanceCards.map((metric, index) => (
            <Card key={metric.title} data-testid={`card-metric-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <div className={`h-8 w-8 rounded-md ${metric.bgColor} flex items-center justify-center`}>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`text-metric-value-${index}`}>
                  {metric.value}
                </div>
                <p className="text-xs text-muted-foreground" data-testid={`text-metric-change-${index}`}>
                  {metric.change !== null && `${metric.change} `}{metric.changeLabel}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="risk" data-testid="tab-risk">Risk Analysis</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
          </TabsList>
          <Select value={trendPeriod} onValueChange={setTrendPeriod}>
            <SelectTrigger className="w-40" data-testid="select-trend-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Daily Cases Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Daily Case Creation
                </CardTitle>
                <CardDescription>
                  Case submission trends over the selected period
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData?.daily_cases || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString()}
                      formatter={(value: number) => [value, "Cases"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Processing Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Processing Metrics
                </CardTitle>
                <CardDescription>
                  Key performance indicators for case processing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Completion Rate</span>
                    <span className="font-semibold">{trendData?.case_completion_rate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(trendData?.case_completion_rate || 0, 100)}%` }}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Avg Processing Time</span>
                    <span className="font-semibold">{trendData?.avg_processing_time_days.toFixed(1)} days</span>
                  </div>
                </div>

                {performanceData && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Participation Rate</span>
                      <span className="font-semibold">{performanceData.participation_rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(performanceData.participation_rate, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Risk Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Distribution (RAG)
                </CardTitle>
                <CardDescription>
                  Risk assessment distribution across all cases
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskDistributionData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={(entry) => `${entry.name}: ${entry.value}`}
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

            {/* Injury Types */}
            <Card>
              <CardHeader>
                <CardTitle>Top Injury Types</CardTitle>
                <CardDescription>
                  Most common injury types reported
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trendData?.injury_types || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="type" 
                      angle={-45}
                      textAnchor="end"
                      height={100}
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Compliance Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Compliance Status
                </CardTitle>
                <CardDescription>
                  Current compliance status across all cases
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={complianceData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={(entry) => `${entry.name}: ${entry.value}`}
                    >
                      {complianceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Compliance Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Compliance Summary</CardTitle>
                <CardDescription>
                  Key compliance metrics and alerts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {trendData && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="font-medium">Compliant Cases</span>
                      </div>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                        {trendData.compliance_status.compliant}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium">At Risk Cases</span>
                      </div>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">
                        {trendData.compliance_status.at_risk}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                        <span className="font-medium">Non-Compliant Cases</span>
                      </div>
                      <Badge variant="destructive">
                        {trendData.compliance_status.non_compliant}
                      </Badge>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}