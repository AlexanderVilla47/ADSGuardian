/**
 * apply-f1-design-fixes.js
 *
 * Bloque A del plan MVP:
 *   A1 — Auto-generar Contrato_ID en action=alta (ya no lo ingresa el usuario)
 *   A2 — Auto-derivar Regex_Anuncio del nombre del influencer (ya no lo ingresa el usuario)
 *
 * Cambios en dos nodos:
 *   - Validate Input:   acepta 'influencer_name' como alias de 'Cliente'
 *                       acepta 'end_date' como alias de 'Fecha_Fin'
 *                       elimina 'Contrato_ID' y 'Regex_Anuncio' de campos requeridos para alta
 *   - Prepare Alta Row: auto-genera Contrato_ID y Regex_Anuncio antes de escribir a GS
 *
 * Nota A3 (baja_manual → pause ads) requiere Meta API credentials — se implementa en
 * producción cuando estén disponibles. Este script solo cubre A1 y A2.
 */

const fs   = require('fs');
const http = require('http');

const N8N_BASE = 'http://168.138.125.21:5678';
const N8N_KEY  = process.env.N8N_API_KEY;
const WF_ID    = 'cFBr6GavlSWDsUFz';

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_BASE + path);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' }
    };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function stripSettings(raw) {
  const ALLOWED = [
    'executionOrder','saveManualExecutions','saveDataSuccessExecution',
    'saveDataErrorExecution','saveExecutionProgress','executionTimeout',
    'timezone','errorWorkflow','callerIds','callerPolicy'
  ];
  const s = {};
  for (const k of ALLOWED) if (raw[k] !== undefined) s[k] = raw[k];
  return s;
}

// ─── Nuevo código para Validate Input ──────────────────────────────────────────
// Cambios respecto al original:
//   - Para 'alta': solo requiere 'end_date' o 'Fecha_Fin' + 'influencer_name' o 'Cliente'
//   - Acepta nombres de campo en formato frontend (end_date, influencer_name) y los normaliza
//   - Elimina Contrato_ID y Regex_Anuncio de los requeridos (se auto-generan en Prepare Alta Row)

const VALIDATE_INPUT_CODE = `const input = $json;
const allowedActions = new Set(['alta','search', 'influencers_search', 'consulta', 'extension', 'baja_manual', 'listar_ads', 'run_now', 'history', 'pause_ad', 'pause_active']);

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
  badRequest('\`action\` invalida. Usar: alta | search | consulta | extension | baja_manual | listar_ads | run_now | history | pause_ad | pause_active', { action: input.action });
}

input.actor = String(input.requested_by ?? input.actor ?? 'ops@adskiller').trim();
input.correlation_id = String(input.correlation_id ?? \`ak-ui-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`);

// ── Normalizar aliases de campo del frontend hacia nombres internos GS ──────────
// Frontend envía: influencer_name, end_date
// GS espera:      Cliente,          Fecha_Fin
if (input.influencer_name && !input.Cliente) input.Cliente = input.influencer_name;
if (input.end_date && !input.Fecha_Fin)      input.Fecha_Fin = input.end_date;
if (input.new_end_date && !input.Nueva_Fecha_Fin) input.Nueva_Fecha_Fin = input.new_end_date;
if (input.contract_id && !input.Contrato_ID) input.Contrato_ID = input.contract_id;
if (input.ad_id && !input.Ad_ID)             input.Ad_ID = input.ad_id;

if (input.action === 'alta') {
  // Solo requiere nombre del influencer y fecha fin.
  // Contrato_ID y Regex_Anuncio se auto-generan en Prepare Alta Row.
  if (!String(input.Cliente ?? '').trim()) {
    badRequest('influencer_name (o Cliente) es obligatorio para alta');
  }
  if (!String(input.Fecha_Fin ?? '').trim()) {
    badRequest('end_date (o Fecha_Fin) es obligatorio para alta');
  }
  if (!isValidDateFormat(input.Fecha_Fin)) {
    badRequest('end_date invalido. Formato requerido: YYYY-MM-DD');
  }
  const endDateObj = new Date(input.Fecha_Fin + 'T00:00:00Z');
  if (endDateObj <= new Date()) {
    badRequest('end_date debe ser una fecha futura');
  }
}

if (input.action === 'extension') {
  if (!String(input.Contrato_ID ?? '').trim()) badRequest('contract_id es obligatorio para extension');
  if (!String(input.Nueva_Fecha_Fin ?? '').trim()) badRequest('new_end_date es obligatorio para extension');
  if (!isValidDateFormat(input.Nueva_Fecha_Fin)) badRequest('new_end_date invalido. Formato requerido: YYYY-MM-DD');
}

if (input.action === 'search') {
  if (!String(input.q ?? '').trim()) badRequest('q es obligatorio para search');
  input.q = String(input.q).trim();
}

if (input.action === 'consulta') {
  const dias = Number(input.dias_proximos ?? 60);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) badRequest('dias_proximos invalido. Debe ser entero entre 1 y 365');
  input.dias_proximos = dias;
}

if (input.action === 'baja_manual' || input.action === 'listar_ads' || input.action === 'pause_ad' || input.action === 'pause_active') {
  if (!String(input.Contrato_ID ?? '').trim()) badRequest('contract_id es obligatorio para esta accion');
}

if (input.action === 'pause_ad' && !String(input.Ad_ID ?? '').trim()) {
  badRequest('ad_id es obligatorio para pause_ad');
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
    if (!confirmToken) badRequest('confirm_token es obligatorio cuando dry_run=false');
    try {
      const decoded = JSON.parse(Buffer.from(normalizeB64(confirmToken), 'base64').toString('utf8'));
      const tokenContractId = String(decoded.contract_id ?? '').trim();
      const tokenBatchSize = Number(decoded.max_batch_size ?? 0);
      const expiresAt = Number(decoded.expires_at_epoch_ms ?? 0);
      if (!tokenContractId || tokenContractId !== String(input.Contrato_ID).trim()) badRequest('confirm_token no corresponde al contract_id enviado');
      if (!Number.isInteger(tokenBatchSize) || tokenBatchSize !== maxBatchSize) badRequest('confirm_token no corresponde al max_batch_size enviado');
      if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) badRequest('confirm_token vencido');
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

return [{ json: input }];`;

// ─── Nuevo código para Prepare Alta Row ────────────────────────────────────────
// A1: auto-genera Contrato_ID
// A2: auto-deriva Regex_Anuncio del nombre del influencer

const PREPARE_ALTA_ROW_CODE = `// A1: Auto-generar Contrato_ID
const stamp = new Date().toISOString().slice(0,10);
const suffix = Math.random().toString(36).slice(2,6).toUpperCase();
const contratoId = \`AK-\${stamp}-\${suffix}\`;

// A2: Auto-derivar Regex_Anuncio del nombre del influencer
// "Farid Dieck" → "farid|dieck|fariddieck"
const nombreRaw = String($json.Cliente ?? '').trim();
const words = nombreRaw.toLowerCase()
  .replace(/[^a-z0-9\\s]/g, '')
  .trim()
  .split(/\\s+/)
  .filter(Boolean);

let regexAnuncio;
if (words.length === 0) {
  regexAnuncio = 'sin-patron';
} else if (words.length === 1) {
  regexAnuncio = words[0];
} else {
  const parts = [...words, words.join('')];
  regexAnuncio = [...new Set(parts)].join('|');
}

return [{
  json: {
    Contrato_ID:          contratoId,
    Cliente:              String($json.Cliente).trim(),
    Regex_Anuncio:        regexAnuncio,
    Fecha_Alta:           String($json.today_tz),
    Fecha_Fin:            String($json.Fecha_Fin),
    Status_Contrato:      'Activo',
    Notificado_Previo:    false,
    Ad_ID:                String($json.Ad_ID ?? ''),
    Ad_Name:              String($json.Ad_Name ?? ''),
    Fecha_Notificado_Previo: '',
    Fecha_Finalizacion:   '',
    Updated_At:           $json.request_ts,
  },
}];`;

// ─── Apply ────────────────────────────────────────────────────────────────────

async function apply() {
  console.log('[F1] Fetching workflow...');
  const r = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`);
  if (r.status !== 200) { console.error('FAIL GET', r.status, JSON.stringify(r.body).slice(0,200)); return; }
  const wf = r.body;

  // Backup
  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const backupPath = `workflows/backups/${WF_ID}-${stamp}-before-design-fixes.json`;
  fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log(`  Backup: ${backupPath}`);

  let patchedValidate = false;
  let patchedPrepare  = false;

  wf.nodes = wf.nodes.map(n => {
    if (n.name === 'Validate Input') {
      n.parameters.jsCode = VALIDATE_INPUT_CODE;
      patchedValidate = true;
      console.log('  Validate Input: field aliases + auto-gen fields removed from required');
    }
    if (n.name === 'Prepare Alta Row') {
      n.parameters.jsCode = PREPARE_ALTA_ROW_CODE;
      patchedPrepare = true;
      console.log('  Prepare Alta Row: auto Contrato_ID + auto Regex_Anuncio');
    }
    return n;
  });

  if (!patchedValidate) console.warn('  WARN: Validate Input node not found by name!');
  if (!patchedPrepare)  console.warn('  WARN: Prepare Alta Row node not found by name!');

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: stripSettings(wf.settings || {}),
  };

  const put = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, payload);
  if (put.status === 200) {
    console.log('  OK — F1 design fixes applied');
  } else {
    console.error('  FAIL PUT', put.status, JSON.stringify(put.body).slice(0,300));
  }
}

(async () => {
  if (!N8N_KEY) { console.error('N8N_API_KEY missing'); process.exit(1); }
  await apply();
})();
