const http = require('http');
const N8N_KEY = process.env.N8N_API_KEY;

function api(method, p, body) {
  return new Promise((res, rej) => {
    const u = new URL('http://168.138.125.21:5678' + p);
    const bs = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: u.hostname, port: u.port || 80,
      path: u.pathname + u.search, method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type': 'application/json',
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

async function main() {
  const wf = (await api('GET', '/api/v1/workflows/8mlwAxLtJVrwpLhi')).b;
  const nodes = wf.nodes;

  for (const n of nodes) {
    if (n.type !== 'n8n-nodes-base.httpRequest') continue;

    if (n.name === 'Meta - Precheck Estado Ad') {
      n.parameters.url = "={{ 'http://168.138.125.21:5678/webhook/ak-meta-precheck-v1/meta/precheck/' + $json.Ad_ID }}";
      console.log('✓ Precheck URL restored with $json.Ad_ID');
    } else if (n.name === 'Meta - Pausar Ad') {
      n.parameters.url = "={{ 'http://168.138.125.21:5678/webhook/ak-meta-pause-v1/meta/pause/' + $json.Ad_ID }}";
      console.log('✓ Pause URL restored with $json.Ad_ID');
    } else if (n.parameters.url && (n.parameters.url.includes('ops-reporting-alerts') || n.parameters.url.includes('mock/alerts') || n.parameters.url.startsWith('='))) {
      n.parameters.url = 'http://168.138.125.21:5678/webhook/ops-reporting-alerts';
      console.log('✓ Alert URL fixed (plain):', n.name);
    }
  }

  const payload = {
    name: wf.name, nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  };
  const r = await api('PUT', '/api/v1/workflows/8mlwAxLtJVrwpLhi', payload);
  console.log('PUT status:', r.s);

  // Final check
  const wf2 = (await api('GET', '/api/v1/workflows/8mlwAxLtJVrwpLhi')).b;
  console.log('\n--- URLs finales ---');
  wf2.nodes.filter(n => n.type === 'n8n-nodes-base.httpRequest')
    .forEach(n => console.log(' ', n.name, '->', n.parameters?.url));
}

main().catch(e => { console.error(e); process.exit(1); });
