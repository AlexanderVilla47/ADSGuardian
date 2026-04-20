/**
 * setup-test-contracts.js
 *
 * 1. Marca contratos AKF1-* como Finalizado en GS
 * 2. Crea 6 contratos de test que cubren todos los casos de F2
 * 3. Resetea ads de faridieck a ACTIVE en Mock_Ads
 * 4. Aplica fix diffDays=0 en F2 (else if)
 *
 * Casos de test cubiertos:
 *   A) Vencido pasado + ads ACTIVE       → debe finalizar
 *   B) Vence hoy (diffDays=0) + ads ACTIVE → debe finalizar (requiere fix)
 *   C) Vence en 2 días, sin notificar    → alerta 48h + Notificado_Previo=true
 *   D) Vence mañana, ya notificado       → ignorado
 *   E) Futuro (30+ días)                 → ignorado
 *   F) Vencido con pocos ads (2)         → finaliza con 2 ads
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const N8N_KEY    = process.env.N8N_API_KEY;
const N8N_BASE   = 'http://168.138.125.21:5678';
const GS_ID      = '1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY';
const GS_CRED    = 'BtY3uGIkB5umd39o';
const F2_ID      = '8mlwAxLtJVrwpLhi';
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');

// Today
const TODAY = '2026-04-16';

// Test contracts — 6 cases
const TEST_CONTRACTS = [
  {
    Contrato_ID:       'AK-TEST-A-FARIDIECK',
    Cliente:           'Test A — Faridieck (vencido pasado)',
    Regex_Anuncio:     'faridieck',
    Fecha_Alta:        '2026-03-01',
    Fecha_Fin:         '2026-04-10',   // vencido hace 6 días
    Status_Contrato:   'Activo',
    Notificado_Previo: 'FALSE',
    Ad_ID:             '',
    Ad_Name:           '',
    Updated_At:        '',
    _case:             'A: vencido pasado → debe finalizar',
  },
  {
    Contrato_ID:       'AK-TEST-B-FATHERM',
    Cliente:           'Test B — Father Matias (vence hoy)',
    Regex_Anuncio:     'fathermatiasjurado',
    Fecha_Alta:        '2026-03-01',
    Fecha_Fin:         TODAY,          // vence hoy (diffDays=0)
    Status_Contrato:   'Activo',
    Notificado_Previo: 'FALSE',
    Ad_ID:             '',
    Ad_Name:           '',
    Updated_At:        '',
    _case:             'B: diffDays=0 → debe finalizar (requiere fix else if)',
  },
  {
    Contrato_ID:       'AK-TEST-C-CAMILA',
    Cliente:           'Test C — Camila Plata (48h warning)',
    Regex_Anuncio:     'camilaplata81',
    Fecha_Alta:        '2026-03-01',
    Fecha_Fin:         '2026-04-18',   // vence en 2 días
    Status_Contrato:   'Activo',
    Notificado_Previo: 'FALSE',
    Ad_ID:             '',
    Ad_Name:           '',
    Updated_At:        '',
    _case:             'C: 48h → alerta operativa + Notificado_Previo=true',
  },
  {
    Contrato_ID:       'AK-TEST-D-HALLOW',
    Cliente:           'Test D — HallowApp (ya notificado)',
    Regex_Anuncio:     'hallowapp',
    Fecha_Alta:        '2026-03-01',
    Fecha_Fin:         '2026-04-17',   // vence mañana pero ya notificado
    Status_Contrato:   'Activo',
    Notificado_Previo: 'TRUE',
    Ad_ID:             '',
    Ad_Name:           '',
    Updated_At:        '',
    _case:             'D: 48h pero ya notificado → ignorado',
  },
  {
    Contrato_ID:       'AK-TEST-E-MANUAL',
    Cliente:           'Test E — Manual Para Enamorarse (futuro)',
    Regex_Anuncio:     'manualparaenamorarse',
    Fecha_Alta:        '2026-04-01',
    Fecha_Fin:         '2026-05-20',   // futuro
    Status_Contrato:   'Activo',
    Notificado_Previo: 'FALSE',
    Ad_ID:             '',
    Ad_Name:           '',
    Updated_At:        '',
    _case:             'E: futuro → ignorado completamente',
  },
  {
    Contrato_ID:       'AK-TEST-F-PADRER',
    Cliente:           'Test F — Padre Rorro (vencido, 2 ads)',
    Regex_Anuncio:     'padrerorro',
    Fecha_Alta:        '2026-03-01',
    Fecha_Fin:         '2026-04-14',   // vencido hace 2 días
    Status_Contrato:   'Activo',
    Notificado_Previo: 'FALSE',
    Ad_ID:             '',
    Ad_Name:           '',
    Updated_At:        '',
    _case:             'F: vencido, 2 ads → debe finalizar',
  },
];

const HEADERS = ['Contrato_ID','Cliente','Regex_Anuncio','Fecha_Alta','Fecha_Fin','Status_Contrato','Notificado_Previo','Ad_ID','Ad_Name','Updated_At'];

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u   = new URL(N8N_BASE + urlPath);
    const bs  = body ? JSON.stringify(body) : null;
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search, method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}),
      },
    };
    const req = lib.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, b: JSON.parse(d) }); } catch { resolve({ s: res.statusCode, b: d }); } });
    });
    req.on('error', reject);
    if (bs) req.write(bs);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const STRIP = ['executionOrder','saveManualExecutions','saveDataSuccessExecution','saveDataErrorExecution','saveExecutionProgress','executionTimeout','timezone'];
function stripSettings(raw) { const s = {}; for (const k of STRIP) if (raw[k] !== undefined) s[k] = raw[k]; return s; }

// ─── Step 1: Fix F2 diffDays=0 bug ──────────────────────────────────────────

async function fixF2DiffDays() {
  console.log('\n🔧 Fix F2: diffDays=0 (else if)...');
  const r = await apiRequest('GET', `/api/v1/workflows/${F2_ID}`);
  if (r.s !== 200) { console.error('GET error'); return; }
  const wf = r.b;

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.writeFileSync(path.join(BACKUP_DIR, `${F2_ID}-${stamp}-pre-diffdays-fix.json`), JSON.stringify(wf, null, 2));

  const cls = wf.nodes.find(n => n.name.includes('Clasificar'));
  if (!cls) { console.warn('  ⚠ Clasificar no encontrado'); return; }

  const before = cls.parameters.jsCode;
  // Fix: replace the two consecutive ifs with if/else if so expired takes priority over preventive
  const after = before.replace(
    "  if (isExpired) controlType = 'expired';\n  if (isPreventiveWindow && !alreadyNotified) controlType = 'preventive';",
    "  if (isExpired) controlType = 'expired';\n  else if (isPreventiveWindow && !alreadyNotified) controlType = 'preventive';"
  );

  if (before === after) {
    console.log('  ✓ Fix ya aplicado (else if ya estaba)');
  } else {
    cls.parameters.jsCode = after;
    const put = await apiRequest('PUT', `/api/v1/workflows/${F2_ID}`, {
      name: wf.name, nodes: wf.nodes, connections: wf.connections,
      settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
    });
    if (put.s === 200) console.log('  ✓ diffDays=0 fix aplicado (else if)');
    else console.error('  ✗ PUT error:', JSON.stringify(put.b).slice(0,200));
  }
}

// ─── Step 2: GS operations via temp n8n workflow ────────────────────────────

async function runGsOperations() {
  console.log('\n📊 Preparando operaciones GS (contratos + Mock_Ads reset)...');

  // Build the JS code for the Code node that will do everything
  const oldContractIds = ['AKF1-20260412211820','AKF1-CHK-20260412211957','AKF1-CLOSE-20260412212029','AK-2026-04-15-4GKJ','AK-2026-04-15-M4QP'];
  const newRows = TEST_CONTRACTS.map(c => HEADERS.map(h => c[h] ?? ''));
  const headerRow = HEADERS;

  const wfDef = {
    name: 'TEMP - Setup Test Contracts',
    nodes: [
      {
        id: 'wh', name: 'Webhook', type: 'n8n-nodes-base.webhook',
        typeVersion: 2, position: [0, 0],
        parameters: { httpMethod: 'POST', path: 'ak-setup-test-contracts', responseMode: 'responseNode', options: {} },
        webhookId: 'ak-setup-test-contracts',
      },
      {
        id: 'read-contracts', name: 'Read Contratos', type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5, position: [220, 0],
        parameters: {
          authentication: 'serviceAccount', resource: 'sheet', operation: 'read',
          documentId: { __rl: true, value: GS_ID, mode: 'id' },
          sheetName: { __rl: true, value: 'Contratos', mode: 'name' },
          options: {},
        },
        credentials: { googleApi: { id: GS_CRED, name: 'Google Service Account account' } },
      },
      {
        id: 'mark-old-finalizado', name: 'Mark Old Finalizado', type: 'n8n-nodes-base.code',
        typeVersion: 2, position: [440, 0],
        parameters: {
          jsCode: `
const oldIds = ${JSON.stringify(oldContractIds)};
const rows = $input.all();
const toUpdate = rows.filter(item => oldIds.includes(item.json.Contrato_ID));
return toUpdate.map(item => ({ json: { ...item.json, Status_Contrato: 'Finalizado', Updated_At: new Date().toISOString() } }));
          `.trim(),
        },
      },
      {
        id: 'gs-update-old', name: 'GS Update Old Contracts', type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5, position: [660, 0],
        parameters: {
          authentication: 'serviceAccount', resource: 'sheet', operation: 'update',
          documentId: { __rl: true, value: GS_ID, mode: 'id' },
          sheetName: { __rl: true, value: 'Contratos', mode: 'name' },
          columns: {
            mappingMode: 'defineBelow',
            value: { Contrato_ID: '={{ $json.Contrato_ID }}', Status_Contrato: 'Finalizado', Updated_At: '={{ $json.Updated_At }}' },
            matchingColumns: ['Contrato_ID'],
            schema: [
              { id: 'Contrato_ID', displayName: 'Contrato_ID', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
              { id: 'Status_Contrato', displayName: 'Status_Contrato', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
              { id: 'Updated_At', displayName: 'Updated_At', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
            ],
          },
          options: {},
        },
        credentials: { googleApi: { id: GS_CRED, name: 'Google Service Account account' } },
      },
      {
        id: 'build-new', name: 'Build New Contracts', type: 'n8n-nodes-base.code',
        typeVersion: 2, position: [880, 0],
        parameters: {
          jsCode: `
const newRows = ${JSON.stringify(newRows)};
const headers = ${JSON.stringify(headerRow)};
return newRows.map(row => {
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);
  return { json: obj };
});
          `.trim(),
        },
      },
      {
        id: 'gs-append-new', name: 'GS Append New Contracts', type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5, position: [1100, 0],
        parameters: {
          authentication: 'serviceAccount', resource: 'sheet', operation: 'append',
          documentId: { __rl: true, value: GS_ID, mode: 'id' },
          sheetName: { __rl: true, value: 'Contratos', mode: 'name' },
          columns: {
            mappingMode: 'defineBelow',
            value: Object.fromEntries(HEADERS.map(h => [h, `={{ $json.${h} }}`])),
            matchingColumns: [],
            schema: HEADERS.map(h => ({ id: h, displayName: h, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false })),
          },
          options: {},
        },
        credentials: { googleApi: { id: GS_CRED, name: 'Google Service Account account' } },
      },
      {
        id: 'reset-faridieck', name: 'Reset Faridieck ACTIVE', type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5, position: [1100, 200],
        parameters: {
          authentication: 'serviceAccount', resource: 'sheet', operation: 'read',
          documentId: { __rl: true, value: GS_ID, mode: 'id' },
          sheetName: { __rl: true, value: 'Mock_Ads', mode: 'name' },
          filtersUI: { values: [{ lookupColumn: 'status', lookupValue: 'PAUSED' }] },
          options: {},
        },
        credentials: { googleApi: { id: GS_CRED, name: 'Google Service Account account' } },
      },
      {
        id: 'gs-reset-paused', name: 'GS Reset PAUSED to ACTIVE', type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5, position: [1320, 200],
        parameters: {
          authentication: 'serviceAccount', resource: 'sheet', operation: 'update',
          documentId: { __rl: true, value: GS_ID, mode: 'id' },
          sheetName: { __rl: true, value: 'Mock_Ads', mode: 'name' },
          columns: {
            mappingMode: 'defineBelow',
            value: { ad_id: '={{ $json.ad_id }}', status: 'ACTIVE' },
            matchingColumns: ['ad_id'],
            schema: [
              { id: 'ad_id', displayName: 'ad_id', required: false, defaultMatch: true, display: true, type: 'string', canBeUsedToMatch: true },
              { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: false },
            ],
          },
          options: {},
        },
        credentials: { googleApi: { id: GS_CRED, name: 'Google Service Account account' } },
      },
      {
        id: 'respond', name: 'Respond', type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1, position: [1540, 0],
        parameters: { respondWith: 'json', responseBody: '={{ { ok: true } }}', options: { responseCode: 200 } },
      },
    ],
    connections: {
      'Webhook':                   { main: [[{ node: 'Read Contratos',          type: 'main', index: 0 }]] },
      'Read Contratos':            { main: [[{ node: 'Mark Old Finalizado',     type: 'main', index: 0 }],
                                            [{ node: 'Reset Faridieck ACTIVE',  type: 'main', index: 0 }]] },
      'Mark Old Finalizado':       { main: [[{ node: 'GS Update Old Contracts', type: 'main', index: 0 }]] },
      'GS Update Old Contracts':   { main: [[{ node: 'Build New Contracts',     type: 'main', index: 0 }]] },
      'Build New Contracts':       { main: [[{ node: 'GS Append New Contracts', type: 'main', index: 0 }]] },
      'GS Append New Contracts':   { main: [[{ node: 'Respond',                 type: 'main', index: 0 }]] },
      'Reset Faridieck ACTIVE':    { main: [[{ node: 'GS Reset PAUSED to ACTIVE', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1', saveDataSuccessExecution: 'all' },
    staticData: null,
  };

  // Create workflow
  const create = await apiRequest('POST', '/api/v1/workflows', wfDef);
  if (create.s !== 200 && create.s !== 201) { console.error('ERROR crear workflow:', create.b); return; }
  const wfId = create.b.id;
  console.log(`  → Workflow creado: ${wfId}`);

  // Activate
  const act = await apiRequest('POST', `/api/v1/workflows/${wfId}/activate`);
  if (act.s !== 200) { console.error('ERROR activar:', act.b); await apiRequest('DELETE', `/api/v1/workflows/${wfId}`); return; }
  console.log('  → Activo. Esperando 2s...');
  await sleep(2000);

  // Trigger
  const body = JSON.stringify({});
  const result = await new Promise((resolve, reject) => {
    const u = new URL(`${N8N_BASE}/webhook/ak-setup-test-contracts`);
    const opts = {
      hostname: u.hostname, port: u.port || 80, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 120000,
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ s: res.statusCode, b: JSON.parse(d) }); } catch { resolve({ s: res.statusCode, b: d }); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body); req.end();
  });

  console.log('  → Respuesta webhook:', result.s, JSON.stringify(result.b).slice(0, 100));

  // Cleanup
  await apiRequest('POST', `/api/v1/workflows/${wfId}/deactivate`);
  await apiRequest('DELETE', `/api/v1/workflows/${wfId}`);
  console.log('  → Workflow temporal eliminado');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!N8N_KEY) { console.error('ERROR: N8N_API_KEY requerida'); process.exit(1); }

  console.log('🚀 AdsKiller — Setup Test Contracts');
  console.log('=====================================');
  console.log('Casos de test a crear:');
  TEST_CONTRACTS.forEach(c => console.log(`  · ${c.Contrato_ID} | ${c.Fecha_Fin} | ${c._case}`));

  await fixF2DiffDays();
  await runGsOperations();

  console.log('\n✅ Listo. Resumen:');
  console.log('  · Contratos AKF1-* y AK-2026-04-15-* marcados como Finalizado en GS');
  console.log('  · 6 contratos de test creados en GS');
  console.log('  · Ads PAUSED en Mock_Ads reseteados a ACTIVE');
  console.log('  · F2: fix diffDays=0 aplicado (else if)');
  console.log('\n📋 Contratos de test:');
  TEST_CONTRACTS.forEach(c => console.log(`  · ${c.Contrato_ID} (${c.Fecha_Fin}) → ${c._case}`));
  console.log('\n▶️  Corré F2 y verificá cada caso.');
}

main().catch(e => { console.error(e); process.exit(1); });