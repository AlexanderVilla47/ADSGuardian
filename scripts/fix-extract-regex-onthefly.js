/**
 * fix-extract-regex-onthefly.js
 *
 * Cambia "Extract Regex para Listar Ads" para generar el regex ON THE FLY
 * desde el campo Cliente del contrato, en lugar de leerlo del Sheet.
 *
 * Por qué: el regex con backslashes (\s, \-, [aá]) se corrompe en el
 * round-trip n8n → Google Sheets → n8n. Al generarlo dentro de n8n, el
 * string nunca toca el Sheet y no puede corromperse.
 *
 * Algoritmo nuevo (sin backslashes):
 *   - Normalizar nombre: quitar tildes, lowercase, solo [a-z0-9]
 *   - Palabras ≥ 4 chars como patterns individuales
 *   - Nombre completo con .{0,3} entre palabras (captura cualquier separador)
 *   - Primer + último nombre (salta segundo nombre en nombres de 3 palabras)
 *   - Fuzzy: primer.{0,8}primeras4delúltimo
 *   - Concatenación sin separador
 *
 * Ejemplo "Farid Dieck":
 *   farid|dieck|farid.{0,3}dieck|farid.{0,8}diec|fariddieck
 *
 * Ejemplo "Padre Pablo López":
 *   padre|pablo|lopez|padre.{0,3}pablo.{0,3}lopez|padre.{0,3}lopez|padre.{0,8}lope|padrepablolopez
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

// Nuevo código del nodo — sin backslashes, regex generado desde Cliente
const NEW_CODE = [
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
  "// Generar regex on-the-fly desde Cliente — nunca leer Regex_Anuncio del Sheet",
  "// Sin backslashes: .{0,3} como separador flexible, normalize() quita tildes",
  "function buildRegex(nombreRaw) {",
  "  if (!nombreRaw || !String(nombreRaw).trim()) return '';",
  "  const clean = String(nombreRaw)",
  "    .normalize('NFD')",
  "    .replace(/[\\u0300-\\u036f]/g, '')",
  "    .toLowerCase()",
  "    .replace(/[^a-z0-9\\s]/g, '')",
  "    .trim();",
  "  const words = clean.split(/\\s+/).filter(w => w.length >= 4);",
  "  if (words.length === 0) return clean.replace(/\\s+/g, '');",
  "  function acc(w) {",
  "    return w.replace(/a/g,'[aá]').replace(/e/g,'[eé]')",
  "             .replace(/i/g,'[ií]').replace(/o/g,'[oó]')",
  "             .replace(/u/g,'[uú]').replace(/n/g,'[nñ]');",
  "  }",
  "  const patterns = [];",
  "  if (words.length <= 2) {",
  "    // 1-2 palabras: individuales son suficientemente únicas",
  "    words.forEach(w => patterns.push(acc(w)));",
  "  }",
  "  if (words.length >= 2) {",
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
  "  Contrato_ID:   idContrato,",
  "  Regex_Anuncio: regex,",
  "  Cliente:       cliente,",
  "} }];",
].join('\n');

// Verificación local del algoritmo antes de subir
function buildRegexLocal(nombreRaw) {
  if (!nombreRaw || !String(nombreRaw).trim()) return '';
  const clean = String(nombreRaw)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const words = clean.split(/\s+/).filter(w => w.length >= 4);
  if (words.length === 0) return clean.replace(/\s+/g, '');
  function acc(w) {
    return w.replace(/a/g,'[aá]').replace(/e/g,'[eé]')
             .replace(/i/g,'[ií]').replace(/o/g,'[oó]')
             .replace(/u/g,'[uú]').replace(/n/g,'[nñ]');
  }
  const patterns = [];
  if (words.length <= 2) {
    words.forEach(w => patterns.push(acc(w)));
  }
  if (words.length >= 2) {
    patterns.push(words.map(acc).join('.{0,3}'));
    if (words.length === 3) patterns.push(acc(words[0]) + '.{0,3}' + acc(words[2]));
    patterns.push(acc(words[0]) + '.{0,8}' + acc(words[words.length-1].slice(0, 4)));
    patterns.push(words.join(''));
  }
  return [...new Set(patterns)].join('|');
}

console.log('── Verificación local del algoritmo ─────────────────────────────');
const tests = [
  { nombre: 'Farid Dieck',       ads: ['V004_LATAM__Un Momento con Jesús_faridieck_VOI', 'ES-Influencer-Farid Dieck-Evergreen-57s'] },
  { nombre: 'Padre Pablo López', ads: ['ES-Influencer-Padre Pablo López-60s-V1', 'Padre Lopez_Ads_Meta_01', 'padrepablolopez-video-ig'] },
  { nombre: 'Camila Plata',      ads: ['V008_LATAM__Psalms_camilaplata81', 'camilaplata-ig-2025'] },
];
for (const t of tests) {
  const regex = buildRegexLocal(t.nombre);
  console.log('\n' + t.nombre + ' → ' + regex);
  const re = new RegExp(regex, 'i');
  t.ads.forEach(ad => console.log('  ' + (re.test(ad) ? '✅' : '❌') + ' ' + ad.slice(0, 60)));
}
console.log('─────────────────────────────────────────────────────────────────\n');

(async () => {
  const r = await api('GET', '/api/v1/workflows/' + WF_ID);
  const wf = r.b;
  const n = wf.nodes.find(x => x.name === 'Extract Regex para Listar Ads');
  if (!n) { console.error('Nodo no encontrado'); process.exit(1); }

  n.parameters.jsCode = NEW_CODE;

  const put = await api('PUT', '/api/v1/workflows/' + WF_ID, {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  });
  console.log('PUT:', put.s);
  if (put.s !== 200) { console.error(JSON.stringify(put.b).slice(0, 300)); process.exit(1); }

  // Test end-to-end
  await new Promise(r => setTimeout(r, 800));
  const body = JSON.stringify({ action: 'listar_ads', contract_id: 'AK-2026-04-17-QXGJ' });
  const req2 = http.request({
    hostname: '168.138.125.21', port: 5678,
    path: '/webhook/contract-ui-management-v2',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, r2 => {
    let d = ''; r2.on('data', c => d += c);
    r2.on('end', () => {
      const p = JSON.parse(d);
      console.log('\n✅ Test end-to-end (contrato nuevo AK-2026-04-17-QXGJ):');
      console.log('  ads encontrados:', p.data?.ads?.length ?? 0);
      (p.data?.ads ?? []).slice(0, 3).forEach(a => console.log('  -', a.ad_name?.slice(0, 70)));
    });
  });
  req2.on('error', console.error);
  req2.write(body);
  req2.end();
})().catch(e => { console.error(e); process.exit(1); });
