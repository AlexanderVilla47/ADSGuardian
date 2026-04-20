/**
 * fix-f2-final.js
 *
 * Aplica TODOS los fixes a F2 en un solo GET → modify → PUT:
 *
 *   Fix 1: diffDays <= 0  (contratos que vencen hoy se procesan)
 *   Fix 2: URLs alerta → /webhook/ops-reporting-alerts (strings planos, sin =)
 *   Fix 3a: Precheck y Pause URLs = expresiones correctas con $json.Ad_ID
 *   Fix 4: Agrega nodos "Meta - Listar Ads" y "Split Ads por Contrato"
 *   Fix 5: Rewire Expand Vencidos → Meta - Listar Ads → Split Ads → Init Retry Precheck
 *   Fix 6: Split Ads usa $json (ítem actual) en vez de $input.first()
 *   Fix 7: Evaluar Precheck Meta y Build Finalizado Payload sin getNodeJson back-refs
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const N8N_KEY  = process.env.N8N_API_KEY;
const F2_ID    = '8mlwAxLtJVrwpLhi';
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

// ─── Node definitions ───────────────────────────────────────────────────────

const LIST_ADS_NODE = {
  id: 'meta-listar-ads',
  name: 'Meta - Listar Ads',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [1400, 500],
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
        response: { fullResponse: false, neverError: true, responseFormat: 'json' },
      },
      timeout: 30000,
    },
  },
};

// Fix 6: usa $json (ítem actual) en vez de $input.first() (siempre el primero)
const SPLIT_ADS_NODE = {
  id: 'split-ads-por-contrato',
  name: 'Split Ads por Contrato',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1620, 500],
  parameters: {
    jsCode: [
      "const contract = $('Expand Vencidos').item.json;",
      "const ads = $json?.data ?? [];",
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
    ].join('\n'),
  },
};

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!N8N_KEY) { console.error('ERROR: N8N_API_KEY requerida'); process.exit(1); }

  console.log('🔧 Fix F2 Final — GET → modify → PUT (un solo ciclo)');
  console.log('======================================================');

  const r = await api('GET', `/api/v1/workflows/${F2_ID}`);
  if (r.s !== 200) { console.error('ERROR GET:', r.b); process.exit(1); }
  const wf = r.b;
  console.log(`✓ Workflow obtenido: ${wf.nodes.length} nodos`);

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkp = path.join(BACKUP_DIR, `${F2_ID}-${stamp}-pre-final.json`);
  fs.writeFileSync(bkp, JSON.stringify(wf, null, 2));
  console.log(`✓ Backup: ${path.basename(bkp)}`);

  const nodes = wf.nodes;
  const conns = wf.connections;

  // ── Fix 1: diffDays <= 0 ───────────────────────────────────────────────
  const clsNode = nodes.find(n => n.name === 'Clasificar Contratos (Activo / 48h / Vencido)');
  if (clsNode) {
    const before = clsNode.parameters.jsCode;
    clsNode.parameters.jsCode = before.replace('const isExpired = diffDays < 0;', 'const isExpired = diffDays <= 0;');
    const applied = clsNode.parameters.jsCode !== before;
    console.log(applied ? '✓ Fix 1: diffDays <= 0' : '✓ Fix 1: ya aplicado (diffDays <= 0 ya estaba)');
  } else {
    console.warn('⚠ Fix 1: nodo Clasificar no encontrado');
  }

  // ── Fix 2 + 3a: URLs HTTP nodes ────────────────────────────────────────
  for (const n of nodes) {
    if (n.type !== 'n8n-nodes-base.httpRequest') continue;
    if (n.name === 'Meta - Precheck Estado Ad') {
      n.parameters.url = "={{ 'http://168.138.125.21:5678/webhook/ak-meta-precheck-v1/meta/precheck/' + $json.Ad_ID }}";
      console.log('✓ Fix 3a: Precheck URL expresión correcta');
    } else if (n.name === 'Meta - Pausar Ad') {
      n.parameters.url = "={{ 'http://168.138.125.21:5678/webhook/ak-meta-pause-v1/meta/pause/' + $json.Ad_ID }}";
      console.log('✓ Fix 3a: Pause URL expresión correcta');
    } else if (n.name === 'Emitir Alerta Operativa' || n.name.includes('lerta') && n.name.includes('tica')) {
      n.parameters.url = 'http://168.138.125.21:5678/webhook/ops-reporting-alerts';
      console.log(`✓ Fix 2: Alert URL plain: ${n.name}`);
    }
  }

  // ── Fix 4+5: Agregar nuevos nodos + rewire ─────────────────────────────

  // Remove existing instances if already there (avoid duplicates)
  const toRemove = ['Meta - Listar Ads', 'Split Ads por Contrato'];
  const cleaned = nodes.filter(n => !toRemove.includes(n.name));
  wf.nodes.splice(0, wf.nodes.length, ...cleaned);

  // Add fresh
  wf.nodes.push(LIST_ADS_NODE, SPLIT_ADS_NODE);
  console.log('✓ Fix 4: nodos Meta-Listar-Ads y Split-Ads agregados');

  // Rewire connections
  // Remove stale connection entries for these nodes
  delete conns['Meta - Listar Ads'];
  delete conns['Split Ads por Contrato'];

  // Expand Vencidos → Meta - Listar Ads (replacing whatever it pointed to)
  conns['Expand Vencidos'] = { main: [[{ node: 'Meta - Listar Ads', type: 'main', index: 0 }]] };
  // Meta - Listar Ads → Split Ads por Contrato
  conns['Meta - Listar Ads'] = { main: [[{ node: 'Split Ads por Contrato', type: 'main', index: 0 }]] };
  // Split Ads por Contrato → Init Retry Precheck
  conns['Split Ads por Contrato'] = { main: [[{ node: 'Init Retry Precheck', type: 'main', index: 0 }]] };
  console.log('✓ Fix 5: Expand Vencidos → Meta-Listar-Ads → Split-Ads → Init Retry Precheck');

  // ── Fix 7: Evaluar Precheck Meta — remove getNodeJson back-refs ────────
  const evalNode = wf.nodes.find(n => n.name === 'Evaluar Precheck Meta');
  if (evalNode) {
    const old = evalNode.parameters.jsCode;
    const updated = old.replace(
      /const row\s*=\s*\{[\s\S]*?getNodeJson\(['"](Expand Vencidos|Init Retry Precheck|Wait 5m Precheck Retry)['"][\s\S]*?\};/,
      'const row = { ...(inputItem.json || {}) };'
    );
    if (updated !== old) {
      evalNode.parameters.jsCode = updated;
      console.log('✓ Fix 7: Evaluar Precheck Meta — getNodeJson removido');
    } else {
      console.log('✓ Fix 7: Evaluar Precheck Meta — getNodeJson ya no estaba');
    }
  }

  const buildNode = wf.nodes.find(n => n.name === 'Build Finalizado Payload');
  if (buildNode) {
    const old = buildNode.parameters.jsCode;
    const updated = old.replace(
      /const merged\s*=\s*\{[\s\S]*?getNodeJson\(['"](Expand Vencidos|Init Retry Pausa)['"][\s\S]*?\};/,
      'const merged = { ...(inputItem.json || {}) };'
    );
    if (updated !== old) {
      buildNode.parameters.jsCode = updated;
      console.log('✓ Fix 7: Build Finalizado Payload — getNodeJson removido');
    } else {
      console.log('✓ Fix 7: Build Finalizado Payload — getNodeJson ya no estaba');
    }
  }

  // ── PUT ─────────────────────────────────────────────────────────────────
  const payload = {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  };
  console.log(`\n📤 Subiendo (${wf.nodes.length} nodos)...`);
  const put = await api('PUT', `/api/v1/workflows/${F2_ID}`, payload);
  if (put.s !== 200) {
    console.error('ERROR PUT:', JSON.stringify(put.b).slice(0, 600));
    process.exit(1);
  }
  console.log('✅ F2 actualizado correctamente');

  // ── Verify ──────────────────────────────────────────────────────────────
  const verify = await api('GET', `/api/v1/workflows/${F2_ID}`);
  const vNodes = verify.b.nodes;
  const vConns = verify.b.connections;
  console.log(`\n── Verificación (${vNodes.length} nodos) ──`);
  console.log('Fix 1 diffDays<=0:', vNodes.find(n=>n.name.includes('Clasificar'))?.parameters?.jsCode?.includes('diffDays <= 0'));
  console.log('Fix 2 alerta operativa:', vNodes.find(n=>n.name==='Emitir Alerta Operativa')?.parameters?.url);
  console.log('Fix 4 Meta-Listar-Ads:', !!vNodes.find(n=>n.name==='Meta - Listar Ads'));
  console.log('Fix 4 Split-Ads:', !!vNodes.find(n=>n.name==='Split Ads por Contrato'));
  console.log('Fix 5 Expand→:', vConns['Expand Vencidos']?.main?.[0]?.[0]?.node);
  console.log('Fix 5 Split→:', vConns['Split Ads por Contrato']?.main?.[0]?.[0]?.node);
  const splitCode = vNodes.find(n=>n.name==='Split Ads por Contrato')?.parameters?.jsCode;
  console.log('Fix 6 $json (no $input.first):', splitCode?.includes('$json?.data') && !splitCode?.includes('$input.first'));
}

main().catch(e => { console.error(e); process.exit(1); });
