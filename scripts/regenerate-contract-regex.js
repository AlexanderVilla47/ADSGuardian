/**
 * regenerate-contract-regex.js
 *
 * Regenera Regex_Anuncio para TODOS los contratos en Google Sheets
 * usando el algoritmo on-the-fly (idéntico al de Extract Regex para Listar Ads):
 *   - Sin backslashes: .{0,3} como separador flexible
 *   - normalize('NFD') para quitar tildes
 *   - Palabras ≥ 4 chars como patterns individuales
 *   - Nombre completo, primer+último, fuzzy, concat
 *
 * Crea un workflow temporal en n8n, lo ejecuta, muestra preview, y lo elimina.
 *
 * Uso:
 *   N8N_API_KEY=<token> node scripts/regenerate-contract-regex.js
 */

const http = require('http');
const KEY  = process.env.N8N_API_KEY;

if (!KEY) { console.error('N8N_API_KEY requerida'); process.exit(1); }

const GS_DOC_ID  = '1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY';
const GS_CRED_ID = 'BtY3uGIkB5umd39o';
const GS_SHEET   = 'Contratos';

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function api(method, p, body) {
  return new Promise((res, rej) => {
    const bs = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '168.138.125.21', port: 5678, path: p, method,
      headers: {
        'X-N8N-API-KEY': KEY,
        'Content-Type':  'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}),
      },
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { res({ s: r.statusCode, b: JSON.parse(d) }); }
        catch { res({ s: r.statusCode, b: d }); }
      });
    });
    req.on('error', rej);
    if (bs) req.write(bs);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Algoritmo on-the-fly (mismo que el nodo n8n) ─────────────────────────────
// Lo duplicamos acá para el preview local antes de subir.
function buildRegexLocal(nombreRaw) {
  if (!nombreRaw || !String(nombreRaw).trim()) return '';
  const clean = String(nombreRaw)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(w => w.length >= 4);
  if (words.length === 0) return clean.replace(/\s+/g, '');
  const patterns = [];
  if (words.length === 1) {
    patterns.push(words[0]);
  } else {
    patterns.push(words.join('.{0,3}'));
    if (words.length === 3) patterns.push(words[0] + '.{0,3}' + words[2]);
    patterns.push(words[0] + '.{0,8}' + words[words.length-1].slice(0, 4));
    patterns.push(words.join(''));
  }
  return [...new Set(patterns)].join('|');
}

// ─── Código del nodo Code en n8n ──────────────────────────────────────────────
const CODE_GENERATE_REGEX = [
  'function buildRegex(nombreRaw) {',
  '  if (!nombreRaw || !String(nombreRaw).trim()) return \'\';',
  '  const clean = String(nombreRaw)',
  '    .normalize(\'NFD\').replace(/[\\u0300-\\u036f]/g, \'\')',
  '    .toLowerCase().replace(/[^a-z0-9\\s]/g, \'\').trim();',
  '  const words = clean.split(/\\s+/).filter(w => w.length >= 4);',
  '  if (words.length === 0) return clean.replace(/\\s+/g, \'\');',
  '  const patterns = [];',
  '  if (words.length === 1) {',
  '    patterns.push(words[0]);',
  '  } else {',
  '    patterns.push(words.join(\'.{0,3}\'));',
  '    if (words.length === 3) patterns.push(words[0] + \'.{0,3}\' + words[2]);',
  '    patterns.push(words[0] + \'.{0,8}\' + words[words.length-1].slice(0, 4));',
  '    patterns.push(words.join(\'\'));',
  '  }',
  '  return [...new Set(patterns)].join(\'|\');',
  '}',
  '',
  'return $input.all().map(item => ({',
  '  json: {',
  '    ...item.json,',
  '    Regex_Anuncio: buildRegex(String(item.json.Cliente ?? \'\').trim()),',
  '  }',
  '}));',
].join('\n');

// ─── Definición del workflow temporal ─────────────────────────────────────────
// Usa webhook trigger con /webhook-test/ — no requiere activar el workflow.
// La llamada es síncrona: espera que toda la cadena termine y devuelve el resultado.
function buildTempWf(webhookPath) {
  return {
    name: '__tmp_regenerate_regex__',
    nodes: [
      {
        id: 'n-webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [0, 0],
        parameters: {
          httpMethod: 'POST',
          path: webhookPath,
          responseMode: 'responseNode',
          options: {},
        },
      },
      {
        id: 'n-read',
        name: 'GS Read Contratos',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5,
        position: [220, 0],
        credentials: {
          googleApi: { id: GS_CRED_ID, name: 'Google Service Account account' },
        },
        parameters: {
          authentication: 'serviceAccount',
          documentId: { __rl: true, value: GS_DOC_ID, mode: 'id' },
          sheetName:  { __rl: true, value: GS_SHEET,  mode: 'name' },
          options: {},
        },
      },
      {
        id: 'n-code',
        name: 'Generate Regex',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [440, 0],
        parameters: { jsCode: CODE_GENERATE_REGEX },
      },
      {
        id: 'n-update',
        name: 'GS Update Regex',
        type: 'n8n-nodes-base.googleSheets',
        typeVersion: 4.5,
        position: [660, 0],
        credentials: {
          googleApi: { id: GS_CRED_ID, name: 'Google Service Account account' },
        },
        parameters: {
          authentication: 'serviceAccount',
          operation:      'update',
          documentId: { __rl: true, value: GS_DOC_ID, mode: 'id' },
          sheetName:  { __rl: true, value: GS_SHEET,  mode: 'name' },
          columns: {
            mappingMode: 'defineBelow',
            value: {
              Contrato_ID:   '={{ $json.Contrato_ID }}',
              Regex_Anuncio: '={{ $json.Regex_Anuncio }}',
            },
          },
          matchingColumns: ['Contrato_ID'],
          options: {},
        },
      },
      {
        id: 'n-respond',
        name: 'Respond',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        position: [880, 0],
        parameters: {
          respondWith: 'json',
          responseBody: '={{ { ok: true, updated: $input.all().length, contracts: $input.all().map(i => ({ id: i.json.Contrato_ID, cliente: i.json.Cliente, regex: i.json.Regex_Anuncio })) } }}',
          options: {},
        },
      },
    ],
    connections: {
      'Webhook':           { main: [[{ node: 'GS Read Contratos', type: 'main', index: 0 }]] },
      'GS Read Contratos': { main: [[{ node: 'Generate Regex',    type: 'main', index: 0 }]] },
      'Generate Regex':    { main: [[{ node: 'GS Update Regex',   type: 'main', index: 0 }]] },
      'GS Update Regex':   { main: [[{ node: 'Respond',           type: 'main', index: 0 }]] },
    },
    settings: {},
    staticData: null,
  };
}

// ─── Llamada HTTP síncrona al webhook-test ────────────────────────────────────
function callWebhookTest(path) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ trigger: 'regen' });
    const req = http.request({
      hostname: '168.138.125.21', port: 5678,
      path: `/webhook/${path}`,
      method: 'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { res({ s: r.statusCode, b: JSON.parse(d) }); }
        catch { res({ s: r.statusCode, b: d }); }
      });
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Regenerando Regex_Anuncio en Google Sheets...\n');

  const webhookPath = `tmp-regen-regex-${Date.now()}`;
  const TEMP_WF = buildTempWf(webhookPath);

  // 1. Crear workflow temporal
  const create = await api('POST', '/api/v1/workflows', TEMP_WF);
  if (create.s !== 200) {
    console.error('Error creando workflow temporal:', JSON.stringify(create.b).slice(0, 400));
    process.exit(1);
  }
  const wfId = create.b.id;
  console.log(`✓ Workflow temporal creado: ${wfId}`);

  try {
    // 2. Activar el workflow (necesario para usar /webhook/ producción)
    const activate = await api('POST', `/api/v1/workflows/${wfId}/activate`, {});
    if (activate.s !== 200) {
      console.error('Error activando workflow:', JSON.stringify(activate.b).slice(0, 300));
      process.exit(1);
    }
    console.log(`✓ Workflow activado`);

    // Esperar que el webhook se registre en n8n (necesita varios segundos)
    await sleep(8000);

    // 3. Llamar al webhook de producción (síncrono — responseNode espera el flujo completo)
    console.log('  Ejecutando (puede tardar 10-30s según cantidad de contratos)...');
    const result = await callWebhookTest(webhookPath);  // misma función, cambia solo el path abajo

    if (result.s !== 200) {
      console.error(`❌ Webhook respondió HTTP ${result.s}:`, JSON.stringify(result.b).slice(0, 400));
      process.exit(1);
    }

    const data = result.b;

    if (data.ok) {
      console.log(`\n✅ Contratos actualizados: ${data.updated}`);
      console.log('\nRegex generados:');
      (data.contracts ?? []).forEach(c => {
        const id      = String(c.id      ?? '').padEnd(24);
        const cliente = String(c.cliente ?? '(sin cliente)').padEnd(22);
        const regex   = String(c.regex   ?? '(vacío)');
        console.log(`  ${id} ${cliente} → ${regex.slice(0, 80)}`);
      });
    } else {
      console.error('❌ Respuesta inesperada:', JSON.stringify(data).slice(0, 400));
    }

  } finally {
    // 4. Desactivar + eliminar workflow temporal (siempre)
    await api('POST', `/api/v1/workflows/${wfId}/deactivate`, {});
    const del = await api('DELETE', `/api/v1/workflows/${wfId}`);
    console.log(`\n✓ Workflow temporal eliminado (HTTP ${del.s})`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
