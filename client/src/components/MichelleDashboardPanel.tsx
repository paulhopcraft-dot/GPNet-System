import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, AlertTriangle, Clock, CheckCircle, TrendingUp, Users, FileText, Shield, Building } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface DashboardStats {
  total: number;
  new: number;
  inProgress: number;
  awaiting: number;
  complete: number;
  flagged: number;
}

interface DashboardCase {
  ticketId: string;
  workerName: string;
  status: string;
  ragScore: "green" | "amber" | "red";
  nextStep?: string | null;
  priority?: string | null;
}

interface MichelleDashboardPanelProps {
  stats?: DashboardStats;
  recentCases?: DashboardCase[];
  userName?: string;
}

interface MichelleSuggestion {
  id: string;
  text: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  priority: "high" | "medium" | "low";
  count?: number;
}

interface MichelleMode {
  mode: 'client-scoped' | 'universal';
  accessLevel: 'client' | 'admin';
  organizationId?: string;
  capabilities: string[];
  phiAccess: boolean;
}

interface MichelleDataContext {
  mode: 'client-scoped' | 'universal';
  accessLevel: 'client' | 'admin';
  organizationId?: string;
  data: {
    totalTickets?: number;
    totalOrganizations?: number;
    stats?: DashboardStats;
    systemWideStats?: {
      red: number;
      amber: number;
      green: number;
    };
    organizationBreakdown?: Array<{
      id: string;
      name: string;
      ticketCount: number;
    }>;
  };
  capabilities: string[];
}

export default function MichelleDashboardPanel({ 
  stats, 
  recentCases = [],
  userName = "there" // Default greeting when no user name available
}: MichelleDashboardPanelProps) {
  const [suggestions, setSuggestions] = useState<MichelleSuggestion[]>([]);
  
  // Fetch Michelle's mode and capabilities
  const { data: michelleMode } = useQuery<MichelleMode>({
    queryKey: ['/api/michelle/mode'],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  // Fetch Michelle's data context
  const { data: michelleContext } = useQuery<MichelleDataContext>({
    queryKey: ['/api/michelle/context'],
    staleTime: 2 * 60 * 1000 // 2 minutes
  });

  // Fetch organization breakdown for dashboard
  const { data: organizationBreakdown } = useQuery<{
    organizations: Array<{ id: string; name: string; caseCount: number }>;
    totalActive: number;
    totalCases: number;
  }>({
    queryKey: ['/api/dashboard/organizations'],
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Generate activity-based suggestions based on mode and context
  useEffect(() => {
    const newSuggestions: MichelleSuggestion[] = [];
    
    // Use Michelle's context data if available, otherwise fall back to props
    const currentStats = michelleContext?.data?.stats || stats;
    const isUniversalMode = michelleMode?.mode === 'universal';

    if (currentStats) {
      // High priority: Awaiting review cases
      if (currentStats.awaiting > 0) {
        newSuggestions.push({
          id: "review-cases",
          text: `${currentStats.awaiting} cases need your review`,
          action: "review_cases",
          icon: Clock,
          priority: "high",
          count: currentStats.awaiting
        });
      }

      // High priority: High-risk flagged cases
      if (currentStats.flagged > 0) {
        newSuggestions.push({
          id: "high-risk",
          text: `${currentStats.flagged} high-risk cases require attention`,
          action: "view_flagged",
          icon: AlertTriangle,
          priority: "high",
          count: currentStats.flagged
        });
      }

      // Medium priority: New submissions
      if (currentStats.new > 0) {
        newSuggestions.push({
          id: "new-submissions",
          text: `${currentStats.new} new submissions to process`,
          action: "view_new",
          icon: FileText,
          priority: "medium",
          count: currentStats.new
        });
      }

      // Low priority: Check analytics if many cases completed
      if (currentStats.complete > 10) {
        newSuggestions.push({
          id: "view-analytics",
          text: "Review performance analytics and trends",
          action: "view_analytics",
          icon: TrendingUp,
          priority: "low"
        });
      }
      
      // Universal mode specific suggestions
      if (isUniversalMode && michelleContext?.data.systemWideStats) {
        newSuggestions.push({
          id: "platform-insights",
          text: "Review platform-wide insights and trends",
          action: "view_platform_analytics",
          icon: Shield,
          priority: "medium"
        });
        
        if (michelleContext.data.totalOrganizations && michelleContext.data.totalOrganizations > 1) {
          newSuggestions.push({
            id: "tenant-comparison",
            text: "Compare organization performance metrics",
            action: "view_tenant_comparison",
            icon: Building,
            priority: "low"
          });
        }
      }
    }

    // Default suggestions when no specific actions needed
    if (newSuggestions.length === 0) {
      newSuggestions.push(
        {
          id: "create-case",
          text: "Create new case",
          action: "create_case",
          icon: Users,
          priority: "medium"
        },
        {
          id: "view-analytics",
          text: "Review system analytics and insights",
          action: "view_analytics",
          icon: TrendingUp,
          priority: "low"
        }
      );
    }

    // Sort by priority and limit to top 3
    const sortedSuggestions = newSuggestions
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      })
      .slice(0, 3);

    setSuggestions(sortedSuggestions);
  }, [stats, michelleContext, michelleMode]);

  const handleSuggestionClick = (action: string) => {
    // Handle different actions
    switch (action) {
      case "review_cases":
        // Filter to awaiting review cases
        window.dispatchEvent(new CustomEvent('michelle-filter-cases', { 
          detail: { status: 'AWAITING_REVIEW' } 
        }));
        break;
      case "view_flagged":
        // Filter to high-risk cases
        window.dispatchEvent(new CustomEvent('michelle-filter-cases', { 
          detail: { ragScore: 'red' } 
        }));
        break;
      case "view_new":
        // Filter to new cases
        window.dispatchEvent(new CustomEvent('michelle-filter-cases', { 
          detail: { status: 'NEW' } 
        }));
        break;
      case "view_analytics":
        // Switch to analytics tab
        window.dispatchEvent(new CustomEvent('michelle-switch-tab', { 
          detail: { tab: 'analytics' } 
        }));
        break;
      case "create_case":
        // Could open a new case creation modal or navigate to form
        console.log("Create new case requested");
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const getSuggestionBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high": return "destructive" as const;
      case "medium": return "default" as const;
      case "low": return "secondary" as const;
      default: return "secondary" as const;
    }
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800" data-testid="card-michelle-dashboard">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 bg-blue-600">
            <AvatarFallback className="bg-blue-600 text-white font-semibold text-lg">
              M
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-xl font-semibold text-blue-900 dark:text-blue-100">
                <MessageCircle className="inline-block w-5 h-5 mr-2" />
                {getGreeting()}, {userName}!
              </CardTitle>
              {michelleMode && (
                <Badge 
                  variant={michelleMode.mode === 'universal' ? 'default' : 'secondary'}
                  className={`text-xs ${
                    michelleMode.mode === 'universal' 
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                      : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}
                  data-testid={`badge-michelle-mode-${michelleMode.mode}`}
                >
                  {michelleMode.mode === 'universal' ? (
                    <><Shield className="w-3 h-3 mr-1" />Universal</>
                  ) : (
                    <><Building className="w-3 h-3 mr-1" />Client-Scoped</>
                  )}
                </Badge>
              )}
            </div>
            <p className="text-blue-700 dark:text-blue-200 mt-1">
              I'm Michelle, your personal case manager. {michelleMode?.mode === 'universal' 
                ? "I have access to platform-wide data and insights." 
                : "I'm focused on your organization's data and cases."}
            </p>
            {organizationBreakdown && organizationBreakdown.totalActive > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Monitoring {organizationBreakdown.totalActive} active organizations with {organizationBreakdown.totalCases} total cases
              </p>
            )}
            {michelleMode?.mode === 'universal' && michelleContext?.data.totalOrganizations && (
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                Platform-wide: {michelleContext.data.totalOrganizations} organizations with {michelleContext.data.totalTickets} total cases
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {suggestions.length > 0 ? (
          suggestions.map((suggestion) => {
            const IconComponent = suggestion.icon;
            return (
              <Button
                key={suggestion.id}
                variant="ghost"
                className="w-full justify-start h-auto py-3 px-4 border border-blue-200 dark:border-blue-700 rounded-lg group hover-elevate"
                onClick={() => handleSuggestionClick(suggestion.action)}
                data-testid={`button-michelle-suggestion-${suggestion.id}`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-shrink-0">
                    <IconComponent className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 text-left">
                    <span className="text-blue-900 dark:text-blue-100 font-medium group-hover:text-blue-700 dark:group-hover:text-blue-200">
                      {suggestion.text}
                    </span>
                  </div>
                  <div className="flex-shrink-0">
                    <Badge 
                      variant={getSuggestionBadgeVariant(suggestion.priority)}
                      className="text-xs"
                    >
                      {suggestion.priority}
                    </Badge>
                  </div>
                </div>
              </Button>
            );
          })
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-blue-700 dark:text-blue-200">
              Everything looks good! All cases are up to date.
            </p>
          </div>
        )}
        
        <div className="border-t border-blue-200 dark:border-blue-700 pt-3 mt-4">
          <p className="text-sm text-blue-600 dark:text-blue-300 text-center">
            <MessageCircle className="inline-block w-4 h-4 mr-1" />
            Need help with something else? Click the chat icon in the corner to talk with me anytime.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}