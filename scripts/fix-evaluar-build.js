/**
 * fix-evaluar-build.js
 *
 * Problema: el nodo HTTP Request (Meta - Precheck / Meta - Pausar) elimina todos
 * los campos del ítem de entrada. Evaluar Precheck y Build Finalizado pierden el
 * contexto del contrato (Contrato_ID, regex_pattern, etc.) y fallan.
 *
 * Fix: restaurar contexto desde el nodo Set previo al HTTP Request:
 *   - Evaluar Precheck Meta → ctx de $('Init Retry Precheck').all()[idx]
 *   - Build Finalizado Payload → ctx de $('Init Retry Pausa').all()[idx]
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const N8N_KEY    = process.env.N8N_API_KEY;
const F2_ID      = '8mlwAxLtJVrwpLhi';
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');

function api(method, p, body) {
  return new Promise((res, rej) => {
    const u = new URL('http://168.138.125.21:5678' + p);
    const bs = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search, method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}),
      },
    };
    const req = http.request(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res({ s: r.statusCode, b: JSON.parse(d) }); } catch { res({ s: r.statusCode, b: d }); } });
    });
    req.on('error', rej);
    if (bs) req.write(bs);
    req.end();
  });
}

const STRIP = ['executionOrder','saveManualExecutions','saveDataSuccessExecution','saveDataErrorExecution','saveExecutionProgress','executionTimeout','timezone'];
function stripSettings(raw) { const s = {}; for (const k of STRIP) if (raw[k] !== undefined) s[k] = raw[k]; return s; }

// ─── New Evaluar Precheck Meta code ─────────────────────────────────────────
// Restaura contexto del contrato desde Init Retry Precheck (antes del HTTP Request)
const EVALUAR_PRECHECK_CODE = `function getNodeJson(name, idx) {
  try { return $item(idx).$node[name].json || {}; } catch (_) { return {}; }
}

const inputItems = $input.all();
const initRetryItems = $('Init Retry Precheck').all();

return inputItems.map((inputItem, idx) => {
  const response = inputItem.json || {};

  // Restore contract context lost after HTTP Request node
  const contractCtx = initRetryItems[idx]?.json ?? {};
  const row = { ...contractCtx, ...(inputItem.json || {}) };

  row.Contrato_ID   = String(row.Contrato_ID || '').trim();
  row.regex_pattern = String(row.regex_pattern || row.Regex_Anuncio || '').trim();

  const attempt     = Number(row.precheck_attempt || 1);
  const maxAttempts = Number(row.precheck_max_attempts || 3);
  const httpStatus  = Number(response.http_status || 0);
  const httpBody    = response.http_body && typeof response.http_body === 'object' ? response.http_body : {};
  const httpOk      = Boolean(response.http_ok);
  const retryable   = Boolean(response.retryable);

  if (retryable && attempt < maxAttempts) {
    return { json: { ...row, precheck_attempt: attempt + 1, precheck_state: 'retry',
      precheck_status_code: httpStatus, precheck_http_ok: httpOk } };
  }

  if (!httpOk) {
    return { json: { ...row, precheck_state: 'failed',
      precheck_status_code: httpStatus, precheck_http_ok: httpOk,
      precheck_reason: 'meta_precheck_non_2xx' } };
  }

  const adNameMeta   = String(httpBody.name || '').trim();
  const regexPattern = row.regex_pattern;
  let regexMatchesMetaName = false;
  try {
    regexMatchesMetaName = !!regexPattern && new RegExp(regexPattern, 'i').test(adNameMeta);
  } catch (_) { regexMatchesMetaName = false; }

  const status   = String(httpBody.status || httpBody.effective_status || '').toUpperCase();
  const isActive = status === 'ACTIVE';

  // Skip regex check if regexPattern is missing (already filtered upstream by list-ads)
  const regexOk = !regexPattern || regexMatchesMetaName;

  if (!isActive || !regexOk) {
    return { json: { ...row, precheck_state: 'not_actionable',
      precheck_status_code: httpStatus, precheck_http_ok: httpOk,
      ad_status_meta: status || 'UNKNOWN', regexMatchesMetaName, ad_name_meta: adNameMeta } };
  }

  return { json: { ...row, precheck_state: 'ready_to_pause',
    precheck_status_code: httpStatus, precheck_http_ok: httpOk,
    ad_status_meta: status, regexMatchesMetaName, ad_name_meta: adNameMeta } };
});`;

// ─── New Build Finalizado Payload code ──────────────────────────────────────
// Restaura contexto del contrato desde Init Retry Pausa (antes del HTTP Request de pausa)
const BUILD_FINALIZADO_CODE = `function getNodeJson(name, idx) {
  try { return $item(idx).$node[name].json || {}; } catch (_) { return {}; }
}

const nowIso = $now.setZone('America/Argentina/Buenos_Aires').toISO();
const inputItems = $input.all();
const initRetryPausaItems = $('Init Retry Pausa').all();

return inputItems.map((inputItem, idx) => {
  // Restore contract context lost after Meta - Pausar Ad HTTP Request node
  const contractCtx = initRetryPausaItems[idx]?.json ?? {};
  const merged = { ...contractCtx, ...(inputItem.json || {}) };

  const contratoId = String(merged.Contrato_ID || '').trim();

  return {
    json: {
      ...merged,
      Contrato_ID:     contratoId,
      Status_Contrato: 'Finalizado',
      Fecha_Finalizacion: nowIso,
    }
  };
});`;

async function main() {
  const r = await api('GET', `/api/v1/workflows/${F2_ID}`);
  if (r.s !== 200) { console.error('GET error:', r.b); process.exit(1); }
  const wf = r.b;

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.writeFileSync(path.join(BACKUP_DIR, `${F2_ID}-${stamp}-pre-evaluar-fix.json`), JSON.stringify(wf, null, 2));

  const evalNode  = wf.nodes.find(n => n.name === 'Evaluar Precheck Meta');
  const buildNode = wf.nodes.find(n => n.name === 'Build Finalizado Payload');

  if (!evalNode)  { console.error('Evaluar Precheck Meta no encontrado'); process.exit(1); }
  if (!buildNode) { console.error('Build Finalizado Payload no encontrado'); process.exit(1); }

  evalNode.parameters.jsCode  = EVALUAR_PRECHECK_CODE;
  buildNode.parameters.jsCode = BUILD_FINALIZADO_CODE;
  console.log('✓ Evaluar Precheck Meta: restaura ctx desde Init Retry Precheck');
  console.log('✓ Build Finalizado Payload: restaura ctx desde Init Retry Pausa');

  const payload = {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  };
  const put = await api('PUT', `/api/v1/workflows/${F2_ID}`, payload);
  if (put.s !== 200) { console.error('PUT error:', JSON.stringify(put.b).slice(0, 400)); process.exit(1); }
  console.log('✅ F2 actualizado');
  console.log('   Corré F2 y verificá que los ads ACTIVE pasen a ready_to_pause → pausa → Finalizado');
}

main().catch(e => { console.error(e); process.exit(1); });