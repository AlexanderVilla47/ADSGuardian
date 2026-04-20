// Fix: Disconnect Evaluate_Rutear_Resultado_Pausa[out0] from Build Finalizado Payload
// Manual pause success should go to Build Operation Final Status (log only), NOT finalize
const http = require('http');
const fs = require('fs');
const path = require('path');

const N8N_KEY = '__REDACTED_N8N_API_KEY__';
const F2_ID = '8mlwAxLtJVrwpLhi';
const F2_PATH = path.join(__dirname, '..', 'workflows', 'contract-guard-daily-killswitch.json');
const ALLOWED = ['executionOrder','callerPolicy','saveManualExecutions','saveDataErrorExecution','saveDataSuccessExecution','saveExecutionProgress','timezone','errorWorkflow'];

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const bs = body ? JSON.stringify(body) : null;
    const opts = { hostname: '168.138.125.21.nip.io', port: 5678, path: urlPath, method,
      headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}) }};
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ s: res.statusCode, b: JSON.parse(d) }));
    });
    req.on('error', reject);
    if (bs) req.write(bs);
    req.end();
  });
}

async function main() {
  console.log('Fetching F2 from runtime...');
  const { b: wf } = await api('GET', `/api/v1/workflows/${F2_ID}`);

  const conns = wf.connections;

  // Rewire: Evaluate_Rutear_Resultado_Pausa[out0] → Build Operation Final Status (instead of Build Finalizado Payload)
  const errp = conns['Evaluate_Rutear_Resultado_Pausa'];
  console.log('\nBEFORE [out0]:', errp.main[0].map(d => d.node));

  errp.main[0] = [{ node: 'Build Operation Final Status', type: 'main', index: 0 }];

  console.log('AFTER  [out0]:', errp.main[0].map(d => d.node));
  console.log('  [out1] (retry):', errp.main[1].map(d => d.node));
  console.log('  [out2] (failed):', errp.main[2].map(d => d.node));

  // Save local
  fs.writeFileSync(F2_PATH, JSON.stringify(wf, null, 2), 'utf-8');

  // Deploy
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  console.log('\nDeploying...');
  const { s, b } = await api('PUT', `/api/v1/workflows/${F2_ID}`, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings, staticData: wf.staticData || null,
  });

  if (s === 200) {
    console.log('Deployed F2:', b.nodes.length, 'nodes');
    // Verify
    const newConns = b.connections['Evaluate_Rutear_Resultado_Pausa'];
    console.log('\nRuntime verification:');
    console.log('  [out0] success →', newConns.main[0].map(d => d.node));
    console.log('  [out1] retry   →', newConns.main[1].map(d => d.node));
    console.log('  [out2] failed  →', newConns.main[2].map(d => d.node));
    console.log('\n  Build Finalizado Payload DISCONNECTED from manual pause path:',
      !newConns.main[0].some(d => d.node === 'Build Finalizado Payload'));
  } else {
    console.error('FAIL:', s, JSON.stringify(b).slice(0, 300));
  }
}

main().catch(e => { console.error(e); process.exit(1); });
