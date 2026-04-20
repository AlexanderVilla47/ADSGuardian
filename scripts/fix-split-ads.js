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

// Fixed Split Ads code: use $json (current item) instead of $input.first() (always first item)
const SPLIT_ADS_CODE = `const contract = $('Expand Vencidos').item.json;
const ads = $json?.data ?? [];
if (ads.length === 0) return [];
return ads.map(ad => ({
  json: {
    Contrato_ID:   contract.Contrato_ID,
    Regex_Anuncio: contract.Regex_Anuncio,
    regex_pattern: contract.Regex_Anuncio,
    Fecha_Fin:     contract.Fecha_Fin,
    Ad_ID:         String(ad.id   ?? ''),
    Ad_Name:       String(ad.name ?? ''),
    Ad_Status:     String(ad.effective_status ?? ad.status ?? '').toUpperCase(),
  }
}));`;

async function main() {
  const wf = (await api('GET', '/api/v1/workflows/8mlwAxLtJVrwpLhi')).b;
  const nodes = wf.nodes;

  const splitNode = nodes.find(n => n.name === 'Split Ads por Contrato');
  if (!splitNode) { console.error('Nodo no encontrado'); process.exit(1); }

  console.log('Antes:', splitNode.parameters.jsCode.slice(0, 80));
  splitNode.parameters.jsCode = SPLIT_ADS_CODE;
  console.log('Después:', splitNode.parameters.jsCode.slice(0, 80));

  const payload = {
    name: wf.name, nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  };
  const r = await api('PUT', '/api/v1/workflows/8mlwAxLtJVrwpLhi', payload);
  console.log('PUT status:', r.s);
  if (r.s !== 200) console.error(JSON.stringify(r.b).slice(0, 400));
  else console.log('✅ Split Ads por Contrato corregido — usa $json en vez de $input.first()');
}

main().catch(e => { console.error(e); process.exit(1); });
