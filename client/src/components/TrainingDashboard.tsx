import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Zap,
  Database
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface TrainingStatus {
  latestRun: {
    id: string;
    version: string;
    status: string;
    trainingDataCount: number;
    metrics?: {
      accuracy?: number;
      precision?: number;
      recall?: number;
      f1Score?: number;
    };
    createdAt: string;
    finishedAt?: string;
  } | null;
  totalRuns: number;
  feedbackCount: number;
  canTrain: boolean;
  allRuns: any[];
}

export default function TrainingDashboard() {
  const { toast } = useToast();
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

  const { data: trainingStatus, isLoading } = useQuery<TrainingStatus>({
    queryKey: ['/api/case-console/training/status'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const trainModelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/case-console/training/start");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/case-console/training/status'] });
      toast({
        title: "Training Started",
        description: "Your AI model is now training. This may take a few minutes.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Training Failed",
        description: error.message || "Failed to start model training.",
        variant: "destructive",
      });
    },
  });

  const generateDemoMutation = useMutation({
    mutationFn: async () => {
      setIsGeneratingDemo(true);
      return apiRequest("POST", "/api/case-console/training/demo-feedback", {
        feedbackCount: 50,
        organizationId: "34878b77-8969-40d1-86e2-8192869275d2" // Org with tickets for demo
      });
    },
    onSuccess: (data: any) => {
      setIsGeneratingDemo(false);
      queryClient.invalidateQueries({ queryKey: ['/api/case-console/training/status'] });
      toast({
        title: "Demo Feedback Generated",
        description: `Generated ${data.totalFeedback} feedback entries for testing.`,
      });
    },
    onError: (error: any) => {
      setIsGeneratingDemo(false);
      toast({
        title: "Error",
        description: error.message || "Failed to generate demo feedback.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  const feedbackProgress = trainingStatus ? (trainingStatus.feedbackCount / 50) * 100 : 0;
  const canTrain = trainingStatus?.canTrain ?? false;
  const isTraining = trainingStatus?.latestRun?.status === 'running';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Training Status
          </CardTitle>
          <CardDescription>
            Monitor and manage your organization's AI model training
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Feedback Collection Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Training Data Collected</span>
              </div>
              <Badge variant={canTrain ? "default" : "secondary"} data-testid="badge-feedback-count">
                {trainingStatus?.feedbackCount ?? 0} / 50
              </Badge>
            </div>
            <Progress value={feedbackProgress} className="h-2" data-testid="progress-feedback" />
            <p className="text-xs text-muted-foreground">
              {canTrain 
                ? "✓ Ready to train! You have enough feedback data." 
                : `Need ${50 - (trainingStatus?.feedbackCount ?? 0)} more feedback entries to train.`}
            </p>
          </div>

          {/* Latest Training Run */}
          {trainingStatus?.latestRun && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Latest Training Run</span>
                <Badge 
                  variant={
                    trainingStatus.latestRun.status === 'completed' ? 'default' :
                    trainingStatus.latestRun.status === 'running' ? 'secondary' :
                    'destructive'
                  }
                  data-testid="badge-training-status"
                >
                  {trainingStatus.latestRun.status === 'running' && <Clock className="h-3 w-3 mr-1 animate-spin" />}
                  {trainingStatus.latestRun.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {trainingStatus.latestRun.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                  {trainingStatus.latestRun.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Model Version</p>
                  <p className="font-medium" data-testid="text-model-version">{trainingStatus.latestRun.version}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Training Samples</p>
                  <p className="font-medium" data-testid="text-training-samples">{trainingStatus.latestRun.trainingDataCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Started</p>
                  <p className="font-medium text-xs" data-testid="text-training-started">
                    {formatDistanceToNow(new Date(trainingStatus.latestRun.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {trainingStatus.latestRun.finishedAt && (
                  <div>
                    <p className="text-muted-foreground">Finished</p>
                    <p className="font-medium text-xs" data-testid="text-training-finished">
                      {formatDistanceToNow(new Date(trainingStatus.latestRun.finishedAt), { addSuffix: true })}
                    </p>
                  </div>
                )}
              </div>

              {/* Metrics */}
              {trainingStatus.latestRun.metrics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">Accuracy</p>
                    <p className="text-lg font-bold" data-testid="text-accuracy">
                      {((trainingStatus.latestRun.metrics.accuracy ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">Precision</p>
                    <p className="text-lg font-bold" data-testid="text-precision">
                      {((trainingStatus.latestRun.metrics.precision ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">Recall</p>
                    <p className="text-lg font-bold" data-testid="text-recall">
                      {((trainingStatus.latestRun.metrics.recall ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">F1 Score</p>
                    <p className="text-lg font-bold" data-testid="text-f1-score">
                      {((trainingStatus.latestRun.metrics.f1Score ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => trainModelMutation.mutate()}
              disabled={!canTrain || isTraining || trainModelMutation.isPending}
              className="flex-1 gap-2"
              data-testid="button-train-model"
            >
              <TrendingUp className="h-4 w-4" />
              {isTraining ? 'Training...' : 'Train Model'}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => generateDemoMutation.mutate()}
              disabled={isGeneratingDemo || generateDemoMutation.isPending}
              className="gap-2"
              data-testid="button-generate-demo"
            >
              <Zap className="h-4 w-4" />
              {isGeneratingDemo ? 'Generating...' : 'Generate Demo Data'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded">
            💡 <strong>Tip:</strong> Use "Generate Demo Data" to quickly create {50 - (trainingStatus?.feedbackCount ?? 0)} sample feedback entries for testing the training system.
          </p>
        </CardContent>
      </Card>

      {/* Training History */}
      {trainingStatus && trainingStatus.totalRuns > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Training History</CardTitle>
            <CardDescription>Past {trainingStatus.allRuns.length} training runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trainingStatus.allRuns.map((run: any, idx: number) => (
                <div 
                  key={run.id} 
                  className="flex items-center justify-between p-2 rounded hover-elevate"
                  data-testid={`training-run-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={run.status === 'completed' ? 'default' : run.status === 'failed' ? 'destructive' : 'secondary'}>
                      {run.status}
                    </Badge>
                    <span className="text-sm">v{run.version}</span>
                    <span className="text-xs text-muted-foreground">
                      {run.trainingDataCount} samples
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(run.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
