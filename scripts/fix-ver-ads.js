/**
 * fix-ver-ads.js
 *
 * Fix D + E en contract-ui-management (live):
 *
 *  Fix D: Build Listar Ads Response — cambia `items` → `ads` en la respuesta
 *         y normaliza lectura de Contrato_ID desde múltiples fuentes
 *
 *  Fix E: Extract Regex para Listar Ads — maneja tanto `contract_id` (snake_case
 *         que envía el frontend) como `Contrato_ID` (PascalCase interno)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const N8N_KEY    = process.env.N8N_API_KEY;
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');
const BASE_HOST  = '168.138.125.21';
const BASE_PORT  = 5678;

if (!N8N_KEY) { console.error('N8N_API_KEY requerida'); process.exit(1); }

function api(method, p, body) {
  return new Promise((res, rej) => {
    const bs = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: BASE_HOST, port: BASE_PORT, path: p, method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type':  'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}),
      },
    };
    const req = http.request(opts, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { res({ s: r.statusCode, b: JSON.parse(d) }); }
        catch { res({ s: r.statusCode, b: d }); }
      });
    });
    req.on('error', rej);
    if (bs) req.write(bs);
    req.end();
  });
}

const STRIP = [
  'executionOrder','saveManualExecutions','saveDataSuccessExecution',
  'saveDataErrorExecution','saveExecutionProgress','executionTimeout','timezone',
];
function stripSettings(raw) {
  const s = {};
  for (const k of STRIP) if (raw[k] !== undefined) s[k] = raw[k];
  return s;
}

// ─── Fix D: Build Listar Ads Response ─────────────────────────────────────────
// Lee Contrato_ID desde cualquiera de los campos que pueden llegar,
// devuelve `ads` (no `items`) para que el frontend lo lea correctamente.
const BUILD_LISTAR_ADS_CODE = `// Recibe respuesta del webhook ak-meta-list-v1
const req = $('Normalize Request').first()?.json ?? {};
const idContrato = String(
  req.Contrato_ID ||
  req.contract_id ||
  req.body?.Contrato_ID ||
  req.body?.contract_id ||
  ''
).trim();
const data = $input.first()?.json?.data ?? [];

return [{
  json: {
    ok: true,
    action: 'listar_ads',
    data: {
      contract_id: idContrato,
      total: data.length,
      ads: data.map(ad => ({
        ad_id:     String(ad.id   ?? ''),
        ad_name:   String(ad.name ?? ''),
        ad_status: String(ad.effective_status ?? ad.status ?? 'UNKNOWN').toUpperCase(),
      })),
    },
    meta: {
      correlation_id: req.correlation_id ?? '',
      timestamp: new Date().toISOString(),
    },
  }
}];`;

// ─── Fix E: Extract Regex para Listar Ads ─────────────────────────────────────
// El frontend envía contract_id (snake_case) en la RAÍZ del objeto Normalize Request.
// El workflow internamente usa Contrato_ID (PascalCase). Buscamos todas las variantes.
const EXTRACT_REGEX_CODE = `// Extrae Regex_Anuncio del contrato para pasarlo al webhook ak-meta-list-v1
const req = $('Normalize Request').first()?.json ?? {};
const idContrato = String(
  req.Contrato_ID ||
  req.contract_id ||
  req.body?.Contrato_ID ||
  req.body?.contract_id ||
  ''
).trim();

const allRows = $input.all();
const contract = allRows.find(item =>
  String(item.json.Contrato_ID ?? '').trim() === idContrato
);

if (!contract) {
  return [{ json: { ok: false, error: 'contrato_no_encontrado', contract_id: idContrato } }];
}

return [{ json: {
  Contrato_ID:   idContrato,
  Regex_Anuncio: String(contract.json.Regex_Anuncio ?? '').trim(),
} }];`;

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 Fix Ver Ads — actualiza Build Listar Ads Response + Extract Regex');
  console.log('=====================================================================');

  // Buscar workflow UI Management por nombre
  const listR = await api('GET', '/api/v1/workflows?limit=50');
  if (listR.s !== 200) { console.error('Error listando workflows:', listR.b); process.exit(1); }

  const wfList = listR.b.data ?? listR.b;
  const target = wfList.find(w => {
    const n = w.name.toLowerCase();
    return n.includes('contract ui management') ||
           n.includes('contract-ui-management') ||
           n.includes('ui management');
  });

  if (!target) {
    console.error('Workflow UI Management no encontrado. Disponibles:');
    wfList.forEach(w => console.log(' -', w.id, w.name));
    process.exit(1);
  }
  const WF_ID = target.id;
  console.log(`✓ Workflow: "${target.name}" (${WF_ID})`);

  // GET workflow completo
  const r = await api('GET', `/api/v1/workflows/${WF_ID}`);
  if (r.s !== 200) { console.error('GET error:', r.s, r.b); process.exit(1); }
  const wf = r.b;
  console.log(`✓ Nodos: ${wf.nodes.length}`);

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkp   = path.join(BACKUP_DIR, `${WF_ID}-${stamp}-pre-ver-ads.json`);
  fs.writeFileSync(bkp, JSON.stringify(wf, null, 2));
  console.log(`✓ Backup: ${path.basename(bkp)}`);

  const nodes = wf.nodes;

  // Fix D: Build Listar Ads Response
  const buildNode = nodes.find(n => n.name === 'Build Listar Ads Response');
  if (buildNode) {
    buildNode.parameters.jsCode = BUILD_LISTAR_ADS_CODE;
    console.log('✓ Fix D: Build Listar Ads Response → devuelve `ads` (no `items`)');
  } else {
    console.warn('⚠ Fix D: nodo "Build Listar Ads Response" no encontrado');
  }

  // Fix E: Extract Regex para Listar Ads
  const extractNode = nodes.find(n => n.name === 'Extract Regex para Listar Ads');
  if (extractNode) {
    extractNode.parameters.jsCode = EXTRACT_REGEX_CODE;
    console.log('✓ Fix E: Extract Regex para Listar Ads → lee contract_id Y Contrato_ID');
  } else {
    console.warn('⚠ Fix E: nodo "Extract Regex para Listar Ads" no encontrado — ¿corriste fix-ui-management antes?');
  }

  // PUT
  const payload = {
    name:        wf.name,
    nodes:       wf.nodes,
    connections: wf.connections,
    settings:    stripSettings(wf.settings || {}),
    staticData:  wf.staticData,
  };
  console.log(`\n📤 Subiendo cambios...`);
  const put = await api('PUT', `/api/v1/workflows/${WF_ID}`, payload);
  if (put.s !== 200) {
    console.error('PUT error:', JSON.stringify(put.b).slice(0, 600));
    process.exit(1);
  }
  console.log('✅ UI Management actualizado\n');

  // Verificación
  const verify = await api('GET', `/api/v1/workflows/${WF_ID}`);
  const vn     = verify.b.nodes;
  const buildCode   = vn.find(n => n.name === 'Build Listar Ads Response')?.parameters?.jsCode ?? '';
  const extractCode = vn.find(n => n.name === 'Extract Regex para Listar Ads')?.parameters?.jsCode ?? '';

  console.log('── Verificación ──────────────────────────────────────────────────');
  console.log('Fix D (ads no items):', buildCode.includes("ads:") && !buildCode.includes("items:"));
  console.log('Fix D (lee contract_id):', buildCode.includes("contract_id"));
  console.log('Fix E (lee contract_id):', extractCode.includes("contract_id"));
  console.log('Fix E (lee Contrato_ID):', extractCode.includes("Contrato_ID"));
  console.log('──────────────────────────────────────────────────────────────────');
}

main().catch(e => { console.error(e); process.exit(1); });
