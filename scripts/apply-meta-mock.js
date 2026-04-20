/**
 * apply-meta-mock.js
 *
 * 1. Deploy del workflow adskiller-meta-mock-gsheet.json a n8n
 * 2. Patch de F1 (listar_ads branch) para llamar al mock de list-ads
 *    en lugar de leer directo desde GS Contratos
 *
 * Usage:
 *   N8N_API_KEY=<key> node scripts/apply-meta-mock.js
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const N8N_BASE = 'http://168.138.125.21:5678';
const N8N_KEY  = process.env.N8N_API_KEY;
const F1_ID    = 'cFBr6GavlSWDsUFz';

const MOCK_WF_PATH = path.join(__dirname, '..', 'workflows', 'adskiller-meta-mock-gsheet.json');
const BACKUP_DIR   = path.join(__dirname, '..', 'workflows', 'backups');

// ─── HTTP helper ────────────────────────────────────────────────────────────────

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

// ─── Step 1: Deploy mock workflow ──────────────────────────────────────────────

async function deployMockWorkflow() {
  console.log('\n📦 Leyendo workflow mock...');
  const raw = fs.readFileSync(MOCK_WF_PATH, 'utf8');
  const wfDef = JSON.parse(raw);

  // Check if workflow already exists
  console.log('🔍 Verificando si ya existe el workflow mock...');
  const listRes = await apiRequest('GET', '/api/v1/workflows?limit=100');
  const existing = (listRes.body?.data || []).find(w => w.name === wfDef.name);

  let wfId;
  if (existing) {
    console.log(`   → Existe (id: ${existing.id}), actualizando...`);
    wfId = existing.id;
    const full = await apiRequest('GET', `/api/v1/workflows/${wfId}`);
    const payload = {
      ...wfDef,
      id: wfId,
      settings: stripSettings(full.body.settings || {}),
    };
    const upRes = await apiRequest('PUT', `/api/v1/workflows/${wfId}`, payload);
    if (upRes.status !== 200) {
      console.error('ERROR actualizando:', upRes.body);
      process.exit(1);
    }
  } else {
    console.log('   → Creando nuevo workflow...');
    const createRes = await apiRequest('POST', '/api/v1/workflows', wfDef);
    if (createRes.status !== 200 && createRes.status !== 201) {
      console.error('ERROR creando:', createRes.body);
      process.exit(1);
    }
    wfId = createRes.body.id;
  }

  // Activate
  console.log(`   → Activando workflow ${wfId}...`);
  const actRes = await apiRequest('POST', `/api/v1/workflows/${wfId}/activate`);
  if (actRes.status !== 200) {
    console.warn('   ⚠️  No se pudo activar automáticamente — activalo manualmente en n8n');
  } else {
    console.log('   → ✅ Activo');
  }

  return wfId;
}

// ─── Step 2: Patch F1 listar_ads ───────────────────────────────────────────────

async function patchF1ListarAds() {
  console.log('\n🔧 Obteniendo F1 workflow...');
  const f1Res = await apiRequest('GET', `/api/v1/workflows/${F1_ID}`);
  if (f1Res.status !== 200) {
    console.error('ERROR obteniendo F1:', f1Res.body);
    process.exit(1);
  }
  const wf = f1Res.body;

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(BACKUP_DIR, `${F1_ID}-${stamp}-before-meta-mock-patch.json`);
  fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log(`   → Backup guardado en: ${path.relative(process.cwd(), backupPath)}`);

  const nodes = wf.nodes;

  // Find the GS Read For Listar Ads node and replace it with an HTTP Request
  const gsReadIdx = nodes.findIndex(n => n.name === 'GS Read For Listar Ads');
  if (gsReadIdx === -1) {
    console.error('ERROR: No se encontró el nodo "GS Read For Listar Ads" en F1');
    process.exit(1);
  }

  const gsReadNode = nodes[gsReadIdx];
  const oldNodeId  = gsReadNode.id;
  const position   = gsReadNode.position;

  // Replace with HTTP Request node that calls the mock
  const httpNode = {
    id:          oldNodeId,   // keep same id so connections stay valid
    name:        'GS Read For Listar Ads',  // keep same name so connections stay valid
    type:        'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position,
    parameters: {
      method:  'GET',
      url:     'http://168.138.125.21:5678/webhook/adskiller-meta-list-ads',
      sendQuery: true,
      queryParameters: {
        parameters: [
          {
            name:  'pattern',
            value: "={{ $('Validate Input').item.json.Regex_Anuncio ?? '' }}",
          },
        ],
      },
      options: {
        response: {
          response: {
            fullResponse:   false,
            neverError:     true,
            responseFormat: 'json',
          },
        },
        timeout: 30000,
      },
    },
  };

  nodes[gsReadIdx] = httpNode;

  // Also patch the "Build Listar Ads Response" code node to handle Meta mock format
  const buildIdx = nodes.findIndex(n => n.name === 'Build Listar Ads Response');
  if (buildIdx !== -1) {
    nodes[buildIdx].parameters.jsCode = `// Response from Meta mock: { data: [{id, name, status, effective_status, campaign_name}], paging: {...} }
const req      = $items('Validate Input', 0, 0)[0].json;
const idContrato = String(req.Contrato_ID || req.contract_id || '').trim();
const mockBody = $input.first()?.json ?? {};
const rawAds   = mockBody.data ?? [];

const ads = rawAds.map(ad => ({
  ad_id:         String(ad.id   ?? ''),
  ad_name:       String(ad.name ?? ''),
  ad_status:     String(ad.effective_status ?? ad.status ?? 'UNKNOWN').toUpperCase(),
  campaign_name: String(ad.campaign_name ?? ''),
})).filter(a => a.ad_id);

return [{ json: { contract_id: idContrato, total: ads.length, items: ads } }];`;
    console.log('   → Nodo "Build Listar Ads Response" parcheado');
  }

  // PUT updated workflow
  console.log('   → Subiendo F1 actualizado...');
  const payload = {
    name:        wf.name,
    nodes:       wf.nodes,
    connections: wf.connections,
    settings:    stripSettings(wf.settings || {}),
    staticData:  wf.staticData,
  };

  const putRes = await apiRequest('PUT', `/api/v1/workflows/${F1_ID}`, payload);
  if (putRes.status !== 200) {
    console.error('ERROR actualizando F1:', JSON.stringify(putRes.body, null, 2).slice(0, 500));
    process.exit(1);
  }
  console.log('   → ✅ F1 actualizado');
}

// ─── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  if (!N8N_KEY) { console.error('ERROR: N8N_API_KEY env var is required'); process.exit(1); }

  console.log('🚀 AdsKiller - Deploy Meta Mock + Patch F1');
  console.log('==========================================');

  const mockWfId = await deployMockWorkflow();
  await patchF1ListarAds();

  console.log('\n✅ Todo listo. Resumen:');
  console.log(`   · Mock workflow desplegado: ${mockWfId}`);
  console.log(`   · Webhooks activos:`);
  console.log(`       Precheck: GET /webhook/adskiller-local-meta-precheck/meta/precheck/:adId`);
  console.log(`       Pause:    GET /webhook/adskiller-local-meta-pause/meta/pause/:adId`);
  console.log(`       List:     GET /webhook/adskiller-meta-list-ads?pattern=<regex>`);
  console.log(`   · F1 listar_ads ahora llama al mock en lugar de leer GS Contratos`);
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Correr populate-mock-ads.js si no lo hiciste todavía');
  console.log('   2. Asignar Ad_IDs del mapa (docs/mock-ads-influencer-map.json) a contratos de test en GS');
  console.log('   3. Testear: curl http://168.138.125.21:5678/webhook/adskiller-local-meta-precheck/meta/precheck/AD-0001');
}

main().catch(err => { console.error(err); process.exit(1); });
