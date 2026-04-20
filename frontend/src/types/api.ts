// API Types for AdsKiller Frontend MVP
// Based on API-CONTRACT-MVP.md

// ============================================
// Envelope Types
// ============================================

export interface ApiMeta {
  correlation_id: string;
  execution_id?: string;
  timestamp: string;
  source?: 'f1' | 'f2' | 'f3' | 'api' | 'mock';
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
  meta: ApiMeta;
}

export interface PaginatedResponse<T> {
  total: number;
  total_active?: number;
  items: T[];
  page?: number;
  page_size?: number;
}

// ============================================
// Contract Types
// ============================================

export type ContractStatus = 'Activo' | 'Finalizado';
export type NotificationChannel = 'slack' | 'telegram' | 'both';

export interface Contract {
  contract_id: string;
  influencer_name: string;
  ad_match_pattern: string;
  ad_id?: string;
  ad_name?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  contract_status: ContractStatus;
  notified_preventive: boolean;
  notification_channel?: NotificationChannel;
  last_check?: string; // ISO timestamp
  created_at?: string;
  updated_at?: string;
}

export interface CreateContractRequest {
  influencer_name: string;
  end_date: string; // YYYY-MM-DD
}

export interface CreateContractResponse {
  contract_id: string;
  contract_status: ContractStatus;
}

export interface ExtendContractRequest {
  new_end_date: string; // YYYY-MM-DD, must be > current end_date
  reason?: string;
}

export interface ExtendContractResponse {
  contract_id: string;
  end_date: string;
  notified_preventive: boolean;
}

export interface FinalizeContractRequest {
  reason: string;
  requested_by: string;
}

export interface FinalizeContractResponse {
  contract_id: string;
  contract_status: ContractStatus;
}

// ============================================
// Ad Types
// ============================================

export type AdStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';

export interface Ad {
  ad_id: string;
  ad_name: string;
  ad_status: AdStatus;
  campaign_id?: string;
  campaign_name?: string;
  ad_set_id?: string;
}

export interface PauseAdRequest {
  contract_id: string;
  reason?: string;
  requested_by: string;
}

export interface PauseAdResponse {
  ad_id: string;
  accepted: boolean;
  status: 'queued' | 'processing' | 'paused' | 'already_paused' | 'failed';
  tracking_id: string;
  correlation_id: string;
  target: {
    contract_id: string;
    ad_id: string;
  };
  meta_patch: {
    method: 'PATCH';
    path: string;
    body: {
      status: 'PAUSED';
    };
    version: string;
  };
  result?: 'paused' | 'already_paused' | 'failed';
  precheck_status?: AdStatus | 'UNKNOWN';
}

export interface OperationStatusResponse {
  tracking_id: string;
  status: 'queued' | 'processing' | 'paused' | 'already_paused' | 'failed' | 'not_found';
  not_found?: boolean;
  correlation_id?: string;
  contract_id?: string;
  ad_id?: string;
  result?: {
    precheck_status?: AdStatus | 'UNKNOWN';
    meta_http_status?: number;
    pause_attempt?: number;
    pause_max_attempts?: number;
    error?: string;
    updated_at?: string;
  };
  timestamps?: {
    requested_at?: string;
    updated_at?: string;
  };
  transitions?: Array<{
    status: string;
    at: string;
    source?: string;
    meta_http_status?: number;
    attempt?: number;
  }>;
}

export interface BatchPauseRequest {
  contract_id: string;
  dry_run: boolean;
  max_batch_size?: number;
  confirm_token?: string;
  requested_by: string;
}

export interface BatchPauseResponse {
  dry_run: boolean;
  confirm_token: string;
  max_batch_size: number;
  total_candidates: number;
  would_pause: number;
  next_step: string;
}

// ============================================
// Influencer Types
// ============================================

export interface InfluencerSearchResult {
  name: string;
  channel: string;
  score: number;
}

export interface InfluencerSearchResponse {
  action: 'influencers_search';
  query: string;
  limit: number;
  total: number;
  items: InfluencerSearchResult[];
}

// ============================================
// Operation Types
// ============================================

export type RunMode = 'manual' | 'scheduled';
export type ExecutionResult = 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED' | 'NOT_EXERCISED';
export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface Operation {
  execution_id: string;
  correlation_id: string;
  run_mode: RunMode;
  result: ExecutionResult;
  contracts_evaluated: number;
  ads_paused: number;
  expired_found: number;
  errors: number;
  executed_at: string; // ISO timestamp
}

export interface RunNowRequest {
  run_mode: RunMode;
  requested_by: string;
}

export interface RunNowResponse {
  accepted: boolean;
  tracking_id: string;
}

export interface AlertHistoryItem {
  alert_id: string;
  severity: AlertSeverity | string;
  message: string;
  status: string;
  created_at: string; // ISO timestamp
  contract_id?: string;
  ad_id?: string;
  correlation_id?: string;
  execution_id?: string;
}

// ============================================
// Risk Queue Types (Dashboard)
// ============================================

export type RiskSeverity = 'critical' | 'warn' | 'info';

export interface RiskQueueItem {
  contract_id: string;
  influencer_name: string;
  end_date: string;
  contract_status: ContractStatus;
  severity: RiskSeverity;
  ad_id?: string;
  ad_status?: AdStatus;
}

// ============================================
// Filter Types
// ============================================

export interface ContractsFilter {
  days_ahead?: number;
  contract_id?: string;
  influencer_name?: string;
  status?: ContractStatus;
  page?: number;
  page_size?: number;
}

export interface OperationsFilter {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  result?: ExecutionResult;
  run_mode?: RunMode;
  execution_id?: string;
  page?: number;
  page_size?: number;
}

export interface InfluencerSearchParams {
  q: string;
  limit?: number;
}
