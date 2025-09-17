import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Users, CheckCircle, AlertTriangle, XCircle, TrendingUp } from "lucide-react";

interface StatusStats {
  total: number;
  new: number;
  inProgress: number;
  awaiting: number;
  complete: number;
  flagged: number;
}

interface StatusBoardProps {
  stats: StatusStats;
  todayCount?: number;
  weeklyGrowth?: number;
}

export default function StatusBoard({ 
  stats, 
  todayCount = 0, 
  weeklyGrowth = 0 
}: StatusBoardProps) {
  const statCards = [
    {
      title: "Total Cases",
      value: stats.total,
      icon: Users,
      change: `+${todayCount} today`,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "New Submissions",
      value: stats.new,
      icon: Clock,
      change: "Pending review",
      color: "text-orange-600",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
    {
      title: "In Progress",
      value: stats.inProgress + stats.awaiting,
      icon: TrendingUp,
      change: `${stats.awaiting} awaiting review`,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Completed",
      value: stats.complete,
      icon: CheckCircle,
      change: `+${weeklyGrowth}% this week`,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <Card key={stat.title} data-testid={`card-stat-${index}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`h-8 w-8 rounded-md ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-stat-value-${index}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground" data-testid={`text-stat-change-${index}`}>
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Risk Summary */}
      {stats.flagged > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-lg">Risk Alerts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {stats.flagged} cases require immediate attention
                </p>
              </div>
              <Badge variant="destructive" data-testid="badge-flagged-count">
                {stats.flagged} High Risk
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}