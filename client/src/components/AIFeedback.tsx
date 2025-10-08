import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  ThumbsUp, 
  ThumbsDown, 
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Send,
  Brain
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AIFeedbackProps {
  ticketId: string;
  suggestionText: string;
  features?: Record<string, any>;
  compact?: boolean;
  onFeedbackSubmitted?: () => void;
}

export default function AIFeedback({ 
  ticketId, 
  suggestionText, 
  features = {},
  compact = false,
  onFeedbackSubmitted 
}: AIFeedbackProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'correct' | 'not_relevant' | 'better_action' | null>(null);
  const [betterActionText, setBetterActionText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: async () => {
      if (!feedbackType) {
        throw new Error("Please select a feedback type");
      }

      return apiRequest("POST", `/api/case-console/${ticketId}/feedback`, {
        feedbackType,
        suggestionText,
        betterActionText: feedbackType === 'better_action' ? betterActionText : undefined,
        features,
      });
    },
    onSuccess: () => {
      toast({
        title: "Feedback Recorded",
        description: "Thank you! Your feedback helps improve AI predictions.",
      });
      setSubmitted(true);
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (feedbackType === 'better_action' && !betterActionText.trim()) {
      toast({
        title: "Better Action Required",
        description: "Please provide your suggested action.",
        variant: "destructive",
      });
      return;
    }
    feedbackMutation.mutate();
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
        <ThumbsUp className="h-4 w-4 text-green-600 dark:text-green-400" />
        <span className="text-sm text-green-700 dark:text-green-300">
          Feedback submitted - helping train the AI!
        </span>
      </div>
    );
  }

  if (compact && !isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="gap-2"
        data-testid="button-expand-feedback"
      >
        <Brain className="h-4 w-4" />
        Rate AI Suggestion
        <ChevronDown className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-blue-600" />
            Help Train the AI
          </CardTitle>
          {compact && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 w-6 p-0"
              data-testid="button-collapse-feedback"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm">
          <p className="text-muted-foreground mb-2">AI suggested:</p>
          <p className="font-medium p-2 bg-muted rounded-md" data-testid="text-ai-suggestion">
            {suggestionText}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Was this suggestion helpful?</p>
          <div className="flex gap-2">
            <Button
              variant={feedbackType === 'correct' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFeedbackType('correct')}
              className="gap-2 flex-1"
              data-testid="button-feedback-correct"
            >
              <ThumbsUp className="h-4 w-4" />
              Correct
            </Button>
            <Button
              variant={feedbackType === 'not_relevant' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFeedbackType('not_relevant')}
              className="gap-2 flex-1"
              data-testid="button-feedback-not-relevant"
            >
              <ThumbsDown className="h-4 w-4" />
              Not Relevant
            </Button>
            <Button
              variant={feedbackType === 'better_action' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFeedbackType('better_action')}
              className="gap-2 flex-1"
              data-testid="button-feedback-better-action"
            >
              <Lightbulb className="h-4 w-4" />
              I Have Better
            </Button>
          </div>
        </div>

        {feedbackType === 'better_action' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Your suggested action:</label>
            <Textarea
              placeholder="What should the next step be instead?"
              value={betterActionText}
              onChange={(e) => setBetterActionText(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-better-action"
            />
          </div>
        )}

        {feedbackType && (
          <Button
            onClick={handleSubmit}
            disabled={feedbackMutation.isPending}
            className="w-full gap-2"
            data-testid="button-submit-feedback"
          >
            <Send className="h-4 w-4" />
            {feedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        )}

        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
          💡 Your feedback trains the AI to make better predictions for your organization.
          After {50} feedback entries, you can train your custom model.
        </div>
      </CardContent>
    </Card>
  );
}
