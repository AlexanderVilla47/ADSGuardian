/**
 * fix-f2.js
 *
 * Aplica los 3 fixes al workflow F2 (8mlwAxLtJVrwpLhi):
 *   Fix 1: diffDays <= 0  (vencidos de hoy se procesan)
 *   Fix 2: URLs de alerta apuntan a /webhook/ops-reporting-alerts
 *   Fix 3: Agrega Meta-Listar-Ads + Split Ads, rewire, elimina getNodeJson back-refs
 *
 * Usage: N8N_API_KEY=<key> node scripts/fix-f2.js
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const N8N_BASE = 'http://168.138.125.21:5678';
const N8N_KEY  = process.env.N8N_API_KEY;
const F2_ID    = '8mlwAxLtJVrwpLhi';
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');

// ─── HTTP helper ────────────────────────────────────────────────────────────

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(N8N_BASE + urlPath);
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search, method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };
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
  const ALLOWED = ['executionOrder','saveManualExecutions','saveDataSuccessExecution',
    'saveDataErrorExecution','saveExecutionProgress','executionTimeout','timezone'];
  const s = {};
  for (const k of ALLOWED) if (raw[k] !== undefined) s[k] = raw[k];
  return s;
}

// ─── Fix 1: Clasificar Contratos — diffDays <= 0 ───────────────────────────

function applyFix1(nodes) {
  const n = nodes.find(x => x.name === 'Clasificar Contratos (Activo / 48h / Vencido)');
  if (!n) { console.error('  ✗ No se encontró "Clasificar Contratos (Activo / 48h / Vencido)"'); process.exit(1); }
  const before = n.parameters.jsCode;
  const after  = before.replace('const isExpired = diffDays < 0;', 'const isExpired = diffDays <= 0;');
  if (before === after) {
    console.warn('  ⚠  Fix 1: no se encontró la línea exacta — verificá el código del nodo');
  } else {
    n.parameters.jsCode = after;
    console.log('  ✓ Fix 1: diffDays <= 0 aplicado');
  }
}

// ─── Fix 2: URLs de alerta ──────────────────────────────────────────────────

const OLD_ALERT_URL = 'http://168.138.125.21.nip.io:5678/webhook/mock/alerts';
const NEW_ALERT_URL = 'http://168.138.125.21:5678/webhook/ops-reporting-alerts';

function applyFix2(nodes) {
  let count = 0;
  for (const n of nodes) {
    if (n.type !== 'n8n-nodes-base.httpRequest') continue;
    const url = n.parameters?.url ?? '';
    if (url.includes('/webhook/mock/alerts') || url.includes('nip.io')) {
      n.parameters.url = url.replace(/http:\/\/168\.138\.125\.21\.nip\.io:5678\/webhook\/mock\/alerts/g, NEW_ALERT_URL)
                            .replace(/http:\/\/168\.138\.125\.21:5678\/webhook\/mock\/alerts/g, NEW_ALERT_URL);
      console.log(`  ✓ Fix 2: URL de alerta corregida en nodo "${n.name}"`);
      count++;
    }
  }
  if (count === 0) {
    console.warn('  ⚠  Fix 2: no se encontraron nodos con la URL antigua de alertas');
  }
}

// ─── Fix 3: Agregar Meta-Listar-Ads + Split Ads, rewire, fix code nodes ────

function applyFix3(wf) {
  const nodes = wf.nodes;
  const conns = wf.connections;

  // -- 3a: Agregar nodo "Meta - Listar Ads" (HTTP Request) --
  const listAdsNode = {
    id: 'meta-listar-ads',
    name: 'Meta - Listar Ads',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1200, 300],
    parameters: {
      method: 'GET',
      url: 'http://168.138.125.21:5678/webhook/ak-meta-list-v1',
      sendQuery: true,
      queryParameters: {
        parameters: [
          { name: 'pattern', value: "={{ $json.Regex_Anuncio ?? '' }}" },
        ],
      },
      options: {
        response: {
          response: {
            fullResponse: false,
            neverError: true,
            responseFormat: 'json',
          },
        },
        timeout: 30000,
      },
    },
  };

  // -- 3b: Agregar nodo "Split Ads por Contrato" (Code) --
  const splitAdsCode = [
    "const contract = $('Expand Vencidos').item.json;",
    "const ads = $input.first().json?.data ?? [];",
    "if (ads.length === 0) return [];",
    "return ads.map(ad => ({",
    "  json: {",
    "    Contrato_ID:   contract.Contrato_ID,",
    "    Regex_Anuncio: contract.Regex_Anuncio,",
    "    regex_pattern: contract.Regex_Anuncio,",
    "    Fecha_Fin:     contract.Fecha_Fin,",
    "    Ad_ID:         String(ad.id   ?? ''),",
    "    Ad_Name:       String(ad.name ?? ''),",
    "    Ad_Status:     String(ad.effective_status ?? ad.status ?? '').toUpperCase(),",
    "  }",
    "}));",
  ].join('\n');

  const splitAdsNode = {
    id: 'split-ads-por-contrato',
    name: 'Split Ads por Contrato',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1420, 300],
    parameters: { jsCode: splitAdsCode },
  };

  // Add both nodes
  nodes.push(listAdsNode, splitAdsNode);
  console.log('  ✓ Fix 3: nodos "Meta - Listar Ads" y "Split Ads por Contrato" agregados');

  // -- 3c: Rewire connections --
  // Find "Expand Vencidos" → it currently points to "Regex Coincide con Nombre (Sheet)"
  // Change it to point to "Meta - Listar Ads"
  if (conns['Expand Vencidos']) {
    const expandConns = conns['Expand Vencidos'].main;
    let rewired = false;
    for (const outputs of expandConns) {
      for (let i = 0; i < outputs.length; i++) {
        if (outputs[i].node === 'Regex Coincide con Nombre (Sheet)') {
          outputs[i] = { node: 'Meta - Listar Ads', type: 'main', index: 0 };
          rewired = true;
        }
      }
    }
    if (!rewired) {
      console.warn('  ⚠  Fix 3: "Expand Vencidos" → "Regex Coincide con Nombre (Sheet)" no encontrada; revisá conexiones manualmente');
    } else {
      console.log('  ✓ Fix 3: "Expand Vencidos" → "Meta - Listar Ads" conectados');
    }
  } else {
    console.warn('  ⚠  Fix 3: nodo "Expand Vencidos" no tiene conexiones salientes registradas');
  }

  // Add: "Meta - Listar Ads" → "Split Ads por Contrato"
  conns['Meta - Listar Ads'] = { main: [[{ node: 'Split Ads por Contrato', type: 'main', index: 0 }]] };
  console.log('  ✓ Fix 3: "Meta - Listar Ads" → "Split Ads por Contrato" conectados');

  // Add: "Split Ads por Contrato" → "Init Retry Precheck"
  conns['Split Ads por Contrato'] = { main: [[{ node: 'Init Retry Precheck', type: 'main', index: 0 }]] };
  console.log('  ✓ Fix 3: "Split Ads por Contrato" → "Init Retry Precheck" conectados');

  // -- 3d: Update "Evaluar Precheck Meta" — remove getNodeJson back-refs --
  const evalNode = nodes.find(x => x.name === 'Evaluar Precheck Meta');
  if (evalNode) {
    const oldCode = evalNode.parameters.jsCode ?? '';
    // Replace the row = { ...getNodeJson('Expand Vencidos'...) } pattern
    // Use a regex that matches the multi-line block
    const newCode = oldCode.replace(
      /const row\s*=\s*\{[\s\S]*?getNodeJson\(['"]Expand Vencidos['"][\s\S]*?\};/,
      'const row = { ...(inputItem.json || {}) };'
    );
    if (newCode === oldCode) {
      console.warn('  ⚠  Fix 3: "Evaluar Precheck Meta" — patrón getNodeJson no encontrado, revisá manualmente');
    } else {
      evalNode.parameters.jsCode = newCode;
      console.log('  ✓ Fix 3: "Evaluar Precheck Meta" — getNodeJson removido');
    }
  } else {
    console.warn('  ⚠  Fix 3: nodo "Evaluar Precheck Meta" no encontrado');
  }

  // -- 3e: Update "Build Finalizado Payload" — remove getNodeJson back-refs --
  const buildNode = nodes.find(x => x.name === 'Build Finalizado Payload');
  if (buildNode) {
    const oldCode = buildNode.parameters.jsCode ?? '';
    const newCode = oldCode.replace(
      /const merged\s*=\s*\{[\s\S]*?getNodeJson\(['"]Expand Vencidos['"][\s\S]*?\};/,
      'const merged = { ...(inputItem.json || {}) };'
    );
    if (newCode === oldCode) {
      console.warn('  ⚠  Fix 3: "Build Finalizado Payload" — patrón getNodeJson no encontrado, revisá manualmente');
    } else {
      buildNode.parameters.jsCode = newCode;
      console.log('  ✓ Fix 3: "Build Finalizado Payload" — getNodeJson removido');
    }
  } else {
    console.warn('  ⚠  Fix 3: nodo "Build Finalizado Payload" no encontrado');
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!N8N_KEY) { console.error('ERROR: N8N_API_KEY env var is required'); process.exit(1); }

  console.log('🔧 AdsKiller — Fix F2 (3 fixes)');
  console.log('=================================');

  // GET F2
  console.log('\n📥 Obteniendo workflow F2...');
  const getRes = await apiRequest('GET', `/api/v1/workflows/${F2_ID}`);
  if (getRes.status !== 200) {
    console.error('ERROR al obtener F2:', getRes.body);
    process.exit(1);
  }
  const wf = getRes.body;
  console.log(`   → ${wf.nodes.length} nodos, activo: ${wf.active}`);

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, `${F2_ID}-${stamp}-before-3fixes.json`);
  fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log(`   → Backup: workflows/backups/${path.basename(backupPath)}`);

  // Apply fixes
  console.log('\n🔨 Aplicando fixes...');
  applyFix1(wf.nodes);
  applyFix2(wf.nodes);
  applyFix3(wf);

  // PUT updated workflow
  console.log('\n📤 Subiendo F2 actualizado...');
  const payload = {
    name:        wf.name,
    nodes:       wf.nodes,
    connections: wf.connections,
    settings:    stripSettings(wf.settings || {}),
    staticData:  wf.staticData,
  };

  const putRes = await apiRequest('PUT', `/api/v1/workflows/${F2_ID}`, payload);
  if (putRes.status !== 200) {
    console.error('ERROR al actualizar F2:', JSON.stringify(putRes.body, null, 2).slice(0, 800));
    process.exit(1);
  }
  console.log('   → ✅ F2 actualizado correctamente');

  console.log('\n✅ Los 3 fixes aplicados. Próximos pasos:');
  console.log('   1. Verificar en n8n UI que los nodos nuevos estén conectados');
  console.log('   2. Crear/usar contrato con Fecha_Fin=hoy y Regex_Anuncio=faridieck');
  console.log('   3. Ejecutar F2 manualmente y verificar el flujo completo');
}

main().catch(err => { console.error(err); process.exit(1); });
