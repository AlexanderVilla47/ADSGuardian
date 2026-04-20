// Operations Hooks - React Query hooks for operations management

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  runNow, 
  getOperationsHistory,
  getAlertsHistory,
  pauseAd,
  getOperationStatus,
  getRiskQueue 
} from '@/lib/api/endpoints';
import type {
  OperationsFilter,
  RunNowRequest,
  PauseAdRequest,
  OperationStatusResponse,
} from '@/types/api';

// ============================================
// Query Keys
// ============================================

export const operationKeys = {
  all: ['operations'] as const,
  history: () => [...operationKeys.all, 'history'] as const,
  historyList: (filters: OperationsFilter) => [...operationKeys.history(), filters] as const,
  alertsHistory: () => [...operationKeys.all, 'alerts-history'] as const,
  alertsHistoryList: (filters: OperationsFilter) => [...operationKeys.alertsHistory(), filters] as const,
  status: (trackingId: string) => [...operationKeys.all, 'status', trackingId] as const,
  riskQueue: () => [...operationKeys.all, 'risk-queue'] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Trigger manual execution (run now)
 */
export function useRunNow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: RunNowRequest) => runNow(data),
    onSuccess: () => {
      // Invalidate operations history
      queryClient.invalidateQueries({ queryKey: operationKeys.history() });
      // Invalidate risk queue
      queryClient.invalidateQueries({ queryKey: operationKeys.riskQueue() });
    },
  });
}

/**
 * Get operations history
 */
export function useHistory(filters: OperationsFilter = {}) {
  return useQuery({
    queryKey: operationKeys.historyList(filters),
    queryFn: () => getOperationsHistory(filters),
  });
}

/**
 * Get alerts history
 */
export function useAlertsHistory(filters: OperationsFilter = {}) {
  return useQuery({
    queryKey: operationKeys.alertsHistoryList(filters),
    queryFn: () => getAlertsHistory(filters),
  });
}

/**
 * Pause an individual ad
 */
export function usePauseAd() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ adId, data }: { adId: string; data: PauseAdRequest }) => 
      pauseAd(adId, data),
    onSuccess: () => {
      // Invalidate risk queue
      queryClient.invalidateQueries({ queryKey: operationKeys.riskQueue() });
      // Invalidate contracts
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useOperationStatus(trackingId: string | null, correlationId?: string, enabled = true) {
  return useQuery({
    queryKey: [...operationKeys.status(trackingId ?? 'pending'), correlationId ?? 'no-correlation'],
    queryFn: () => getOperationStatus(String(trackingId), correlationId),
    enabled: Boolean(trackingId) && enabled,
    refetchInterval: (query) => {
      const status = (query.state.data?.data as OperationStatusResponse | undefined)?.status;
      if (!status) return 1500;
      return status === 'queued' || status === 'processing' ? 1500 : false;
    },
    staleTime: 0,
  });
}

/**
 * Get risk queue for dashboard
 */
export function useRiskQueue() {
  return useQuery({
    queryKey: operationKeys.riskQueue(),
    queryFn: () => getRiskQueue(),
  });
}
