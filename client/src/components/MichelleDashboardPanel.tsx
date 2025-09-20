import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, AlertTriangle, Clock, CheckCircle, TrendingUp, Users, FileText } from "lucide-react";

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

export default function MichelleDashboardPanel({ 
  stats, 
  recentCases = [],
  userName = "there" // Default greeting when no user name available
}: MichelleDashboardPanelProps) {
  const [suggestions, setSuggestions] = useState<MichelleSuggestion[]>([]);

  // Generate activity-based suggestions
  useEffect(() => {
    const newSuggestions: MichelleSuggestion[] = [];

    if (stats) {
      // High priority: Awaiting review cases
      if (stats.awaiting > 0) {
        newSuggestions.push({
          id: "review-cases",
          text: `${stats.awaiting} cases need your review`,
          action: "review_cases",
          icon: Clock,
          priority: "high",
          count: stats.awaiting
        });
      }

      // High priority: High-risk flagged cases
      if (stats.flagged > 0) {
        newSuggestions.push({
          id: "high-risk",
          text: `${stats.flagged} high-risk cases require attention`,
          action: "view_flagged",
          icon: AlertTriangle,
          priority: "high",
          count: stats.flagged
        });
      }

      // Medium priority: New submissions
      if (stats.new > 0) {
        newSuggestions.push({
          id: "new-submissions",
          text: `${stats.new} new submissions to process`,
          action: "view_new",
          icon: FileText,
          priority: "medium",
          count: stats.new
        });
      }

      // Low priority: Check analytics if many cases completed
      if (stats.complete > 10) {
        newSuggestions.push({
          id: "view-analytics",
          text: "Review performance analytics and trends",
          action: "view_analytics",
          icon: TrendingUp,
          priority: "low"
        });
      }
    }

    // Default suggestions when no specific actions needed
    if (newSuggestions.length === 0) {
      newSuggestions.push(
        {
          id: "create-case",
          text: "Start a new pre-employment assessment",
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
  }, [stats]);

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
            <CardTitle className="text-xl font-semibold text-blue-900 dark:text-blue-100">
              <MessageCircle className="inline-block w-5 h-5 mr-2" />
              {getGreeting()}, {userName}!
            </CardTitle>
            <p className="text-blue-700 dark:text-blue-200 mt-1">
              I'm Michelle, your AI assistant. Here's what needs your attention today:
            </p>
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