/**
 * API Client for AdsKiller Frontend
 *
 * Todos los endpoints llaman al mismo webhook n8n con un campo `action`.
 * El proxy de vite mapea /n8n → http://168.138.125.21:5678
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  ApiResponse,
  Contract,
  CreateContractRequest,
  CreateContractResponse,
  ExtendContractRequest,
  ExtendContractResponse,
  FinalizeContractRequest,
  FinalizeContractResponse,
  Ad,
  PauseAdRequest,
  PauseAdResponse,
  OperationStatusResponse,
  Operation,
  AlertHistoryItem,
  RunNowRequest,
  RunNowResponse,
  ContractsFilter,
  OperationsFilter,
  PaginatedResponse,
  RiskQueueItem,
} from '@/types/api';

// ─── Config ───────────────────────────────────────────────────────────────────

const WEBHOOK = '/n8n/webhook/contract-ui-management-v2';

function generateCorrelationId(): string {
  return `ak-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Axios instance ───────────────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.headers['X-Correlation-ID'] = generateCorrelationId();
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      console.error(`API Error [${error.response.status}]`, error.response.data);
    } else {
      console.error('Network error', error.message);
    }
    return Promise.reject(error);
  }
);

// ─── Core n8n caller ─────────────────────────────────────────────────────────

async function n8n<T>(body: Record<string, unknown>): Promise<T> {
  const response = await apiClient.post(WEBHOOK, body);
  return response.data as T;
}

// ─── GS → Frontend field mapping ─────────────────────────────────────────────
// GS columns: Contrato_ID, Cliente, Regex_Anuncio, Fecha_Alta, Fecha_Fin,
//             Status_Contrato, Notificado_Previo, Ad_ID, Ad_Name, Updated_At

function mapGsToContract(row: Record<string, unknown>): Contract {
  return {
    contract_id:         String(row.Contrato_ID ?? ''),
    influencer_name:     String(row.Cliente ?? ''),
    ad_match_pattern:    String(row.Regex_Anuncio ?? ''),
    ad_id:               String(row.Ad_ID ?? '') || undefined,
    ad_name:             String(row.Ad_Name ?? '') || undefined,
    start_date:          String(row.Fecha_Alta ?? ''),
    end_date:            String(row.Fecha_Fin ?? ''),
    contract_status:     (String(row.Status_Contrato ?? 'Activo') as 'Activo' | 'Finalizado'),
    notified_preventive: row.Notificado_Previo === true || String(row.Notificado_Previo).toLowerCase() === 'true',
    last_check:          String(row.Updated_At ?? '') || undefined,
  };
}

// ─── Contract endpoints ───────────────────────────────────────────────────────

/**
 * Crear contrato — solo necesita influencer_name y end_date.
 * F1 auto-genera Contrato_ID y Regex_Anuncio.
 */
export async function createContract(
  data: CreateContractRequest
): Promise<ApiResponse<CreateContractResponse>> {
  const raw = await n8n<{ ok: boolean; data: Record<string, unknown> }>({
    action: 'alta',
    influencer_name: data.influencer_name,
    end_date: data.end_date,
  });
  return {
    ok: raw.ok,
    data: {
      contract_id:     String(raw.data?.Contrato_ID ?? ''),
      contract_status: 'Activo',
    },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

/**
 * Listar contratos.
 * Sin filtros: devuelve todos (show_all=true).
 * Con days_ahead: devuelve los que vencen en N días (para Dashboard risk queue).
 */
export async function getContracts(
  filter: ContractsFilter = {}
): Promise<ApiResponse<PaginatedResponse<Contract>>> {
  let raw: { ok: boolean; total: number; data: Record<string, unknown>[] };

  if (filter.days_ahead !== undefined) {
    raw = await n8n({ action: 'consulta', dias_proximos: filter.days_ahead });
  } else {
    raw = await n8n({ action: 'consulta', show_all: true });
  }

  let items = (raw.data ?? []).map(mapGsToContract);

  // Filtros client-side adicionales
  if (filter.status) {
    items = items.filter(c => c.contract_status === filter.status);
  }
  if (filter.contract_id) {
    items = items.filter(c =>
      c.contract_id.toLowerCase().includes(filter.contract_id!.toLowerCase())
    );
  }
  if (filter.influencer_name) {
    items = items.filter(c =>
      c.influencer_name.toLowerCase().includes(filter.influencer_name!.toLowerCase())
    );
  }

  // Ordenamiento: Activos primero, luego por fecha fin ascendente
  items.sort((a, b) => {
    const statusOrder = (s: string) => s === 'Activo' ? 0 : 1;
    const statusDiff = statusOrder(a.contract_status) - statusOrder(b.contract_status);
    if (statusDiff !== 0) return statusDiff;
    return a.end_date.localeCompare(b.end_date);
  });

  // Totales antes de paginar (para KPIs)
  const total_active = items.filter(c => c.contract_status === 'Activo').length;
  const total        = items.length;

  // Paginación client-side
  const page     = filter.page ?? 1;
  const pageSize = filter.page_size ?? 25;
  const sliced   = items.slice((page - 1) * pageSize, page * pageSize);

  return {
    ok: true,
    data: { total, total_active, items: sliced, page, page_size: pageSize },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

/**
 * Extender contrato — nueva fecha fin.
 */
export async function extendContract(
  contractId: string,
  data: ExtendContractRequest
): Promise<ApiResponse<ExtendContractResponse>> {
  const raw = await n8n<{ ok: boolean; data?: Record<string, unknown> }>({
    action: 'extension',
    contract_id: contractId,
    new_end_date: data.new_end_date,
    reason: data.reason,
  });
  return {
    ok: raw.ok,
    data: {
      contract_id:            contractId,
      end_date:               data.new_end_date,
      notified_preventive:    false,
    },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

/**
 * Finalizar contrato manualmente.
 * F1 marca como Finalizado y (en prod) pausa los ads asociados.
 */
export async function finalizeContract(
  contractId: string,
  data: FinalizeContractRequest
): Promise<ApiResponse<FinalizeContractResponse>> {
  const raw = await n8n<{ ok: boolean; data?: Record<string, unknown> }>({
    action: 'baja_manual',
    contract_id: contractId,
    motivo: data.reason,
    requested_by: data.requested_by,
  });
  return {
    ok: raw.ok,
    data: { contract_id: contractId, contract_status: 'Finalizado' },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

// ─── Ads endpoints ────────────────────────────────────────────────────────────

/**
 * Listar ads asociados a un contrato (live desde Meta API).
 */
export async function getAdsByContract(
  contractId: string
): Promise<ApiResponse<{ items: Ad[] }>> {
  const raw = await n8n<{ ok: boolean; data?: { ads?: Ad[] } }>({
    action: 'listar_ads',
    contract_id: contractId,
  });
  return {
    ok: raw.ok,
    data: { items: raw.data?.ads ?? [] },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

/**
 * Pausar un ad individual.
 */
export async function pauseAd(
  adId: string,
  data: PauseAdRequest
): Promise<ApiResponse<PauseAdResponse>> {
  const raw = await n8n<{ ok: boolean; data?: Record<string, unknown>; meta?: Record<string, unknown> }>({
    action: 'pause_ad',
    contract_id: data.contract_id,
    ad_id: adId,
    reason: data.reason,
    requested_by: data.requested_by,
  });

  const payload = raw.data ?? {};
  const statusRaw = String(payload.status ?? '').toLowerCase();
  const status: PauseAdResponse['status'] =
    statusRaw === 'paused' || statusRaw === 'already_paused' || statusRaw === 'failed' || statusRaw === 'processing'
      ? statusRaw
      : 'queued';

  const tracking_id = String(payload.tracking_id ?? `trk-${Date.now()}`);
  const correlation_id = String(payload.correlation_id ?? raw.meta?.correlation_id ?? generateCorrelationId());

  return {
    ok: raw.ok,
    data: {
      ad_id: adId,
      accepted: Boolean(payload.accepted ?? raw.ok),
      status,
      tracking_id,
      correlation_id,
      target: {
        contract_id: String(payload.target && typeof payload.target === 'object' ? (payload.target as Record<string, unknown>).contract_id ?? data.contract_id : data.contract_id),
        ad_id: String(payload.target && typeof payload.target === 'object' ? (payload.target as Record<string, unknown>).ad_id ?? adId : adId),
      },
      meta_patch: {
        method: 'PATCH',
        path: String(payload.meta_patch && typeof payload.meta_patch === 'object' ? (payload.meta_patch as Record<string, unknown>).path ?? `/v23.0/${adId}` : `/v23.0/${adId}`),
        body: { status: 'PAUSED' },
        version: String(payload.meta_patch && typeof payload.meta_patch === 'object' ? (payload.meta_patch as Record<string, unknown>).version ?? 'v1' : 'v1'),
      },
      result: status === 'paused' || status === 'already_paused' || status === 'failed' ? status : undefined,
      precheck_status: 'UNKNOWN',
    },
    meta: { correlation_id, timestamp: new Date().toISOString(), source: 'f1' },
  };
}

export async function getOperationStatus(
  trackingId: string,
  correlationId?: string
): Promise<ApiResponse<OperationStatusResponse>> {
  const raw = await n8n<{ ok: boolean; data?: Record<string, unknown>; meta?: Record<string, unknown> }>({
    action: 'status_by_tracking',
    tracking_id: trackingId,
    correlation_id: correlationId,
  });

  const payload = raw.data ?? {};
  const resultRaw = String(payload.status ?? '').toLowerCase();
  const status: OperationStatusResponse['status'] =
    resultRaw === 'paused' || resultRaw === 'already_paused' || resultRaw === 'failed'
      ? resultRaw
      : resultRaw === 'queued' || resultRaw === 'processing'
        ? resultRaw
        : Boolean(payload.not_found)
          ? 'not_found'
          : (correlationId ? 'queued' : 'not_found');

  const payloadResult = payload.result && typeof payload.result === 'object'
    ? payload.result as Record<string, unknown>
    : null;

  const payloadTimestamps = payload.timestamps && typeof payload.timestamps === 'object'
    ? payload.timestamps as Record<string, unknown>
    : null;

  const payloadTransitions = Array.isArray(payload.transitions)
    ? payload.transitions.map((entry) => {
        const row = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {};
        return {
          status: String(row.status ?? 'unknown'),
          at: String(row.at ?? ''),
          source: String(row.source ?? ''),
          meta_http_status: Number(row.meta_http_status ?? 0) || undefined,
          attempt: Number(row.attempt ?? 0) || undefined,
        };
      })
    : undefined;

  return {
    ok: raw.ok,
    data: {
      tracking_id: trackingId,
      status,
      not_found: Boolean(payload.not_found) || status === 'not_found',
      correlation_id: String(payload.correlation_id ?? correlationId ?? raw.meta?.correlation_id ?? ''),
      contract_id: String(payload.contract_id ?? payload.Contrato_ID ?? ''),
      ad_id: String(payload.ad_id ?? payload.Ad_ID ?? ''),
      result: payloadResult
        ? {
            precheck_status: String(payloadResult.precheck_status ?? 'UNKNOWN') as NonNullable<OperationStatusResponse['result']>['precheck_status'],
            meta_http_status: Number(payloadResult.meta_http_status ?? 0) || undefined,
            error: String(payloadResult.reason ?? payloadResult.error ?? ''),
            updated_at: String(payloadTimestamps?.updated_at ?? payload.last_update_at ?? ''),
          }
        : undefined,
      timestamps: payloadTimestamps
        ? {
            requested_at: String(payloadTimestamps.requested_at ?? ''),
            updated_at: String(payloadTimestamps.updated_at ?? ''),
          }
        : undefined,
      transitions: payloadTransitions,
    },
    meta: {
      correlation_id: String(raw.meta?.correlation_id ?? generateCorrelationId()),
      timestamp: new Date().toISOString(),
      source: 'f1',
    },
  };
}

// ─── Operations endpoints ─────────────────────────────────────────────────────

/**
 * Disparar ejecución manual del kill-switch.
 */
export async function runNow(
  data: RunNowRequest
): Promise<ApiResponse<RunNowResponse>> {
  const raw = await n8n<{ ok: boolean; data?: { tracking_id?: string } }>({
    action: 'run_now',
    run_mode: data.run_mode,
    requested_by: data.requested_by,
  });
  return {
    ok: raw.ok,
    data: {
      accepted:    raw.ok,
      tracking_id: raw.data?.tracking_id ?? `run-${Date.now()}`,
    },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

/**
 * Historial de operaciones del kill-switch.
 */
export async function getOperationsHistory(
  filter: OperationsFilter = {}
): Promise<ApiResponse<PaginatedResponse<Operation>>> {
  const raw = await n8n<{
    ok: boolean;
    data: { total: number; page: number; page_size: number; items: Record<string, unknown>[] };
  }>({
    action: 'history',
    page:      filter.page ?? 1,
    page_size: filter.page_size ?? 25,
  });

  // Historial actual combina filas de resumen y filas por tracking; normalizamos para UI.
  // Mostramos run_now (ejecucion operativa) y killswitch.execution.summary (resumen F2/F3 legacy).
  const relevantRows = (raw.data?.items ?? []).filter(row => {
    const action = String(row.action ?? '');
    return action === 'run_now' || action === 'killswitch.execution.summary';
  });

  let items: Operation[] = relevantRows.map(row => {
    const resultRaw = String(row.result ?? '').trim().toUpperCase();
    const result: Operation['result'] =
      resultRaw === 'SUCCESS' || resultRaw === 'ACCEPTED' || resultRaw === 'PAUSED' || resultRaw === 'ALREADY_PAUSED' ? 'SUCCESS' :
      resultRaw === 'PARTIAL_FAILURE' || resultRaw === 'PARTIAL' ? 'PARTIAL_FAILURE' :
      resultRaw === 'FAILED' || resultRaw === 'ERROR' ? 'FAILED' :
      'NOT_EXERCISED';

    const runModeRaw = String(row.run_mode ?? '').toLowerCase();
    const run_mode: Operation['run_mode'] = runModeRaw === 'manual' ? 'manual' : 'scheduled';
    const contractId = String(row.contract_id ?? row.Contrato_ID ?? '');
    const hasContract = contractId.trim().length > 0;
    const executedAt = String(
      row.executed_at ??
      (row.timestamps && typeof row.timestamps === 'object' ? (row.timestamps as Record<string, unknown>).executed_at : '') ??
      ''
    );

    const contractsEvaluated = Number(row.contracts_evaluated ?? row.contratos_evaluados ?? (hasContract ? 1 : 0));
    const adsPaused = Number(row.ads_paused ?? (result === 'SUCCESS' && hasContract ? 1 : 0));
    const expiredFound = Number(row.expired_found ?? row.expired_unpaused_count ?? (hasContract ? 1 : 0));
    const errors = Number(row.errors ?? (result === 'FAILED' ? 1 : 0));

    return {
      execution_id:        String(row.execution_id ?? ''),
      correlation_id:      String(row.correlation_id ?? ''),
      run_mode,
      result,
      contracts_evaluated: Number.isFinite(contractsEvaluated) ? contractsEvaluated : 0,
      ads_paused:          Number.isFinite(adsPaused) ? adsPaused : 0,
      expired_found:       Number.isFinite(expiredFound) ? expiredFound : 0,
      errors:              Number.isFinite(errors) ? errors : 0,
      executed_at:         executedAt,
    };
  });

  // Filtros client-side
  if (filter.result)   items = items.filter(o => o.result === filter.result);
  if (filter.run_mode) items = items.filter(o => o.run_mode === filter.run_mode);

  const total = raw.data?.total ?? items.length;
  return {
    ok: true,
    data: { total, items, page: filter.page ?? 1, page_size: filter.page_size ?? 25 },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

/**
 * Historial de alertas operativas (hoja Alertas).
 */
export async function getAlertsHistory(
  filter: OperationsFilter = {}
): Promise<ApiResponse<PaginatedResponse<AlertHistoryItem>>> {
  const raw = await n8n<{
    ok: boolean;
    data: { total: number; page: number; page_size: number; items: Record<string, unknown>[] };
  }>({
    action: 'history_alerts',
    page: filter.page ?? 1,
    page_size: filter.page_size ?? 25,
    from: filter.from,
    to: filter.to,
  });

  const items: AlertHistoryItem[] = (raw.data?.items ?? []).map((row) => ({
    alert_id: String(row.alert_id ?? row.Alerta_ID ?? ''),
    severity: String(row.severity ?? row.Severidad ?? '').toUpperCase(),
    message: String(row.message ?? row.Motivo ?? ''),
    status: String(row.status ?? row.Estado ?? ''),
    created_at: String(row.created_at ?? row.Creada_At ?? ''),
    contract_id: String(row.contract_id ?? row.Contrato_ID ?? '') || undefined,
    ad_id: String(row.ad_id ?? row.Ad_ID ?? '') || undefined,
    correlation_id: String(row.correlation_id ?? row.Correlation_ID ?? '') || undefined,
    execution_id: String(row.execution_id ?? '') || undefined,
  }));

  return {
    ok: raw.ok,
    data: {
      total: raw.data?.total ?? items.length,
      items,
      page: raw.data?.page ?? (filter.page ?? 1),
      page_size: raw.data?.page_size ?? (filter.page_size ?? 25),
    },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

// ─── Risk Queue (Dashboard) ───────────────────────────────────────────────────

/**
 * Cola de riesgos: contratos que vencen en los próximos 2 días (para el Dashboard).
 */
export async function getRiskQueue(): Promise<ApiResponse<{ items: RiskQueueItem[] }>> {
  const raw = await n8n<{ ok: boolean; total: number; data: Record<string, unknown>[] }>({
    action: 'consulta',
    dias_proximos: 2,
  });

  const parseYmdToUtcMs = (ymd: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim());
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  const todayBa = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const todayMs = parseYmdToUtcMs(todayBa);

  const items: RiskQueueItem[] = (raw.data ?? []).map(row => {
    const contract   = mapGsToContract(row);
    const endMs = parseYmdToUtcMs(contract.end_date);
    const daysLeft = (todayMs === null || endMs === null) ? 999 : Math.round((endMs - todayMs) / 86400000);
    const severity: RiskQueueItem['severity'] = daysLeft < 0 ? 'critical' : daysLeft <= 1 ? 'warn' : 'info';

    return {
      contract_id:     contract.contract_id,
      influencer_name: contract.influencer_name,
      end_date:        contract.end_date,
      contract_status: contract.contract_status,
      severity,
      ad_id:           contract.ad_id,
      ad_status:       undefined,
    };
  });

  return {
    ok: true,
    data: { items },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Buscar contratos por nombre de influencer (regex en backend, case-insensitive).
 */
export async function searchContracts(q: string): Promise<ApiResponse<{ items: Contract[]; total: number }>> {
  const raw = await n8n<{ ok: boolean; total: number; data: Record<string, unknown>[] }>({
    action: 'search',
    q,
  });
  const items = (raw.data ?? []).map(mapGsToContract);
  return {
    ok: raw.ok,
    data: { items, total: raw.total ?? items.length },
    meta: { correlation_id: generateCorrelationId(), timestamp: new Date().toISOString(), source: 'f1' },
  };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export { apiClient };
