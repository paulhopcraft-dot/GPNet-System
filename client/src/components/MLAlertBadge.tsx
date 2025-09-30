import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, UserX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface MLAlert {
  type: 'escalation' | 'compliance' | 'priority' | 'fraud';
  severity: 'high' | 'medium' | 'low';
  message: string;
  probability?: number;
}

interface MLAlertBadgeProps {
  ticketId: string;
}

export function MLAlertBadge({ ticketId }: MLAlertBadgeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/ml/predictions', ticketId],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry if ML service is down
  });

  if (isLoading || !data?.alerts || data.alerts.length === 0) {
    return null;
  }

  // Show only the highest priority alert
  const alert: MLAlert = data.alerts[0];

  if (alert.type === 'escalation' && alert.severity === 'high') {
    return (
      <Badge 
        variant="destructive" 
        className="flex items-center gap-1"
        data-testid={`badge-ml-alert-${alert.type}`}
      >
        <TrendingUp className="w-3 h-3" />
        <span>Likely WorkCover</span>
      </Badge>
    );
  }

  if (alert.type === 'compliance' && alert.severity === 'high') {
    return (
      <Badge 
        variant="destructive" 
        className="flex items-center gap-1"
        data-testid={`badge-ml-alert-${alert.type}`}
      >
        <UserX className="w-3 h-3" />
        <span>Compliance Risk</span>
      </Badge>
    );
  }

  if (alert.type === 'fraud') {
    return (
      <Badge 
        variant="destructive" 
        className="flex items-center gap-1"
        data-testid={`badge-ml-alert-${alert.type}`}
      >
        <AlertTriangle className="w-3 h-3" />
        <span>Fraud Alert</span>
      </Badge>
    );
  }

  if (alert.type === 'priority' && alert.severity === 'high') {
    return (
      <Badge 
        variant="destructive" 
        className="flex items-center gap-1"
        data-testid={`badge-ml-alert-${alert.type}`}
      >
        <AlertTriangle className="w-3 h-3" />
        <span>Urgent</span>
      </Badge>
    );
  }

  return null;
}

interface MLAlertDetailsProps {
  alerts: MLAlert[];
}

export function MLAlertDetails({ alerts }: MLAlertDetailsProps) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert, idx) => (
        <div 
          key={idx}
          className="p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800"
          data-testid={`alert-detail-${alert.type}`}
        >
          <div className="flex items-start gap-3">
            {alert.type === 'escalation' && <TrendingUp className="w-5 h-5 text-red-600 mt-0.5" />}
            {alert.type === 'compliance' && <UserX className="w-5 h-5 text-red-600 mt-0.5" />}
            {alert.type === 'fraud' && <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />}
            {alert.type === 'priority' && <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />}
            
            <div className="flex-1">
              <div className="font-semibold text-sm text-red-900 dark:text-red-100 mb-1">
                {alert.type === 'escalation' && 'WorkCover Escalation Risk'}
                {alert.type === 'compliance' && 'Compliance Issue'}
                {alert.type === 'fraud' && 'Fraud Detected'}
                {alert.type === 'priority' && 'Urgent Attention Required'}
              </div>
              <p className="text-sm text-red-800 dark:text-red-200">
                {alert.message}
              </p>
              {alert.probability && (
                <p className="text-xs text-red-700 dark:text-red-300 mt-2">
                  Probability: {Math.round(alert.probability * 100)}%
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
