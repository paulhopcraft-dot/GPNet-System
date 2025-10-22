import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface MLAlert {
  type: 'escalation' | 'compliance' | 'priority' | 'fraud';
  severity: 'high' | 'medium' | 'low';
  message: string;
  probability?: number;
}

interface MLPrediction {
  ticketId: string;
  alerts: MLAlert[];
  generated_at: string;
  error?: string;
}

interface MLPredictionsContextValue {
  predictions: Map<string, MLPrediction>;
  isLoading: boolean;
}

const MLPredictionsContext = createContext<MLPredictionsContextValue>({
  predictions: new Map(),
  isLoading: false,
});

export function useMLPredictions(ticketId?: string) {
  const context = useContext(MLPredictionsContext);
  if (!ticketId) {
    return { data: null, isLoading: context.isLoading };
  }
  return {
    data: context.predictions.get(ticketId),
    isLoading: context.isLoading,
  };
}

interface MLPredictionsProviderProps {
  children: ReactNode;
  ticketIds: string[];
}

export function MLPredictionsProvider({ children, ticketIds }: MLPredictionsProviderProps) {
  const { data, isLoading } = useQuery<{ predictions: MLPrediction[] }>({
    queryKey: ['/api/ml/predictions/batch', ticketIds.sort().join(',')],
    queryFn: async () => {
      if (ticketIds.length === 0) {
        return { predictions: [] };
      }
      const response = await apiRequest('POST', '/api/ml/predictions/batch', { ticketIds });
      return response as { predictions: MLPrediction[] };
    },
    enabled: ticketIds.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false,
  });

  const predictions = new Map<string, MLPrediction>();
  if (data?.predictions) {
    data.predictions.forEach((pred: MLPrediction) => {
      predictions.set(pred.ticketId, pred);
    });
  }

  return (
    <MLPredictionsContext.Provider value={{ predictions, isLoading }}>
      {children}
    </MLPredictionsContext.Provider>
  );
}
