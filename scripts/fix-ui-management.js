/**
 * fix-ui-management.js
 *
 * Fix 8 en contract-ui-management-v2:
 *
 *  8a: "Ver Ads" (action: listar_ads) — reemplaza lectura de Ad_ID/Ad_Name de
 *      Contratos por llamada al webhook ak-meta-list-v1?pattern={Regex_Anuncio}
 *
 *  8b: Prepare Alta Row — elimina Ad_ID y Ad_Name del objeto que se inserta
 *
 *  8c: Prepare Extension Row y Prepare Baja Row — elimina Ad_ID/Ad_Name del spread
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const N8N_KEY    = process.env.N8N_API_KEY;
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');
const BASE       = 'http://168.138.125.21:5678';
const LIST_ADS_WEBHOOK = 'http://168.138.125.21:5678/webhook/ak-meta-list-v1';

function api(method, p, body) {
  return new Promise((res, rej) => {
    const bs = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '168.138.125.21', port: 5678, path: p, method,
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

// ─── Códigos actualizados ────────────────────────────────────────────────────

// Fix 8a: Build Listar Ads Response — usa data del HTTP request a list-ads webhook
const BUILD_LISTAR_ADS_CODE = `// Recibe la respuesta del webhook ak-meta-list-v1
// Formatea y devuelve la lista de ads del influencer
const idContrato = String($('Normalize Request').first()?.json?.body?.Contrato_ID ?? '').trim();
const data = $input.first()?.json?.data ?? [];

return [{
  json: {
    ok: true,
    action: 'listar_ads',
    data: {
      contract_id: idContrato,
      total: data.length,
      items: data.map(ad => ({
        ad_id:     String(ad.id   ?? ''),
        ad_name:   String(ad.name ?? ''),
        ad_status: String(ad.effective_status ?? ad.status ?? 'UNKNOWN').toUpperCase(),
      })),
    },
    meta: {
      correlation_id: $('Normalize Request').first()?.json?.correlation_id ?? '',
      timestamp: new Date().toISOString(),
    },
  }
}];`;

// Fix 8a: Extract Regex para llamar al list-ads webhook
const EXTRACT_REGEX_CODE = `// Extrae Regex_Anuncio del contrato leído para pasarlo al webhook
const idContrato = String($('Normalize Request').first()?.json?.body?.Contrato_ID ?? '').trim();
const allRows = $input.all();
const contract = allRows.find(item => String(item.json.Contrato_ID ?? '').trim() === idContrato);

if (!contract) {
  return [{ json: { ok: false, error: 'contrato_no_encontrado', contract_id: idContrato } }];
}

return [{ json: {
  Contrato_ID:   idContrato,
  Regex_Anuncio: String(contract.json.Regex_Anuncio ?? '').trim(),
}}];`;

// Fix 8b/8c: removes Ad_ID and Ad_Name from jsCode strings
function removeAdIdAdName(code) {
  return code
    // Remove lines like: Ad_ID: String($json.Ad_ID ?? ''),
    .replace(/\s*Ad_ID:\s*String\([^)]+\),?\n?/g, '\n')
    // Remove lines like: Ad_Name: String($json.Ad_Name ?? ''),
    .replace(/\s*Ad_Name:\s*String\([^)]+\),?\n?/g, '\n')
    // Remove lines like: Ad_ID: '',
    .replace(/\s*Ad_ID:\s*['"]['"]\s*,?\n?/g, '\n')
    // Remove lines like: Ad_Name: '',
    .replace(/\s*Ad_Name:\s*['"]['"]\s*,?\n?/g, '\n')
    // Clean up double blank lines
    .replace(/\n{3,}/g, '\n\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!N8N_KEY) { console.error('N8N_API_KEY requerida'); process.exit(1); }

  console.log('🔧 Fix UI Management — GET → modify → PUT');
  console.log('==========================================');

  // Buscar workflow por nombre
  const listR = await api('GET', '/api/v1/workflows?limit=50');
  if (listR.s !== 200) { console.error('Error listando workflows:', listR.b); process.exit(1); }

  const wfList = listR.b.data ?? listR.b;
  const target = wfList.find(w =>
    w.name.toLowerCase().includes('contract ui management') ||
    w.name.toLowerCase().includes('contract-ui-management') ||
    w.name.toLowerCase().includes('ui management')
  );
  if (!target) {
    console.error('Workflow UI Management no encontrado. Workflows disponibles:');
    wfList.forEach(w => console.log(' -', w.id, w.name));
    process.exit(1);
  }
  const WF_ID = target.id;
  console.log(`✓ Workflow encontrado: "${target.name}" (${WF_ID})`);

  const r = await api('GET', `/api/v1/workflows/${WF_ID}`);
  if (r.s !== 200) { console.error('GET error:', r.s, r.b); process.exit(1); }
  const wf = r.b;
  console.log(`✓ Workflow obtenido: ${wf.nodes.length} nodos`);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkp = path.join(BACKUP_DIR, `${WF_ID}-${stamp}-pre-ui-fix.json`);
  fs.writeFileSync(bkp, JSON.stringify(wf, null, 2));
  console.log(`✓ Backup: ${path.basename(bkp)}`);

  const nodes = wf.nodes;
  const conns = wf.connections;
  const nodeByName = name => nodes.find(n => n.name === name);

  // ── Fix 8b/8c: Eliminar Ad_ID/Ad_Name de Alta, Extension, Baja ──────────
  const codeNodesToFix = [
    'Prepare Alta Row',
    'Prepare Extension Row',
    'Prepare Baja Row',
  ];
  for (const nodeName of codeNodesToFix) {
    const n = nodeByName(nodeName);
    if (n && n.parameters?.jsCode) {
      const before = n.parameters.jsCode;
      n.parameters.jsCode = removeAdIdAdName(before);
      const changed = n.parameters.jsCode !== before;
      console.log(`${changed ? '✓' : '✓ (sin cambios)'} Fix 8b/8c: ${nodeName}`);
    } else {
      console.warn(`⚠ Fix 8b/8c: nodo "${nodeName}" no encontrado`);
    }
  }

  // ── Fix 8a: Ver Ads — insertar Extract Regex + HTTP Request + actualizar Build ──

  // 1. Agregar nodo "Extract Regex para Listar Ads" si no existe
  if (!nodeByName('Extract Regex para Listar Ads')) {
    const gsReadNode = nodeByName('GS Read For Listar Ads');
    const gsPos = gsReadNode?.position ?? [800, 0];
    nodes.push({
      id: 'extract-regex-listar-ads',
      name: 'Extract Regex para Listar Ads',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [gsPos[0] + 240, gsPos[1]],
      parameters: { jsCode: EXTRACT_REGEX_CODE },
    });
    console.log('✓ Fix 8a: nodo Extract Regex para Listar Ads agregado');
  } else {
    console.log('✓ Fix 8a: Extract Regex ya existía');
  }

  // 2. Agregar nodo HTTP "Meta - Listar Ads (UI)" si no existe
  if (!nodeByName('Meta - Listar Ads (UI)')) {
    const extractNode = nodeByName('Extract Regex para Listar Ads');
    const extractPos = extractNode?.position ?? [1040, 0];
    nodes.push({
      id: 'meta-listar-ads-ui',
      name: 'Meta - Listar Ads (UI)',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [extractPos[0] + 240, extractPos[1]],
      parameters: {
        method: 'GET',
        url: LIST_ADS_WEBHOOK,
        sendQuery: true,
        queryParameters: {
          parameters: [
            { name: 'pattern', value: "={{ $json.Regex_Anuncio ?? '' }}" },
          ],
        },
        options: {
          response: {
            response: { fullResponse: false, neverError: true, responseFormat: 'json' },
          },
          timeout: 15000,
        },
      },
    });
    console.log('✓ Fix 8a: nodo Meta - Listar Ads (UI) agregado');
  } else {
    console.log('✓ Fix 8a: Meta - Listar Ads (UI) ya existía');
  }

  // 3. Actualizar Build Listar Ads Response
  const buildNode = nodeByName('Build Listar Ads Response');
  if (buildNode) {
    buildNode.parameters.jsCode = BUILD_LISTAR_ADS_CODE;
    console.log('✓ Fix 8a: Build Listar Ads Response actualizado para usar webhook response');
  } else {
    console.warn('⚠ Fix 8a: Build Listar Ads Response no encontrado');
  }

  // 4. Rewiring: GS Read → Extract Regex → Meta HTTP → Build → Respond
  const gsReadNode = nodeByName('GS Read For Listar Ads');
  const respondNode = nodeByName('Respond Listar Ads');

  if (gsReadNode) {
    const gsName = gsReadNode.name;
    // GS Read → Extract Regex (replace whatever it was pointing to)
    conns[gsName] = { main: [[{ node: 'Extract Regex para Listar Ads', type: 'main', index: 0 }]] };
  }
  conns['Extract Regex para Listar Ads'] = { main: [[{ node: 'Meta - Listar Ads (UI)', type: 'main', index: 0 }]] };
  conns['Meta - Listar Ads (UI)']        = { main: [[{ node: 'Build Listar Ads Response', type: 'main', index: 0 }]] };
  console.log('✓ Fix 8a: GS Read → Extract Regex → Meta Listar Ads (UI) → Build → Respond');

  // ── PUT ──────────────────────────────────────────────────────────────────
  const payload = {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  };
  console.log(`\n📤 Subiendo UI Management (${nodes.length} nodos)...`);
  const put = await api('PUT', `/api/v1/workflows/${WF_ID}`, payload);
  if (put.s !== 200) {
    console.error('PUT error:', JSON.stringify(put.b).slice(0, 600));
    process.exit(1);
  }
  console.log('✅ UI Management actualizado\n');

  // ── Verificación ─────────────────────────────────────────────────────────
  const verify = await api('GET', `/api/v1/workflows/${WF_ID}`);
  const vn = verify.b.nodes;
  console.log('── Verificación ──────────────────────────────────');
  console.log('Fix 8a Extract Regex:', !!vn.find(n => n.name === 'Extract Regex para Listar Ads'));
  console.log('Fix 8a Meta HTTP (UI):', !!vn.find(n => n.name === 'Meta - Listar Ads (UI)'));
  const buildCode = vn.find(n => n.name === 'Build Listar Ads Response')?.parameters?.jsCode ?? '';
  console.log('Fix 8a Build actualizado:', buildCode.includes('webhook') || buildCode.includes('data.map'));
  const altaCode = vn.find(n => n.name === 'Prepare Alta Row')?.parameters?.jsCode ?? '';
  console.log('Fix 8b Alta sin Ad_ID:', !altaCode.includes("Ad_ID:"));
  console.log('──────────────────────────────────────────────────');
}

main().catch(e => { console.error(e); process.exit(1); });
