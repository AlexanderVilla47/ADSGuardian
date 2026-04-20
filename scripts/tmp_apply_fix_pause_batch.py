import copy
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]


def update_f1() -> None:
    f1_path = ROOT / "workflows" / "contract-ui-management-v2.json"
    f1 = json.loads(f1_path.read_text(encoding="utf-8"))
    nodes = {n["name"]: n for n in f1["nodes"]}

    validate_code = """const input = $json;
const allowedActions = new Set(['alta','search', 'influencers_search', 'consulta', 'extension', 'baja_manual', 'listar_ads', 'run_now', 'history', 'pause_ad', 'pause_active', 'status_by_tracking']);

function isValidDateFormat(value) {
  if (typeof value !== 'string') return false;
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === (m - 1) && dt.getUTCDate() === d;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'si', 'yes', 'y'].includes(normalized);
}

function normalizeB64(value) {
  const raw = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  const padding = raw.length % 4;
  return padding ? raw + '='.repeat(4 - padding) : raw;
}

function badRequest(message, details = {}) {
  const err = new Error(message);
  err.name = 'ValidationError';
  err.details = details;
  throw err;
}

if (!allowedActions.has(input.action)) {
  badRequest('`action` invalida. Usar: alta | search | influencers_search | consulta | extension | baja_manual | listar_ads | run_now | history | pause_ad | pause_active | status_by_tracking', { action: input.action });
}

input.actor = String(input.requested_by ?? input.actor ?? 'ops@adskiller').trim();
input.correlation_id = String(input.correlation_id ?? `ak-ui-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

if (input.action === 'alta') {
  const required = ['Contrato_ID', 'Cliente', 'Regex_Anuncio', 'Fecha_Fin'];
  const missing = required.filter((f) => !String(input[f] ?? '').trim());
  if (missing.length) badRequest('Faltan campos obligatorios para alta', { missing });
  if (!isValidDateFormat(input.Fecha_Fin)) badRequest('Fecha_Fin invalida. Formato requerido: YYYY-MM-DD');
}

if (input.action === 'extension') {
  const required = ['Contrato_ID', 'Nueva_Fecha_Fin'];
  const missing = required.filter((f) => !String(input[f] ?? '').trim());
  if (missing.length) badRequest('Faltan campos obligatorios para extension', { missing });
  if (!isValidDateFormat(input.Nueva_Fecha_Fin)) badRequest('Nueva_Fecha_Fin invalida. Formato requerido: YYYY-MM-DD');
}

if (input.action === 'search') {
  if (!String(input.q ?? '').trim()) badRequest('q es obligatorio para search');
  input.q = String(input.q).trim();
}

if (input.action === 'consulta') {
  const dias = Number(input.dias_proximos ?? 7);
  if (!Number.isInteger(dias) || dias < 1 || dias > 60) badRequest('dias_proximos invalido. Debe ser entero entre 1 y 60');
  input.dias_proximos = dias;
}

if (input.action === 'baja_manual' || input.action === 'listar_ads' || input.action === 'pause_ad' || input.action === 'pause_active') {
  if (!String(input.Contrato_ID ?? '').trim()) badRequest('Contrato_ID es obligatorio para esta accion');
}

if (input.action === 'pause_ad' && !String(input.Ad_ID ?? '').trim()) {
  badRequest('Ad_ID es obligatorio para pause_ad');
}

if (input.action === 'status_by_tracking') {
  const trackingId = String(input.tracking_id ?? '').trim();
  if (!trackingId) badRequest('tracking_id es obligatorio para status_by_tracking');
  input.tracking_id = trackingId;
}

if (input.action === 'pause_active') {
  const dryRun = toBool(input.dry_run, true);
  const maxBatchSize = Number(input.max_batch_size ?? input.batch_limit ?? 20);
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 100) {
    badRequest('max_batch_size invalido. Debe ser entero entre 1 y 100');
  }

  input.dry_run = dryRun;
  input.max_batch_size = maxBatchSize;
  input.batch_limit = maxBatchSize;

  if (dryRun) {
    input.action = 'pause_active_preview';
  } else {
    const confirmToken = String(input.confirm_token ?? '').trim();
    if (!confirmToken) {
      badRequest('confirm_token es obligatorio cuando dry_run=false');
    }

    try {
      const decoded = JSON.parse(Buffer.from(normalizeB64(confirmToken), 'base64').toString('utf8'));
      const tokenContractId = String(decoded.contract_id ?? '').trim();
      const tokenBatchSize = Number(decoded.max_batch_size ?? 0);
      const expiresAt = Number(decoded.expires_at_epoch_ms ?? 0);

      if (!tokenContractId || tokenContractId !== String(input.Contrato_ID).trim()) {
        badRequest('confirm_token no corresponde al Contrato_ID enviado');
      }
      if (!Number.isInteger(tokenBatchSize) || tokenBatchSize !== maxBatchSize) {
        badRequest('confirm_token no corresponde al max_batch_size enviado');
      }
      if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
        badRequest('confirm_token vencido');
      }
    } catch (err) {
      badRequest('confirm_token invalido', { reason: String(err?.message ?? err) });
    }

    input.confirm_token = confirmToken;
    input.confirm = true;
  }
}

if (input.action === 'history') {
  const page = Number(input.page ?? 1);
  const pageSize = Number(input.page_size ?? 25);
  if (!Number.isInteger(page) || page < 1) badRequest('page invalido. Minimo 1');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) badRequest('page_size invalido. Debe ser 1..100');
  input.page = page;
  input.page_size = pageSize;
}

return [{ json: input }];"""

    nodes["Validate Input"]["parameters"]["jsCode"] = validate_code

    route_values = nodes["Route Action"]["parameters"]["rules"]["values"]
    exists_status = False
    for v in route_values:
        c = v.get("conditions", {})
        nested = c.get("conditions") or []
        right = nested[0].get("rightValue") if nested else c.get("value2")
        if right == "status_by_tracking":
            exists_status = True
            break
    if not exists_status:
        route_values.append(
            {
                "conditions": {
                    "options": {"caseSensitive": False, "leftValue": "", "typeValidation": "strict"},
                    "conditions": [
                        {
                            "leftValue": "={{ $json.action }}",
                            "rightValue": "status_by_tracking",
                            "operator": {"type": "string", "operation": "equals"},
                        }
                    ],
                    "combinator": "and",
                }
            }
        )

    node_names = {n["name"] for n in f1["nodes"]}
    if "GS Read Operation By Tracking" not in node_names:
        gs = copy.deepcopy(nodes["GS Read Operations History"])
        gs["id"] = "a2-read-status-tracking"
        gs["name"] = "GS Read Operation By Tracking"
        gs["position"] = [-304, 1440]
        f1["nodes"].append(gs)

    if "Build Status By Tracking" not in node_names:
        f1["nodes"].append(
            {
                "parameters": {
                    "jsCode": "const req = $items('Validate Input', 0, 0)[0].json;\nconst trackingId = String(req.tracking_id ?? '').trim();\n\nconst rows = items\n  .map((i) => i.json || {})\n  .filter((row) => String(row.tracking_id ?? '').trim() === trackingId);\n\nif (!rows.length) {\n  return [{\n    json: {\n      tracking_id: trackingId,\n      status: 'not_found',\n      result: null,\n      transitions: [],\n      last_update_at: null\n    }\n  }];\n}\n\nrows.sort((a, b) => String(a.updated_at ?? a.requested_at ?? a.timestamp ?? a.executed_at ?? '').localeCompare(String(b.updated_at ?? b.requested_at ?? b.timestamp ?? b.executed_at ?? '')));\nconst latest = rows[rows.length - 1];\nconst rawStatus = String(latest.final_status ?? latest.status ?? latest.result ?? '').trim().toLowerCase();\nconst normalizedStatus = (() => {\n  if (['paused', 'failed', 'already_paused', 'not_found'].includes(rawStatus)) return rawStatus;\n  if (['accepted', 'queued', 'pending'].includes(rawStatus)) return 'queued';\n  if (['processing', 'running', 'in_progress', 'dispatched'].includes(rawStatus)) return 'processing';\n  return rawStatus || 'processing';\n})();\n\nconst transitions = rows.map((row) => ({\n  status: String(row.final_status ?? row.status ?? row.result ?? '').trim().toLowerCase() || 'unknown',\n  at: String(row.updated_at ?? row.requested_at ?? row.timestamp ?? row.executed_at ?? ''),\n  source: String(row.source_workflow ?? row.source ?? '')\n}));\n\nreturn [{\n  json: {\n    tracking_id: trackingId,\n    correlation_id: String(latest.correlation_id ?? ''),\n    contract_id: String(latest.Contrato_ID ?? latest.contract_id ?? ''),\n    ad_id: String(latest.Ad_ID ?? latest.ad_id ?? ''),\n    status: normalizedStatus,\n    result: {\n      precheck_status: String(latest.precheck_status ?? latest.ad_status_meta ?? 'UNKNOWN'),\n      meta_http_status: Number(latest.meta_http_status ?? latest.pause_status_code ?? latest.precheck_status_code ?? 0) || null,\n      pause_attempt: Number(latest.pause_attempt ?? 0) || 0,\n      pause_max_attempts: Number(latest.pause_max_attempts ?? 0) || 0,\n      reason: String(latest.pause_reason ?? latest.precheck_reason ?? '')\n    },\n    timestamps: {\n      requested_at: String(latest.requested_at ?? latest.timestamp ?? ''),\n      updated_at: String(latest.updated_at ?? latest.timestamp ?? latest.requested_at ?? '')\n    },\n    transitions\n  }\n}];"
                },
                "id": "a2-build-status-tracking",
                "name": "Build Status By Tracking",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [-80, 1440],
            }
        )

    node_names = {n["name"] for n in f1["nodes"]}
    if "Respond Status By Tracking" not in node_names:
        f1["nodes"].append(
            {
                "parameters": {
                    "respondWith": "json",
                    "responseBody": "={{ { ok: true, action: 'status_by_tracking', data: $json, meta: { correlation_id: $items('Validate Input',0,0)[0].json.correlation_id, execution_id: $execution.id, actor: $items('Validate Input',0,0)[0].json.actor, timestamp: $items('Validate Input',0,0)[0].json.request_ts } } }}",
                    "options": {"responseCode": 200},
                },
                "id": "a2-respond-status-tracking",
                "name": "Respond Status By Tracking",
                "type": "n8n-nodes-base.respondToWebhook",
                "typeVersion": 1.1,
                "position": [144, 1440],
            }
        )

    conn = f1["connections"]
    route_branches = conn["Route Action"]["main"]
    if not any(branch and branch[0].get("node") == "GS Read Operation By Tracking" for branch in route_branches):
        route_branches.append([{"node": "GS Read Operation By Tracking", "type": "main", "index": 0}])

    conn["GS Read Operation By Tracking"] = {
        "main": [[{"node": "Build Status By Tracking", "type": "main", "index": 0}]]
    }
    conn["Build Status By Tracking"] = {
        "main": [[{"node": "Respond Status By Tracking", "type": "main", "index": 0}]]
    }

    f1_path.write_text(json.dumps(f1, ensure_ascii=False, indent=2), encoding="utf-8")


def update_f2() -> None:
    f2_path = ROOT / "workflows" / "contract-guard-daily-killswitch.json"
    f2 = json.loads(f2_path.read_text(encoding="utf-8-sig"))
    nodes = {n["name"]: n for n in f2["nodes"]}

    nodes["Contexto Manual"]["parameters"]["jsCode"] = """const source = $json ?? {};
const payload = source.payload && typeof source.payload === 'object' ? source.payload : source;
const correlationId = String(source.correlation_id ?? payload.correlation_id ?? `ak-f2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const requestedAt = String(payload.requested_at ?? payload.request_ts ?? source.requested_at ?? new Date().toISOString());

return [{
  json: {
    ...source,
    ...payload,
    run_mode: 'manual',
    action: String(payload.action ?? source.action ?? 'run_now').trim().toLowerCase(),
    tracking_id: String(payload.tracking_id ?? source.tracking_id ?? ''),
    correlation_id: correlationId,
    logical_execution_id: String(source.logical_execution_id ?? payload.logical_execution_id ?? `${correlationId}:f2`),
    requested_at: requestedAt,
    request_ts: requestedAt,
    Contrato_ID: String(payload.Contrato_ID ?? source.Contrato_ID ?? ''),
    Ad_ID: String(payload.Ad_ID ?? source.Ad_ID ?? '')
  }
}];"""

    nodes["Evaluate_Clasificar_Contratos"]["parameters"]["jsCode"] = """const TZ = 'America/Argentina/Buenos_Aires';

function parseYMD(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.trim().match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function nowInTimezone(timeZone) {
  return new Date(new Date().toLocaleString('en-US', { timeZone }));
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a, b) {
  const ms = 24 * 60 * 60 * 1000;
  return Math.floor((b.getTime() - a.getTime()) / ms);
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v !== 'string') return false;
  return ['true', '1', 'si', 's?', 'yes', 'y', 'x'].includes(v.trim().toLowerCase());
}

function buildRegex(pattern, fallbackName) {
  if (pattern && typeof pattern === 'string') {
    try {
      return new RegExp(pattern, 'i');
    } catch (_) {}
  }

  const safe = String(fallbackName || '')
    .trim()
    .replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')
    .replace(/\\s+/g, '.*');

  return safe ? new RegExp(safe, 'i') : null;
}

const context = $input.first()?.json ?? {};
const today = startOfDay(nowInTimezone(TZ));
const runMode = String(context.run_mode ?? 'scheduled').toLowerCase();
const runCorrelation = String(context.correlation_id ?? `ak-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const manualAction = String(context.action ?? '').toLowerCase();
const manualContractId = String(context.Contrato_ID ?? '').trim();
const manualAdId = String(context.Ad_ID ?? '').trim();
const manualTrackingId = String(context.tracking_id ?? '').trim();
const manualRequestedAt = String(context.requested_at ?? context.request_ts ?? new Date().toISOString());
const manualLogicalExecutionId = String(context.logical_execution_id ?? `${runCorrelation}:f2`);

const actionable = [];

for (const item of items) {
  const row = item.json ?? {};
  const status = String(row.Status_Contrato || '').trim().toLowerCase();
  const isActiveContract = ['activo', 'active', 'activa'].includes(status);
  if (!isActiveContract) continue;

  const adName = String(row.Ad_Name || row.Ad_Name_Meta || row.Nombre_Anuncio || '').trim();
  const regex = buildRegex(row.Regex_Anuncio || row.Regex_Anuncio, adName);
  const regexMatchesSheetName = regex ? regex.test(adName) : false;

  if (runMode === 'manual' && manualAction === 'pause_ad') {
    const rowContractId = String(row.Contrato_ID ?? '').trim();
    const rowAdId = String(row.Ad_ID ?? '').trim();
    if (!manualContractId || !manualAdId) continue;
    if (rowContractId !== manualContractId || rowAdId !== manualAdId) continue;

    actionable.push({
      json: {
        ...row,
        run_mode: 'manual',
        action: 'pause_ad',
        tracking_id: manualTrackingId,
        correlation_id: runCorrelation,
        logical_execution_id: manualLogicalExecutionId,
        requested_at: manualRequestedAt,
        control_type: 'expired',
        days_to_end: Number(row.days_to_end ?? 0),
        timezone: TZ,
        regex_pattern: regex ? regex.source : null,
        regexMatchesSheetName: true,
        manual_targeting: true,
        target_contract_id: manualContractId,
        target_ad_id: manualAdId
      }
    });
    continue;
  }

  const endDate = parseYMD(row.Fecha_Fin);
  if (!endDate) continue;

  const diffDays = daysBetween(today, endDate);
  const isExpired = diffDays < 0;
  const isPreventiveWindow = diffDays >= 0 && diffDays <= 2;
  const alreadyNotified = toBool(row.Notificado_Previo);

  let controlType = null;
  if (isExpired) controlType = 'expired';
  if (isPreventiveWindow && !alreadyNotified) controlType = 'preventive';

  if (!controlType) continue;

  actionable.push({
    json: {
      ...row,
      run_mode: runMode,
      correlation_id: runCorrelation,
      control_type: controlType,
      days_to_end: diffDays,
      timezone: TZ,
      regex_pattern: regex ? regex.source : null,
      regexMatchesSheetName
    }
  });
}

return actionable;"""

    nodes["Evaluate_Precheck_Meta"]["parameters"]["jsCode"] = """
function getNodeJson(name, idx) {
  try {
    return $item(idx).$node[name].json || {};
  } catch (_) {
    return {};
  }
}

const inputItems = $input.all();

return inputItems.map((inputItem, idx) => {
  const response = inputItem.json || {};
  const row = {
    ...getNodeJson('Expand Vencidos', idx),
    ...getNodeJson('Init Retry Precheck', idx),
    ...getNodeJson('Wait 5m Precheck Retry', idx)
  };

  row.Contrato_ID = String(row.Contrato_ID || '').trim();
  row.regex_pattern = String(row.regex_pattern || row.Regex_Anuncio || '').trim();

  const attempt = Number(row.precheck_attempt || 1);
  const maxAttempts = Number(row.precheck_max_attempts || 3);
  const httpStatus = Number(response.http_status || 0);
  const httpBody = response.http_body && typeof response.http_body === 'object' ? response.http_body : {};
  const httpOk = Boolean(response.http_ok);
  const retryable = Boolean(response.retryable);

  if (retryable && attempt < maxAttempts) {
    return {
      json: {
        ...row,
        precheck_attempt: attempt + 1,
        precheck_state: 'retry',
        precheck_status_code: httpStatus,
        precheck_http_ok: httpOk
      }
    };
  }

  if (!httpOk) {
    return {
      json: {
        ...row,
        precheck_state: 'failed',
        precheck_status_code: httpStatus,
        precheck_http_ok: httpOk,
        precheck_reason: 'meta_precheck_non_2xx'
      }
    };
  }

  const adNameMeta = String(httpBody.name || '').trim();
  const regexPattern = row.regex_pattern;
  const manualTargeting = Boolean(row.manual_targeting);
  let regexMatchesMetaName = false;
  try {
    regexMatchesMetaName = manualTargeting ? true : (!!regexPattern && new RegExp(regexPattern, 'i').test(adNameMeta));
  } catch (_) {
    regexMatchesMetaName = manualTargeting;
  }

  const status = String(httpBody.status || httpBody.effective_status || '').toUpperCase();
  const isActive = status === 'ACTIVE';

  if (!isActive || !regexMatchesMetaName) {
    return {
      json: {
        ...row,
        precheck_state: 'not_actionable',
        precheck_status_code: httpStatus,
        precheck_http_ok: httpOk,
        ad_status_meta: status || 'UNKNOWN',
        regexMatchesMetaName,
        ad_name_meta: adNameMeta
      }
    };
  }

  return {
    json: {
      ...row,
      precheck_state: 'ready_to_pause',
      precheck_status_code: httpStatus,
      precheck_http_ok: httpOk,
      ad_status_meta: status,
      regexMatchesMetaName,
      ad_name_meta: adNameMeta
    }
  };
});
"""

    node_names = {n["name"] for n in f2["nodes"]}
    if "Build Operation Final Status" not in node_names:
        f2["nodes"].append(
            {
                "parameters": {
                    "jsCode": "const nowIso = $now.setZone('America/Argentina/Buenos_Aires').toISO();\n\nfunction toFinalStatus(row) {\n  const pauseState = String(row.pause_state ?? '').toLowerCase();\n  const precheckState = String(row.precheck_state ?? '').toLowerCase();\n  const statusContrato = String(row.Status_Contrato ?? '').toLowerCase();\n\n  if (pauseState === 'success' || statusContrato === 'finalizado') return 'paused';\n  if (precheckState === 'not_actionable') return 'already_paused';\n  if (precheckState === 'failed' || pauseState === 'failed') return 'failed';\n  if (['retry', 'ready_to_pause'].includes(precheckState) || pauseState === 'retry') return 'processing';\n  return 'processing';\n}\n\nreturn $input.all().flatMap((item) => {\n  const row = item.json ?? {};\n  const trackingId = String(row.tracking_id ?? '').trim();\n  if (!trackingId) return [];\n\n  const correlationId = String(row.correlation_id ?? '').trim();\n  const finalStatus = toFinalStatus(row);\n\n  return [{\n    json: {\n      tracking_id: trackingId,\n      correlation_id: correlationId,\n      action: String(row.action ?? 'pause_ad'),\n      run_mode: String(row.run_mode ?? 'manual'),\n      status: finalStatus,\n      final_status: finalStatus,\n      result: finalStatus,\n      Contrato_ID: String(row.Contrato_ID ?? row.target_contract_id ?? ''),\n      Ad_ID: String(row.Ad_ID ?? row.target_ad_id ?? ''),\n      precheck_status: String(row.ad_status_meta ?? row.precheck_status ?? 'UNKNOWN'),\n      meta_http_status: Number(row.pause_status_code ?? row.precheck_status_code ?? row.http_status ?? 0) || null,\n      pause_attempt: Number(row.pause_attempt ?? row.precheck_attempt ?? 0) || 0,\n      pause_max_attempts: Number(row.pause_max_attempts ?? row.precheck_max_attempts ?? 0) || 0,\n      pause_reason: String(row.pause_reason ?? row.precheck_reason ?? ''),\n      source_workflow: 'contract-guard-daily-killswitch',\n      execution_id: String($execution?.id ?? ''),\n      requested_at: String(row.requested_at ?? row.request_ts ?? nowIso),\n      updated_at: nowIso,\n      timestamp: nowIso\n    }\n  }];\n});"
                },
                "id": "f2-build-op-final-status",
                "name": "Build Operation Final Status",
                "type": "n8n-nodes-base.code",
                "typeVersion": 2,
                "position": [1184, 832],
            }
        )

    node_names = {n["name"] for n in f2["nodes"]}
    if "GS Append Operation Final Status" not in node_names:
        f2["nodes"].append(
            {
                "parameters": {
                    "operation": "append",
                    "documentId": {"__rl": True, "value": "1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY", "mode": "id"},
                    "sheetName": {"__rl": True, "value": "Operations_Log", "mode": "name"},
                    "columns": {
                        "mappingMode": "autoMapInputData",
                        "value": {},
                        "matchingColumns": [],
                        "schema": [],
                        "attemptToConvertTypes": False,
                        "convertFieldsToString": False,
                    },
                    "options": {},
                    "authentication": "serviceAccount",
                },
                "id": "f2-append-op-final-status",
                "name": "GS Append Operation Final Status",
                "type": "n8n-nodes-base.googleSheets",
                "typeVersion": 4.5,
                "position": [1408, 832],
                "credentials": {"googleApi": {"id": "BtY3uGIkB5umd39o", "name": "Google Service Account account"}},
                "onError": "continueErrorOutput",
            }
        )

    conn = f2["connections"]
    for src, idx in [
        ("Build Finalizado Payload", 0),
        ("Evaluate_Rutear_Estado_Precheck", 2),
        ("Evaluate_Rutear_Estado_Precheck", 3),
        ("Evaluate_Rutear_Resultado_Pausa", 2),
    ]:
        conn.setdefault(src, {"main": []})
        main = conn[src]["main"]
        while len(main) <= idx:
            main.append([])
        if not any(x.get("node") == "Build Operation Final Status" for x in main[idx]):
            main[idx].append({"node": "Build Operation Final Status", "type": "main", "index": 0})

    conn["Build Operation Final Status"] = {
        "main": [[{"node": "GS Append Operation Final Status", "type": "main", "index": 0}]]
    }

    f2_path.write_text("\ufeff" + json.dumps(f2, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    update_f1()
    update_f2()
    print("updated F1 and F2 workflows")


if __name__ == "__main__":
    main()
