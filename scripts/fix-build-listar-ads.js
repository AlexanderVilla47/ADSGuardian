/**
 * fix-build-listar-ads.js
 *
 * Corrige Build Listar Ads Response:
 * El mock devuelve { statusCode, body: { data: [...] } }
 * Con fullResponse:false, el httpRequest entrega ese objeto como json.
 * La versión anterior leía json.data (inexistente) → devolvía [].
 * Fix: leer json.body.data con fallback a json.data.
 */
const http = require('http');
const KEY   = process.env.N8N_API_KEY;
const WF_ID = 'cFBr6GavlSWDsUFz';

if (!KEY) { console.error('N8N_API_KEY requerida'); process.exit(1); }

function api(method, p, body) {
  return new Promise((res, rej) => {
    const bs = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '168.138.125.21', port: 5678, path: p, method,
      headers: { 'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}) },
    }, r => {
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

// Código corregido del nodo Build Listar Ads Response
// El mock devuelve el envelope { statusCode, body: { data: [...] } }
// Con fullResponse:false n8n pone ese objeto entero en json
// → datos en json.body.data, con fallback a json.data
const FIXED_CODE = [
  "// Recibe respuesta del webhook ak-meta-list-v1",
  "const req = $('Normalize Request').first()?.json ?? {};",
  "const idContrato = String(",
  "  req.Contrato_ID ||",
  "  req.contract_id ||",
  "  req.body?.Contrato_ID ||",
  "  req.body?.contract_id ||",
  "  ''",
  ").trim();",
  "// El mock devuelve { statusCode, body: { data: [...] } }",
  "// Con fullResponse:false el body entero es json → datos en json.body.data",
  "const rawJson = $input.first()?.json ?? {};",
  "const data = rawJson.body?.data ?? rawJson.data ?? [];",
  "",
  "return [{",
  "  json: {",
  "    ok: true,",
  "    action: 'listar_ads',",
  "    data: {",
  "      contract_id: idContrato,",
  "      total: data.length,",
  "      ads: data.map(ad => ({",
  "        ad_id:     String(ad.id   ?? ''),",
  "        ad_name:   String(ad.name ?? ''),",
  "        ad_status: String(ad.effective_status ?? ad.status ?? 'UNKNOWN').toUpperCase(),",
  "      })),",
  "    },",
  "    meta: {",
  "      correlation_id: req.correlation_id ?? '',",
  "      timestamp: new Date().toISOString(),",
  "    },",
  "  }",
  "}];",
].join('\n');

(async () => {
  const r = await api('GET', '/api/v1/workflows/' + WF_ID);
  const wf = r.b;
  const n = wf.nodes.find(x => x.name === 'Build Listar Ads Response');
  if (!n) { console.error('Nodo no encontrado'); process.exit(1); }

  console.log('Código anterior (línea data):');
  console.log(' ', (n.parameters.jsCode.split('\n').find(l => l.includes('const data')) ?? '(no encontrada)'));

  n.parameters.jsCode = FIXED_CODE;

  const put = await api('PUT', '/api/v1/workflows/' + WF_ID, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  });
  console.log('PUT:', put.s);
  if (put.s !== 200) { console.error(JSON.stringify(put.b).slice(0, 300)); process.exit(1); }

  const v = await api('GET', '/api/v1/workflows/' + WF_ID);
  const vn = v.b.nodes.find(x => x.name === 'Build Listar Ads Response');
  const code = vn.parameters.jsCode;

  console.log('✅ Verificación:');
  console.log('  body?.data OK:', code.includes('body?.data'));
  console.log('  $input OK:    ', code.includes('$input.first'));
  console.log('  línea data:  ', code.split('\n').find(l => l.includes('const data')));
})().catch(e => { console.error(e); process.exit(1); });
