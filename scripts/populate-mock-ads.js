/**
 * populate-mock-ads.js
 *
 * Lee el CSV de ads, genera filas con ad_id + status=ACTIVE y las escribe
 * en la hoja "Mock_Ads" del GS existente.
 *
 * Estrategia: crea un workflow temporal en n8n con los datos embebidos en un
 * Code node, luego lo ejecuta via API y lo elimina.
 *
 * Usage:
 *   N8N_API_KEY=<key> node scripts/populate-mock-ads.js
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const N8N_BASE  = 'http://168.138.125.21:5678';
const N8N_KEY   = process.env.N8N_API_KEY;
const GS_ID     = '1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY';
const GS_CRED   = 'BtY3uGIkB5umd39o';  // Google Service Account account
const CSV_PATH  = path.join(__dirname, '..', 'docs', 'adsetAd-separado-sinFechas - Sheet8 (1).csv');
const SHEET_NAME = 'Mock_Ads';

// ─── HTTP helper ────────────────────────────────────────────────────────────────

function apiRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u    = new URL(N8N_BASE + urlPath);
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

// ─── CSV parsing ────────────────────────────────────────────────────────────────

function parseCampaign(name) {
  // Format V: V004_LATAM__Un Momento con Jesús_faridieck_...
  if (/^[VIO]\d+_/.test(name)) {
    const parts = name.split('_');
    // Find the part after REGION (LATAM/ES/etc.) and optional date
    for (let i = 2; i < parts.length; i++) {
      const p = parts[i];
      if (p && !/^\d{6}$/.test(p) && p.length > 2) return p.trim();
    }
  }
  // Format ES: ES-Influencer-Padre Matías-Child Loss-43s-...
  if (name.startsWith('ES-') || name.startsWith('Theme-')) {
    const parts = name.split('-');
    return parts[3]?.trim() || parts[2]?.trim() || 'Evergreen';
  }
  return 'General';
}

function parseRows() {
  const raw  = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];
  let idx = 1;
  for (const line of lines) {
    if (line === 'ad' || line.startsWith('ad,')) continue; // skip header
    const adName = line.replace(/^"|"$/g, '').trim();
    if (!adName) continue;
    const adId   = `AD-${String(idx).padStart(4, '0')}`;
    rows.push({
      ad_id:         adId,
      ad_name:       adName,
      status:        'ACTIVE',
      campaign_name: parseCampaign(adName),
    });
    idx++;
  }
  return rows;
}

// ─── n8n helpers ───────────────────────────────────────────────────────────────

function stripSettings(raw) {
  const ALLOWED = ['executionOrder','saveManualExecutions','saveDataSuccessExecution',
    'saveDataErrorExecution','saveExecutionProgress','executionTimeout','timezone'];
  const s = {};
  for (const k of ALLOWED) if (raw[k] !== undefined) s[k] = raw[k];
  return s;
}

// ─── Build temp populate workflow (webhook-based) ──────────────────────────────
// Strategy:
//   Webhook → Code (build values matrix) → GS Clear (1x) → HTTP Request (batch write ALL rows in 1 API call) → Respond
//
// Why HTTP Request instead of GS Append:
//   - GS Append processes 1 item at a time → 1333 API calls → rate limits + slow
//   - Sheets API values.append accepts a 2D array → writes ALL rows in 1 call
//   - Auth: predefinedCredentialType + googleApi (same service account)

const POPULATE_WEBHOOK_PATH = 'adskiller-mock-ads-populate-temp';

function buildPopulateWorkflow() {
  const sheetApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GS_ID}/values/${SHEET_NAME}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  return {
    name: 'TEMP - Populate Mock_Ads',
    nodes: [
      {
        id: 'wh-trigger',
        name: 'Populate Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: 'POST',
          path: POPULATE_WEBHOOK_PATH,
          responseMode: 'responseNode',
          options: {},
        },
        webhookId: 'adskiller-mock-ads-populate-temp',
      },
      {
        id: 'build-matrix',
        name: 'Build Values Matrix',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [220, 0],
        parameters: {
          jsCode: [
            'const rows = $json.body?.rows ?? $json.rows ?? [];',
            'const headers = ["ad_id", "ad_name", "status", "campaign_name"];',
            'const values = [headers, ...rows.map(r => [r.ad_id, r.ad_name, r.status, r.campaign_name])];',
            'return [{ json: { values, count: rows.length } }];',
          ].join('\n'),
        },
      },
      {
        id: 'gs-clear',
        name: 'GS - Clear Mock_Ads',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5,
        position: [440, 0],
        parameters: {
          authentication: 'serviceAccount',
          resource: 'sheet',
          operation: 'clear',
          documentId: { __rl: true, value: GS_ID, mode: 'id' },
          sheetName: { __rl: true, value: SHEET_NAME, mode: 'name' },
          clearType: 'values',
          options: {},
        },
        credentials: { googleApi: { id: GS_CRED, name: 'Google Service Account account' } },
      },
      {
        id: 'gs-batch-write',
        name: 'GS - Batch Write All Rows',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [660, 0],
        parameters: {
          method: 'POST',
          url: sheetApiUrl,
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'googleApi',
          sendBody: true,
          contentType: 'raw',
          rawContentType: 'application/json',
          body: '={{ JSON.stringify({ values: $json.values }) }}',
          options: { timeout: 60000 },
        },
        credentials: { googleApi: { id: GS_CRED, name: 'Google Service Account account' } },
      },
      {
        id: 'respond',
        name: 'Respond OK',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1.1,
        position: [880, 0],
        parameters: {
          respondWith: 'json',
          responseBody: '={{ { ok: true, count: $json.count ?? 0 } }}',
          options: { responseCode: 200 },
        },
      },
    ],
    connections: {
      'Populate Webhook':        { main: [[{ node: 'Build Values Matrix',      type: 'main', index: 0 }]] },
      'Build Values Matrix':     { main: [[{ node: 'GS - Clear Mock_Ads',      type: 'main', index: 0 }]] },
      'GS - Clear Mock_Ads':     { main: [[{ node: 'GS - Batch Write All Rows', type: 'main', index: 0 }]] },
      'GS - Batch Write All Rows': { main: [[{ node: 'Respond OK',             type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1' },
    staticData: null,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!N8N_KEY) { console.error('ERROR: N8N_API_KEY env var is required'); process.exit(1); }

  console.log('📋 Leyendo CSV...');
  const rows = parseRows();
  console.log(`   → ${rows.length} ads generados`);

  // Show influencer distribution
  const handles = ['faridieck','fathermatiasjurado','camilaplata81','hallowapp','padrerorro','manualparaenamorarse'];
  for (const h of handles) {
    const count = rows.filter(r => r.ad_name.toLowerCase().includes(h)).length;
    if (count > 0) console.log(`   · ${h}: ${count} ads`);
  }

  console.log('\n🔧 Creando workflow temporal en n8n...');
  const wfDef = buildPopulateWorkflow();
  const createRes = await apiRequest('POST', '/api/v1/workflows', wfDef);
  if (createRes.status !== 200 && createRes.status !== 201) {
    console.error('ERROR creando workflow:', createRes.body);
    process.exit(1);
  }
  const wfId = createRes.body.id;
  console.log(`   → Workflow creado: ${wfId}`);

  // Activate so the webhook is live
  console.log('   → Activando webhook...');
  const actRes = await apiRequest('POST', `/api/v1/workflows/${wfId}/activate`);
  if (actRes.status !== 200) {
    console.error('ERROR activando workflow:', actRes.body);
    await apiRequest('DELETE', `/api/v1/workflows/${wfId}`);
    process.exit(1);
  }
  console.log('   → Activo. Esperando 2s para que el webhook esté listo...');
  await new Promise(r => setTimeout(r, 2000));

  // POST all rows to the webhook
  console.log(`\n▶️  Enviando ${rows.length} rows al webhook (puede tardar ~30s)...`);
  const webhookUrl = `${N8N_BASE}/webhook/${POPULATE_WEBHOOK_PATH}`;
  const webhookU = new URL(webhookUrl);
  const bodyStr = JSON.stringify({ rows });
  const webhookResult = await new Promise((resolve, reject) => {
    const opts = {
      hostname: webhookU.hostname, port: webhookU.port || 80,
      path: webhookU.pathname, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      timeout: 120000,
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
    req.on('timeout', () => { req.destroy(); reject(new Error('Webhook request timed out after 120s')); });
    req.write(bodyStr);
    req.end();
  });

  if (webhookResult.status !== 200) {
    console.error('ERROR en webhook:', webhookResult.body);
  } else {
    console.log(`   → ✅ Respuesta: ok=${webhookResult.body.ok}, count=${webhookResult.body.count}`);
  }

  // Deactivate + delete the temp workflow
  console.log('\n🗑️  Desactivando y eliminando workflow temporal...');
  await apiRequest('POST', `/api/v1/workflows/${wfId}/deactivate`);
  await apiRequest('DELETE', `/api/v1/workflows/${wfId}`);
  console.log('   → Eliminado');

  console.log(`\n✅ Listo. Hoja "Mock_Ads" en GS populada con ${rows.length} ads.`);
  console.log(`   URL: https://docs.google.com/spreadsheets/d/${GS_ID}`);

  // Generate influencer → ad_ids mapping file for test reference
  const mapping = {};
  for (const row of rows) {
    const nameLower = row.ad_name.toLowerCase();
    for (const h of handles) {
      if (nameLower.includes(h)) {
        if (!mapping[h]) mapping[h] = [];
        mapping[h].push(row.ad_id);
      }
    }
  }
  const mapPath = path.join(__dirname, '..', 'docs', 'mock-ads-influencer-map.json');
  fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
  console.log(`\n📎 Mapa influencer → ad_ids guardado en: docs/mock-ads-influencer-map.json`);
  console.log('   Usá estos ad_ids en los contratos de test para que F2 funcione con el mock.');
}

main().catch(err => { console.error(err); process.exit(1); });
