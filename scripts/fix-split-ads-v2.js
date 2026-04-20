const http = require('http');
const fs   = require('fs');
const path = require('path');

const N8N_KEY    = process.env.N8N_API_KEY;
const F2_ID      = '8mlwAxLtJVrwpLhi';
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

// Correct code: runOnceForAllItems (n8n Code v2 default)
// $input.all() = respuestas de Meta - Listar Ads (una por contrato)
// $('Expand Vencidos').all() = contratos vencidos (mismo orden, pareados)
const NEW_CODE = `const inputItems = $input.all();
const contracts  = $('Expand Vencidos').all();

const result = [];
for (let i = 0; i < inputItems.length; i++) {
  const contract = contracts[i]?.json ?? {};
  const ads      = inputItems[i]?.json?.data ?? [];
  for (const ad of ads) {
    result.push({
      json: {
        Contrato_ID:   contract.Contrato_ID,
        Regex_Anuncio: contract.Regex_Anuncio,
        regex_pattern: contract.Regex_Anuncio,
        Fecha_Fin:     contract.Fecha_Fin,
        Ad_ID:         String(ad.id   ?? ''),
        Ad_Name:       String(ad.name ?? ''),
        Ad_Status:     String(ad.effective_status ?? ad.status ?? '').toUpperCase(),
      }
    });
  }
}
return result;`;

async function main() {
  const r = await api('GET', `/api/v1/workflows/${F2_ID}`);
  if (r.s !== 200) { console.error('GET error:', r.b); process.exit(1); }
  const wf = r.b;

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  fs.writeFileSync(path.join(BACKUP_DIR, `${F2_ID}-${stamp}-pre-splitfix.json`), JSON.stringify(wf, null, 2));

  const splitNode = wf.nodes.find(n => n.name === 'Split Ads por Contrato');
  if (!splitNode) { console.error('Nodo Split Ads por Contrato no encontrado'); process.exit(1); }

  splitNode.parameters.jsCode = NEW_CODE;
  console.log('✓ Código actualizado');

  const payload = {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  };
  const put = await api('PUT', `/api/v1/workflows/${F2_ID}`, payload);
  if (put.s !== 200) { console.error('PUT error:', JSON.stringify(put.b).slice(0, 400)); process.exit(1); }
  console.log('✅ F2 actualizado — Split Ads usa $input.all() (runOnceForAllItems)');
  console.log('   Ahora corré F2 y verificá que Split Ads produzca 15 ítems para faridieck');
}

main().catch(e => { console.error(e); process.exit(1); });