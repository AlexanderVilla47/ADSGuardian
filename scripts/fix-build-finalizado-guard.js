// Fix: Build Finalizado Payload must NOT finalize when action is pause_ad
// This covers ALL paths (Killswitch_Engine AND old manual pause path)

const fs = require('fs');
const path = require('path');
const http = require('http');

const N8N_KEY = process.env.N8N_API_KEY || '__REDACTED_N8N_API_KEY__';
const F2_ID = '8mlwAxLtJVrwpLhi';
const F2_PATH = path.join(__dirname, '..', 'workflows', 'contract-guard-daily-killswitch.json');

const ALLOWED_SETTINGS = ['executionOrder','callerPolicy','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','saveExecutionProgress','timezone','errorWorkflow'];

// Fetch fresh from runtime
function apiGet(urlPath) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '168.138.125.21.nip.io', port: 5678, path: urlPath, method: 'GET',
      headers: { 'X-N8N-API-KEY': N8N_KEY }};
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

function apiPut(urlPath, body) {
  return new Promise((resolve, reject) => {
    const bs = JSON.stringify(body);
    const opts = { hostname: '168.138.125.21.nip.io', port: 5678, path: urlPath, method: 'PUT',
      headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bs) }};
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', reject);
    req.write(bs);
    req.end();
  });
}

async function main() {
  console.log('Fetching F2 from runtime...');
  const wf = await apiGet(`/api/v1/workflows/${F2_ID}`);

  // Fix Build Finalizado Payload — skip finalization for pause_ad
  const bfp = wf.nodes.find(n => n.name === 'Build Finalizado Payload');
  const oldCode = bfp.parameters.jsCode;
  console.log('\nOld Build Finalizado Payload:');
  console.log('  Sets Finalizado unconditionally:', oldCode.includes("Status_Contrato: 'Finalizado'"));

  bfp.parameters.jsCode =
"function getNodeJson(name, idx) {\n" +
"  try {\n" +
"    return $item(idx).$node[name].json || {};\n" +
"  } catch (_) {\n" +
"    return {};\n" +
"  }\n" +
"}\n" +
"\n" +
"const nowIso = $now.setZone('America/Argentina/Buenos_Aires').toISO();\n" +
"const inputItems = $input.all();\n" +
"\n" +
"return inputItems.map((inputItem, idx) => {\n" +
"  const merged = {\n" +
"    ...getNodeJson('Expand Vencidos', idx),\n" +
"    ...getNodeJson('Init Retry Pausa', idx),\n" +
"    ...(inputItem.json || {})\n" +
"  };\n" +
"\n" +
"  const contratoId = String(merged.Contrato_ID || '').trim();\n" +
"  const action = String(merged.action || '').toLowerCase();\n" +
"\n" +
"  // pause_ad = single ad pause, do NOT finalize the contract\n" +
"  if (action === 'pause_ad') {\n" +
"    return { json: { ...merged, Contrato_ID: contratoId, _skip_finalization: true } };\n" +
"  }\n" +
"\n" +
"  return {\n" +
"    json: {\n" +
"      ...merged,\n" +
"      Contrato_ID: contratoId,\n" +
"      Status_Contrato: 'Finalizado',\n" +
"      Fecha_Finalizacion: nowIso,\n" +
"      Updated_At: nowIso\n" +
"    }\n" +
"  };\n" +
"});";

  // Also update Finalizado Payload Valido to reject _skip_finalization
  const fpv = wf.nodes.find(n => n.name === 'Finalizado Payload Valido');
  fpv.parameters.conditions.string = [
    { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'failed' },
    { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'list_failed' },
    { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'ad_paused' },
    { value1: '={{String($json._skip_finalization || \'\')}}', operation: 'notEqual', value2: 'true' },
    { value1: '={{String($json.Contrato_ID || \'\').trim()}}', operation: 'notEmpty' },
  ];

  // Save local
  fs.writeFileSync(F2_PATH, JSON.stringify(wf, null, 2), 'utf-8');
  console.log('Saved local.');

  // Deploy
  const settings = {};
  for (const k of ALLOWED_SETTINGS) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  console.log('Deploying...');
  const result = await apiPut(`/api/v1/workflows/${F2_ID}`, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings, staticData: wf.staticData || null,
  });

  if (result.status === 200) {
    console.log('Deployed F2:', result.body.nodes.length, 'nodes');

    // Verify
    const bfpV = result.body.nodes.find(n => n.name === 'Build Finalizado Payload');
    console.log('\nVerification:');
    console.log('  Has pause_ad guard:', bfpV.parameters.jsCode.includes("action === 'pause_ad'"));
    console.log('  Has _skip_finalization:', bfpV.parameters.jsCode.includes('_skip_finalization'));

    const fpvV = result.body.nodes.find(n => n.name === 'Finalizado Payload Valido');
    console.log('  FPV rejects _skip_finalization:', fpvV.parameters.conditions.string.some(c => c.value2 === 'true' && c.value1.includes('_skip_finalization')));
    console.log('  FPV rejects ad_paused:', fpvV.parameters.conditions.string.some(c => c.value2 === 'ad_paused'));
  } else {
    console.error('DEPLOY FAILED:', result.status, JSON.stringify(result.body).slice(0, 300));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
