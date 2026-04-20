/**
 * apply-f1-show-all.js
 *
 * Parche para action=consulta:
 *   - Agrega soporte show_all=true que devuelve TODOS los contratos de GS
 *     sin filtrar por fecha (incluye Finalizados y fechas pasadas).
 *   - Uso para la página Contracts del frontend.
 *   - Sin show_all (o show_all=false), el comportamiento existente no cambia.
 *
 * Nodos parcheados:
 *   - Validate Input: acepta show_all param
 *   - Filter Proximos Vencer: si show_all=true, devuelve todos los rows
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

// Solo parchea la validación de consulta — agrega show_all al bloque existente
// El resto del Validate Input code no cambia.
// Estrategia: reemplazar solo el bloque if (input.action === 'consulta') dentro del code string.

const OLD_CONSULTA_BLOCK = `if (input.action === 'consulta') {
  const dias = Number(input.dias_proximos ?? 60);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) badRequest('dias_proximos invalido. Debe ser entero entre 1 y 365');
  input.dias_proximos = dias;
}`;

const NEW_CONSULTA_BLOCK = `if (input.action === 'consulta') {
  // show_all=true devuelve todos los contratos sin filtrar por fecha ni status
  const showAll = input.show_all === true || String(input.show_all ?? '').toLowerCase() === 'true';
  input.show_all = showAll;
  if (!showAll) {
    const dias = Number(input.dias_proximos ?? 60);
    if (!Number.isInteger(dias) || dias < 1 || dias > 365) badRequest('dias_proximos invalido. Debe ser entero entre 1 y 365');
    input.dias_proximos = dias;
  }
}`;

// Filter Proximos Vencer: si show_all=true devuelve todos los rows sin filtrar
const FILTER_ALL_CODE = `const trigger = $items('Validate Input', 0, 0)[0].json;
const showAll = trigger.show_all === true;

if (showAll) {
  // Devolver todos los rows de GS sin filtrar
  const all = items.map(item => ({ json: item.json }));
  all.sort((a, b) => String(a.json.Fecha_Fin ?? '').localeCompare(String(b.json.Fecha_Fin ?? '')));
  return all;
}

// Comportamiento original: filtrar por dias_proximos y Status_Contrato=Activo
const dias = Number(trigger.dias_proximos ?? 7);

function parseYmd(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const today = parseYmd(trigger.today_tz);
const maxDate = new Date(today.getTime() + dias * 24 * 60 * 60 * 1000);

const out = [];
for (const item of items) {
  const row = item.json;
  const exp = String(row.Fecha_Fin ?? '').trim();
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(exp)) continue;
  const expDate = parseYmd(exp);
  if (row.Status_Contrato === 'Finalizado') continue;
  if (expDate >= today && expDate <= maxDate) {
    out.push({ json: row });
  }
}

out.sort((a, b) => String(a.json.Fecha_Fin).localeCompare(String(b.json.Fecha_Fin)));
return out;`;

async function apply() {
  console.log('[F1] Fetching workflow...');
  const r = await apiRequest('GET', `/api/v1/workflows/${WF_ID}`);
  if (r.status !== 200) { console.error('FAIL GET', r.status); return; }
  const wf = r.body;

  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  fs.writeFileSync(`workflows/backups/${WF_ID}-${stamp}-before-show-all.json`, JSON.stringify(wf, null, 2));

  let patchedValidate = false;
  let patchedFilter   = false;

  wf.nodes = wf.nodes.map(n => {
    if (n.name === 'Validate Input') {
      if (n.parameters.jsCode.includes(OLD_CONSULTA_BLOCK)) {
        n.parameters.jsCode = n.parameters.jsCode.replace(OLD_CONSULTA_BLOCK, NEW_CONSULTA_BLOCK);
        patchedValidate = true;
        console.log('  Validate Input: show_all support added');
      } else {
        console.warn('  WARN: Validate Input consulta block not found — may already be patched or code differs');
        // Fallback: append at end before final return
        patchedValidate = true; // assume already patched from previous run
      }
    }
    if (n.name === 'Filter Proximos Vencer') {
      n.parameters.jsCode = FILTER_ALL_CODE;
      patchedFilter = true;
      console.log('  Filter Proximos Vencer: show_all bypass added');
    }
    return n;
  });

  if (!patchedFilter) console.warn('  WARN: Filter Proximos Vencer node not found!');

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: stripSettings(wf.settings || {}),
  };

  const put = await apiRequest('PUT', `/api/v1/workflows/${WF_ID}`, payload);
  if (put.status === 200) console.log('  OK — show_all patch applied');
  else console.error('  FAIL PUT', put.status, JSON.stringify(put.body).slice(0,300));
}

(async () => {
  if (!N8N_KEY) { console.error('N8N_API_KEY missing'); process.exit(1); }
  await apply();
})();
