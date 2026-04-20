/**
 * patch-killswitch-engine.js
 *
 * Modifica F2 (contract-guard-daily-killswitch) para reemplazar el path
 * SplitInBatches roto con un Killswitch_Engine Code node que procesa ads
 * secuencialmente con await real.
 *
 * También:
 *  - Fix F1: Should Dispatch F2 usa $json.payload.action (no $json.action)
 *  - Fix Mock: Pause - Respond usa body correcto
 *
 * Usage:
 *   N8N_API_KEY=<key> node scripts/patch-killswitch-engine.js
 *
 * Sin API key: solo modifica archivos locales (--local-only)
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_KEY  = process.env.N8N_API_KEY;
const N8N_BASE = 'http://168.138.125.21.nip.io:5678';
const ROOT     = path.join(__dirname, '..');

const LOCAL_ONLY = process.argv.includes('--local-only') || !N8N_KEY;

const F2_ID   = '8mlwAxLtJVrwpLhi';
const F1_ID   = 'cFBr6GavlSWDsUFz';
const MOCK_ID = 'JwVHYsLLnoVMgvyI';

const BACKUP_SRC_F2 = path.join(ROOT, 'workflows', 'backups', '8mlwAxLtJVrwpLhi-20260418-030228-runtime-sync.json');
const OUT_F2  = path.join(ROOT, 'workflows', 'contract-guard-daily-killswitch.json');
const OUT_F1  = path.join(ROOT, 'workflows', 'contract-ui-management.json');
const OUT_MOCK = path.join(ROOT, 'workflows', 'adskiller-meta-mock-gsheet.json');

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u   = new URL(N8N_BASE + urlPath);
    const bs  = body ? JSON.stringify(body) : null;
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search, method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}),
      },
    };
    const req = lib.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ s: res.statusCode, b: JSON.parse(d) }); }
        catch { resolve({ s: res.statusCode, b: d }); }
      });
    });
    req.on('error', reject);
    if (bs) req.write(bs);
    req.end();
  });
}

const ALLOWED_SETTINGS = [
  'executionOrder','callerPolicy','saveManualExecutions',
  'saveDataErrorExecution','saveDataSuccessExecution',
  'saveExecutionProgress','timezone','errorWorkflow',
];
function filterSettings(raw) {
  const s = {};
  for (const k of ALLOWED_SETTINGS) if (raw && raw[k] !== undefined) s[k] = raw[k];
  return s;
}

function backup(wf, label) {
  const dir = path.join(ROOT, 'workflows', 'backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(dir, `${wf.id || label}-${stamp}-before-engine.json`);
  fs.writeFileSync(file, JSON.stringify(wf, null, 2));
  console.log(`  Backup: ${path.basename(file)}`);
}

// ─── F2 patch ─────────────────────────────────────────────────────────────────

const NODES_TO_REMOVE = new Set([
  'List_Ads_By_Regex',
  'Expand_Ads_Per_Contract',
  'SplitInBatches_Killswitch',
  'Wait_Between_Batches',
  'Route_By_Source',
  'Killswitch_Skip_Precheck',
  'Killswitch_Set_Precheck_OK',
  'Dedup_Por_Contrato',
]);

const KILLSWITCH_ENGINE_CODE = `const LIST_URL = 'http://168.138.125.21.nip.io:5678/webhook/ak-meta-list-v1';
const PAUSE_URL = 'http://168.138.125.21.nip.io:5678/webhook/adskiller-meta-pause';
const DELAY_MS = 300;

const results = [];

for (const item of $input.all()) {
  const contract = item.json;
  const pattern = (contract.Cliente || '')
    .toLowerCase().trim().split(/\\s+/).join('|');

  // 1. List active ads for this contract
  let ads = [];
  let listFailed = false;
  try {
    const listResp = await fetch(
      LIST_URL + '?pattern=' + encodeURIComponent(pattern)
        + '&contrato_id=' + encodeURIComponent(contract.Contrato_ID)
    );
    if (!listResp.ok) throw new Error('HTTP ' + listResp.status);
    const body = await listResp.json();
    const data = body.data || body;
    ads = (Array.isArray(data) ? data : [])
      .filter(ad => ad.status === 'ACTIVE' || ad.effective_status === 'ACTIVE');
  } catch (e) {
    listFailed = true;
    ads = [];
  }

  // 2. Pause each ad sequentially with real async delay
  let adsPaused = 0, adsFailed = 0;
  const adResults = [];

  for (const ad of ads) {
    try {
      const pauseResp = await fetch(PAUSE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ad_id: ad.id }),
      });
      if (!pauseResp.ok) throw new Error('HTTP ' + pauseResp.status);
      adsPaused++;
      adResults.push({ ad_id: ad.id, state: 'paused' });
    } catch (e) {
      adsFailed++;
      adResults.push({ ad_id: ad.id, state: 'failed', error: e.message });
    }
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  let pause_state;
  if (listFailed) {
    pause_state = 'list_failed';
  } else if (adsFailed === 0) {
    pause_state = adsPaused > 0 ? 'success' : 'no_active_ads';
  } else {
    pause_state = adsPaused > 0 ? 'partial' : 'failed';
  }

  results.push({ json: {
    ...contract,
    pause_state,
    ads_total: ads.length,
    ads_paused: adsPaused,
    ads_failed: adsFailed,
    ad_results: adResults,
    run_mode: 'killswitch',
    source: 'killswitch_daily',
  }});
}

return results;`;

function patchF2(wf) {
  const nodesMap = Object.fromEntries(wf.nodes.map(n => [n.name, n]));
  const evPos  = (nodesMap['Expand Vencidos']          || {}).position || [1000, 200];
  const bfpPos = (nodesMap['Build Finalizado Payload']  || {}).position || [1600, 200];
  const engineX = Math.round((evPos[0] + bfpPos[0]) / 2);
  const engineY = evPos[1];

  // 1. Remove 8 nodes
  const before = wf.nodes.length;
  wf.nodes = wf.nodes.filter(n => !NODES_TO_REMOVE.has(n.name));
  console.log(`  Nodes: ${before} → ${wf.nodes.length} (removed ${before - wf.nodes.length})`);

  // 2. Add Killswitch_Engine
  wf.nodes.push({
    id: 'killswitch-engine-v1',
    name: 'Killswitch_Engine',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [engineX, engineY],
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: KILLSWITCH_ENGINE_CODE,
    },
  });
  console.log(`  Added: Killswitch_Engine at [${engineX}, ${engineY}]`);

  // 3. Update connections
  const conns = wf.connections;

  // Remove connections involving removed nodes
  for (const removed of NODES_TO_REMOVE) {
    delete conns[removed];
  }
  for (const srcName of Object.keys(conns)) {
    for (let i = 0; i < (conns[srcName].main || []).length; i++) {
      if (conns[srcName].main[i]) {
        conns[srcName].main[i] = conns[srcName].main[i].filter(
          d => !NODES_TO_REMOVE.has(d.node)
        );
      }
    }
  }

  // Expand Vencidos → Killswitch_Engine
  if (!conns['Expand Vencidos']) conns['Expand Vencidos'] = { main: [[]] };
  conns['Expand Vencidos'].main[0] = [{ node: 'Killswitch_Engine', type: 'main', index: 0 }];
  console.log('  Rewired: Expand Vencidos → Killswitch_Engine');

  // Killswitch_Engine → Build Finalizado Payload
  conns['Killswitch_Engine'] = { main: [[{ node: 'Build Finalizado Payload', type: 'main', index: 0 }]] };
  console.log('  Created: Killswitch_Engine → Build Finalizado Payload');

  // Build Finalizado Payload → Finalizado Payload Valido (was via Dedup)
  if (!conns['Build Finalizado Payload']) conns['Build Finalizado Payload'] = { main: [[]] };
  if (!conns['Build Finalizado Payload'].main[0]) conns['Build Finalizado Payload'].main[0] = [];
  const bfpOut0 = conns['Build Finalizado Payload'].main[0];
  if (!bfpOut0.some(d => d.node === 'Finalizado Payload Valido')) {
    bfpOut0.push({ node: 'Finalizado Payload Valido', type: 'main', index: 0 });
    console.log('  Added: Build Finalizado Payload → Finalizado Payload Valido');
  }

  // 4. Fix Finalizado Payload Valido: reject failed AND list_failed
  for (const n of wf.nodes) {
    if (n.name === 'Finalizado Payload Valido') {
      n.parameters.conditions.string = [
        { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'failed' },
        { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'list_failed' },
        { value1: '={{String($json.Contrato_ID || \'\').trim()}}', operation: 'notEmpty' },
      ];
      console.log('  Fixed: Finalizado Payload Valido → pause_state != failed AND != list_failed');
      break;
    }
  }

  // Verify
  const nodeNames = new Set(wf.nodes.map(n => n.name));
  const path_nodes = ['Expand Vencidos', 'Killswitch_Engine', 'Build Finalizado Payload', 'Finalizado Payload Valido', 'Sheets - Marcar Finalizado'];
  console.log('  Path check:');
  for (const name of path_nodes) {
    console.log(`    ${nodeNames.has(name) ? 'OK' : 'MISSING'} ${name}`);
  }
  for (const name of NODES_TO_REMOVE) {
    if (nodeNames.has(name)) console.log(`    ERROR: ${name} still present!`);
  }

  return wf;
}

// ─── F1 patch ─────────────────────────────────────────────────────────────────

function patchF1(wf) {
  let fixed = false;
  for (const n of wf.nodes) {
    if (n.name === 'Should Dispatch F2') {
      const conds = n.parameters?.conditions?.string;
      if (conds) {
        for (const c of conds) {
          if (c.value1 === '={{$json.action}}') {
            c.value1 = '={{$json.payload.action}}';
            fixed = true;
            console.log('  Fixed: Should Dispatch F2 → $json.payload.action');
          }
        }
      }
      break;
    }
  }
  if (!fixed) console.log('  WARN: Should Dispatch F2 condition not found or already fixed');
  return wf;
}

// ─── Mock patch ───────────────────────────────────────────────────────────────

function patchMock(wf) {
  let fixed = false;
  for (const n of wf.nodes) {
    if (n.name === 'Pause - Respond') {
      if (n.parameters?.responseBody !== undefined) {
        n.parameters.responseBody = "={{ { success: true, id: $('Pause - Extract Ad ID').item.json.adId } }}";
        fixed = true;
        console.log('  Fixed: Pause - Respond responseBody → uses Pause - Extract Ad ID');
      }
      break;
    }
  }
  if (!fixed) console.log('  WARN: Pause - Respond not found or responseBody field missing');
  return wf;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('AdsKiller — Killswitch Engine Patch');
  console.log('=====================================');
  if (LOCAL_ONLY) {
    console.log('Mode: LOCAL ONLY (set N8N_API_KEY to also deploy)');
  } else {
    console.log('Mode: LOCAL + DEPLOY');
  }

  // ── F2 ──
  console.log('\n[F2] Patching contract-guard-daily-killswitch...');

  let f2wf;
  if (!LOCAL_ONLY) {
    console.log('  Fetching from runtime...');
    const r = await apiRequest('GET', `/api/v1/workflows/${F2_ID}`);
    if (r.s !== 200) { console.error('  ERROR fetching F2:', r.b); process.exit(1); }
    f2wf = r.b;
    backup(f2wf, F2_ID);
  } else {
    console.log(`  Loading from backup: ${path.basename(BACKUP_SRC_F2)}`);
    f2wf = JSON.parse(fs.readFileSync(BACKUP_SRC_F2, 'utf8'));
  }

  f2wf = patchF2(f2wf);
  fs.writeFileSync(OUT_F2, JSON.stringify(f2wf, null, 2));
  console.log(`  Saved local: ${path.basename(OUT_F2)} (${f2wf.nodes.length} nodes)`);

  if (!LOCAL_ONLY) {
    console.log('  Deploying F2...');
    const put = await apiRequest('PUT', `/api/v1/workflows/${F2_ID}`, {
      name: f2wf.name,
      nodes: f2wf.nodes,
      connections: f2wf.connections,
      settings: filterSettings(f2wf.settings),
      staticData: f2wf.staticData || null,
    });
    if (put.s === 200) {
      console.log(`  Deployed F2: ${put.b.nodes?.length} nodes`);
    } else {
      console.error('  ERROR deploying F2:', JSON.stringify(put.b).slice(0, 300));
    }
  }

  // ── F1 ──
  console.log('\n[F1] Patching contract-ui-management...');

  let f1wf;
  if (!LOCAL_ONLY) {
    const r = await apiRequest('GET', `/api/v1/workflows/${F1_ID}`);
    if (r.s !== 200) { console.error('  ERROR fetching F1:', r.b); }
    else {
      f1wf = r.b;
      backup(f1wf, F1_ID);
    }
  }
  if (!f1wf) {
    f1wf = JSON.parse(fs.readFileSync(OUT_F1, 'utf8'));
  }

  f1wf = patchF1(f1wf);
  fs.writeFileSync(OUT_F1, JSON.stringify(f1wf, null, 2));
  console.log(`  Saved local: ${path.basename(OUT_F1)}`);

  if (!LOCAL_ONLY && f1wf.id) {
    const put = await apiRequest('PUT', `/api/v1/workflows/${F1_ID}`, {
      name: f1wf.name,
      nodes: f1wf.nodes,
      connections: f1wf.connections,
      settings: filterSettings(f1wf.settings),
      staticData: f1wf.staticData || null,
    });
    if (put.s === 200) console.log(`  Deployed F1: ${put.b.nodes?.length} nodes`);
    else console.error('  ERROR deploying F1:', JSON.stringify(put.b).slice(0, 300));
  }

  // ── Mock ──
  console.log('\n[Mock] Patching adskiller-meta-mock-gsheet...');

  let mockWf;
  if (!LOCAL_ONLY) {
    const r = await apiRequest('GET', `/api/v1/workflows/${MOCK_ID}`);
    if (r.s !== 200) { console.error('  ERROR fetching Mock:', r.b); }
    else {
      mockWf = r.b;
      backup(mockWf, MOCK_ID);
    }
  }
  if (!mockWf) {
    mockWf = JSON.parse(fs.readFileSync(OUT_MOCK, 'utf8'));
  }

  mockWf = patchMock(mockWf);
  fs.writeFileSync(OUT_MOCK, JSON.stringify(mockWf, null, 2));
  console.log(`  Saved local: ${path.basename(OUT_MOCK)}`);

  if (!LOCAL_ONLY && mockWf.id) {
    const put = await apiRequest('PUT', `/api/v1/workflows/${MOCK_ID}`, {
      name: mockWf.name,
      nodes: mockWf.nodes,
      connections: mockWf.connections,
      settings: filterSettings(mockWf.settings),
      staticData: mockWf.staticData || null,
    });
    if (put.s === 200) console.log(`  Deployed Mock: ${put.b.nodes?.length} nodes`);
    else console.error('  ERROR deploying Mock:', JSON.stringify(put.b).slice(0, 300));
  }

  console.log('\nDone.');
  if (LOCAL_ONLY) {
    console.log('\nTo deploy: N8N_API_KEY=<key> node scripts/patch-killswitch-engine.js');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
