// Contracts Hooks - React Query hooks for contract management

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContract,
  getContracts,
  extendContract,
  finalizeContract,
  getAdsByContract,
} from '@/lib/api/endpoints';
import type {
  ContractsFilter,
  CreateContractRequest,
  ExtendContractRequest,
  FinalizeContractRequest,
} from '@/types/api';

// searchInfluencers removed — search is now done via searchContracts (action=search)

// ============================================
// Query Keys
// ============================================

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (filters: ContractsFilter) => [...contractKeys.lists(), filters] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (contractId: string) => [...contractKeys.details(), contractId] as const,
  ads: (contractId: string) => [...contractKeys.all, 'ads', contractId] as const,
};

// ============================================
// Hooks
// ============================================

/**
 * Get contracts with optional filters
 */
export function useContracts(filters: ContractsFilter = {}) {
  return useQuery({
    queryKey: contractKeys.list(filters),
    queryFn: () => getContracts(filters),
  });
}

/**
 * Create a new contract
 */
export function useCreateContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateContractRequest) => createContract(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Extend a contract
 */
export function useExtendContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: string; data: ExtendContractRequest }) =>
      extendContract(contractId, data),
    onSuccess: (_data, variables) => {
      // Invalidate the specific contract
      queryClient.invalidateQueries({ 
        queryKey: contractKeys.detail(variables.contractId) 
      });
      // Invalidate contracts list
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Finalize a contract (manual close)
 */
export function useFinalizeContract() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ contractId, data }: { contractId: string; data: FinalizeContractRequest }) =>
      finalizeContract(contractId, data),
    onSuccess: (_data, variables) => {
      // Invalidate the specific contract
      queryClient.invalidateQueries({ 
        queryKey: contractKeys.detail(variables.contractId) 
      });
      // Invalidate contracts list
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
  });
}

/**
 * Get ads by contract
 */
export function useAdsByContract(contractId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: contractKeys.ads(contractId),
    queryFn: () => getAdsByContract(contractId),
    enabled,
  });
}

