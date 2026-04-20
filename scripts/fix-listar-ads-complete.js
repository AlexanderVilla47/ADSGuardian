/**
 * fix-listar-ads-complete.js
 *
 * Reconstruye el flujo completo de "listar_ads" en contract-ui-management-v2.
 *
 * Problema actual:
 *   Route Action → GS Read For Listar Ads → Build Listar Ads Response (roto)
 *
 * Faltan dos nodos entre GS Read y Build Response:
 *   1. "Extract Regex para Listar Ads" (Code) — encuentra el contrato por ID,
 *      genera el regex on-the-fly desde Cliente (algoritmo accent-tolerant).
 *   2. "Meta - Listar Ads (UI)" (HTTP GET) — llama al mock con el regex.
 *
 * Flow resultante:
 *   GS Read For Listar Ads
 *     → Extract Regex para Listar Ads
 *       → Meta - Listar Ads (UI)
 *         → Build Listar Ads Response   ← código corregido para parsear mock
 *           → Respond Listar Ads
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

// ─── Código del nodo Extract Regex ────────────────────────────────────────────
const EXTRACT_REGEX_CODE = [
  "const req = $('Normalize Request').first()?.json ?? {};",
  "const idContrato = String(",
  "  req.Contrato_ID || req.contract_id ||",
  "  req.body?.Contrato_ID || req.body?.contract_id || ''",
  ").trim();",
  "",
  "const allRows = $input.all();",
  "const contract = allRows.find(item =>",
  "  String(item.json.Contrato_ID ?? '').trim() === idContrato",
  ");",
  "if (!contract) {",
  "  return [{ json: { ok: false, error: 'contrato_no_encontrado', contract_id: idContrato } }];",
  "}",
  "",
  "// Regex on-the-fly desde Cliente — accent-tolerant, sin palabras sueltas para nombres compuestos",
  "function buildRegex(nombreRaw) {",
  "  if (!nombreRaw || !String(nombreRaw).trim()) return '';",
  "  const clean = String(nombreRaw)",
  "    .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')",
  "    .toLowerCase().replace(/[^a-z0-9\\s]/g, '').trim();",
  "  const words = clean.split(/\\s+/).filter(w => w.length >= 4);",
  "  if (words.length === 0) return clean.replace(/\\s+/g, '');",
  "  function acc(w) {",
  "    return w.replace(/a/g,'[aá]').replace(/e/g,'[eé]')",
  "             .replace(/i/g,'[ií]').replace(/o/g,'[oó]')",
  "             .replace(/u/g,'[uú]').replace(/n/g,'[nñ]');",
  "  }",
  "  const patterns = [];",
  "  if (words.length === 1) {",
  "    patterns.push(acc(words[0]));",
  "  } else {",
  "    patterns.push(words.map(acc).join('.{0,3}'));",
  "    if (words.length === 3) patterns.push(acc(words[0]) + '.{0,3}' + acc(words[2]));",
  "    patterns.push(acc(words[0]) + '.{0,8}' + acc(words[words.length-1].slice(0, 4)));",
  "    patterns.push(words.join(''));",
  "  }",
  "  return [...new Set(patterns)].join('|');",
  "}",
  "",
  "const cliente = String(contract.json.Cliente ?? '').trim();",
  "const regex = buildRegex(cliente);",
  "",
  "return [{ json: {",
  "  Contrato_ID: idContrato,",
  "  Regex_Anuncio: regex,",
  "  Cliente: cliente,",
  "} }];",
].join('\n');

// ─── Código del nodo Build Listar Ads Response ────────────────────────────────
// Parsea la respuesta del mock: { statusCode, body: { data: [{id,name,status,...}] } }
// Devuelve { contract_id, total, ads } — Respond Listar Ads lo envuelve con data: $json
const BUILD_RESPONSE_CODE = [
  "const req = $('Normalize Request').first()?.json ?? {};",
  "const idContrato = String(",
  "  req.Contrato_ID || req.contract_id ||",
  "  req.body?.Contrato_ID || req.body?.contract_id || ''",
  ").trim();",
  "",
  "// El mock responde { statusCode, body: { data: [...] } }",
  "// Con fullResponse:false, n8n pone ese objeto entero en $input.first().json",
  "const rawJson = $input.first()?.json ?? {};",
  "const data = rawJson.body?.data ?? rawJson.data ?? [];",
  "",
  "return [{",
  "  json: {",
  "    contract_id: idContrato,",
  "    total: data.length,",
  "    ads: data.map(ad => ({",
  "      ad_id:         String(ad.id   ?? ''),",
  "      ad_name:       String(ad.name ?? ''),",
  "      ad_status:     String(ad.effective_status ?? ad.status ?? 'UNKNOWN').toUpperCase(),",
  "      campaign_name: String(ad.campaign_name ?? ''),",
  "    })),",
  "  }",
  "}];",
].join('\n');

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 Fix Listar Ads — reconstruyendo flujo completo');
  console.log('=================================================');

  const r = await api('GET', `/api/v1/workflows/${WF_ID}`);
  if (r.s !== 200) { console.error('GET error:', r.s); process.exit(1); }
  const wf = r.b;
  console.log(`✓ Workflow: "${wf.name}" (${wf.nodes.length} nodos)`);

  const nodes = wf.nodes;
  const conns = wf.connections;

  // ── 1. Actualizar/crear Extract Regex para Listar Ads ───────────────────────
  const extractName = 'Extract Regex para Listar Ads';
  const gsReadNode  = nodes.find(n => n.name === 'GS Read For Listar Ads');
  const buildNode   = nodes.find(n => n.name === 'Build Listar Ads Response');

  if (!gsReadNode) { console.error('❌ GS Read For Listar Ads no encontrado'); process.exit(1); }
  if (!buildNode)  { console.error('❌ Build Listar Ads Response no encontrado'); process.exit(1); }

  let extractNode = nodes.find(n => n.name === extractName);
  if (extractNode) {
    extractNode.parameters.jsCode = EXTRACT_REGEX_CODE;
    console.log(`✓ "${extractName}" — código actualizado`);
  } else {
    extractNode = {
      id:          'extract-regex-listar-ads',
      name:        extractName,
      type:        'n8n-nodes-base.code',
      typeVersion: 2,
      position:    [
        gsReadNode.position[0] + 220,
        gsReadNode.position[1],
      ],
      parameters: { jsCode: EXTRACT_REGEX_CODE },
    };
    nodes.push(extractNode);
    console.log(`✓ "${extractName}" — nodo creado`);
  }

  // ── 2. Actualizar/crear Meta - Listar Ads (UI) ──────────────────────────────
  const metaName = 'Meta - Listar Ads (UI)';
  let metaNode = nodes.find(n => n.name === metaName);
  if (metaNode) {
    // Actualizar parámetros
    metaNode.parameters = buildMetaParams();
    console.log(`✓ "${metaName}" — parámetros actualizados`);
  } else {
    metaNode = {
      id:          'meta-listar-ads-ui',
      name:        metaName,
      type:        'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position:    [
        extractNode.position[0] + 220,
        extractNode.position[1],
      ],
      parameters: buildMetaParams(),
    };
    nodes.push(metaNode);
    console.log(`✓ "${metaName}" — nodo creado`);
  }

  // ── 3. Actualizar Build Listar Ads Response ──────────────────────────────────
  buildNode.parameters.jsCode = BUILD_RESPONSE_CODE;
  buildNode.position = [
    metaNode.position[0] + 220,
    metaNode.position[1],
  ];
  console.log('✓ "Build Listar Ads Response" — código corregido');

  // ── 4. Rewiring conexiones ────────────────────────────────────────────────────
  // GS Read → Extract Regex
  conns['GS Read For Listar Ads'] = {
    main: [[{ node: extractName, type: 'main', index: 0 }]],
  };
  // Extract Regex → Meta HTTP
  conns[extractName] = {
    main: [[{ node: metaName, type: 'main', index: 0 }]],
  };
  // Meta HTTP → Build Response
  conns[metaName] = {
    main: [[{ node: 'Build Listar Ads Response', type: 'main', index: 0 }]],
  };
  // Build Response → Respond (ya existe, no tocar)
  console.log('✓ Conexiones actualizadas');

  // ── 5. PUT ──────────────────────────────────────────────────────────────────
  const payload = {
    name:        wf.name,
    nodes:       wf.nodes,
    connections: wf.connections,
    settings:    stripSettings(wf.settings || {}),
    staticData:  wf.staticData,
  };
  console.log(`\n📤 Subiendo (${nodes.length} nodos)...`);
  const put = await api('PUT', `/api/v1/workflows/${WF_ID}`, payload);
  if (put.s !== 200) {
    console.error('PUT error:', JSON.stringify(put.b).slice(0, 500));
    process.exit(1);
  }
  console.log('✅ Workflow actualizado\n');

  // ── 6. Verificación ──────────────────────────────────────────────────────────
  const v = await api('GET', `/api/v1/workflows/${WF_ID}`);
  const vn = v.b.nodes;
  const vc = v.b.connections;

  const hasExtract = !!vn.find(n => n.name === extractName);
  const hasMeta    = !!vn.find(n => n.name === metaName);
  const gsToExtract = vc['GS Read For Listar Ads']?.main?.[0]?.[0]?.node === extractName;
  const extractToMeta = vc[extractName]?.main?.[0]?.[0]?.node === metaName;
  const metaToBuild = vc[metaName]?.main?.[0]?.[0]?.node === 'Build Listar Ads Response';

  console.log('── Verificación ─────────────────────────────────────────────────');
  console.log(`  Extract Regex existe:    ${hasExtract}`);
  console.log(`  Meta HTTP existe:        ${hasMeta}`);
  console.log(`  GS Read → Extract:       ${gsToExtract}`);
  console.log(`  Extract → Meta HTTP:     ${extractToMeta}`);
  console.log(`  Meta HTTP → Build:       ${metaToBuild}`);
  console.log('─────────────────────────────────────────────────────────────────');
}

function buildMetaParams() {
  return {
    method: 'GET',
    url:    'http://168.138.125.21:5678/webhook/ak-meta-list-v1',
    sendQuery: true,
    queryParameters: {
      parameters: [
        { name: 'pattern', value: '={{ $json.Regex_Anuncio }}' },
      ],
    },
    options: {},
  };
}

main().catch(e => { console.error(e); process.exit(1); });
