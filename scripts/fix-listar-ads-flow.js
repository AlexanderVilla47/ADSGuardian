/**
 * fix-listar-ads-flow.js
 *
 * Fix 1 (contract-ui-management-v2):
 *   GS Read For Listar Ads — cambia httpRequest (mock ak-meta-list-v1) →
 *   Google Sheets getAll en hoja "Contratos" (datos reales del Sheet).
 *   Resultado: Extract Regex recibe todos los contratos, encuentra el correcto
 *   por Contrato_ID, y devuelve su Regex_Anuncio real.
 *
 * Fix 2 (contract-ui-management-v2):
 *   Prepare Alta Row — reemplaza algoritmo de regex débil ("farid|dieck|fariddieck")
 *   por algoritmo sólido con:
 *     - Tolerancia de acentos: López = Lopez = l[oó]p[eé]z
 *     - Separadores flexibles: [\s_\-.]{0,3} entre palabras
 *     - Palabras individuales significativas (>= 4 chars)
 *     - Nombre completo con SEP, primer+último (saltando segundo), fuzzy, concat
 *
 * Requiere: N8N_API_KEY
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const N8N_KEY    = process.env.N8N_API_KEY;
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');

if (!N8N_KEY) { console.error('N8N_API_KEY requerida'); process.exit(1); }

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function api(method, p, body) {
  return new Promise((res, rej) => {
    const bs = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '168.138.125.21', port: 5678, path: p, method,
      headers: {
        'X-N8N-API-KEY': N8N_KEY,
        'Content-Type':  'application/json',
        ...(bs ? { 'Content-Length': Buffer.byteLength(bs) } : {}),
      },
    };
    const req = http.request(opts, r => {
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

const STRIP = [
  'executionOrder','saveManualExecutions','saveDataSuccessExecution',
  'saveDataErrorExecution','saveExecutionProgress','executionTimeout','timezone',
];
function stripSettings(raw) {
  const s = {};
  for (const k of STRIP) if (raw[k] !== undefined) s[k] = raw[k];
  return s;
}

// ─── Fix 1: config del nodo Google Sheets que reemplaza a GS Read For Listar Ads ──
function buildGSheetNode(existingNode) {
  // Preserva id, name, position — solo cambia type/typeVersion/credentials/parameters
  return {
    id:          existingNode.id,
    name:        existingNode.name,
    type:        'n8n-nodes-base.googleSheets',
    typeVersion: 4.5,
    position:    existingNode.position,
    credentials: {
      googleApi: {
        id:   'BtY3uGIkB5umd39o',
        name: 'Google Service Account account',
      },
    },
    parameters: {
      authentication: 'serviceAccount',
      operation:      'getAll',
      documentId: {
        __rl:  true,
        value: '=1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY',
        mode:  'id',
      },
      sheetName: {
        __rl:  true,
        value: 'Contratos',
        mode:  'name',
      },
      options: {},
    },
  };
}

// ─── Fix 2: helper buildInfluencerRegex inyectado en Prepare Alta Row ─────────
// Nota: String.raw preserva backslashes tal cual → el jsCode tendrá JS válido
const REGEX_HELPER = String.raw`// ── buildInfluencerRegex: regex sólida para matching de ads por influencer ──────
// Genera 5 tipos de patterns:
//   1. Palabras individuales significativas (>= 4 chars), con tolerancia de acentos
//   2. Nombre completo con separadores flexibles: [\s_\-.]{0,3} entre palabras
//   3. Primer + último nombre (salta segundo nombre en nombres de 3 palabras)
//   4. Fuzzy: primer nombre + .{0,8} + primeras 4 letras del apellido
//   5. Concatenación exacta sin acentos (todo junto, minúsculas)
function buildInfluencerRegex(nombreRaw) {
  if (!nombreRaw || !String(nombreRaw).trim()) return '';
  const SEP = '[\\s_\\-.]{0,3}';

  function accentTolerant(word) {
    return word
      .replace(/[aá]/g, '[aá]')
      .replace(/[eé]/g, '[eé]')
      .replace(/[ií]/g, '[ií]')
      .replace(/[oó]/g, '[oó]')
      .replace(/[uú]/g, '[uú]')
      .replace(/[nñ]/g, '[nñ]');
  }

  const clean = String(nombreRaw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const wordsClean    = clean.split(/\s+/).filter(Boolean);
  const wordsOriginal = String(nombreRaw).toLowerCase().split(/\s+/).filter(Boolean);
  const tolerant      = wordsOriginal.map(w => accentTolerant(w.replace(/[^a-záéíóúñ]/g, '')));

  const patterns = [];

  // 1. Palabras individuales significativas
  tolerant.forEach((tw, i) => { if (wordsClean[i]?.length >= 4) patterns.push(tw); });

  // 2. Nombre completo con SEP
  if (tolerant.length >= 2) patterns.push(tolerant.join(SEP));

  // 3. Primer + último (saltando segundo nombre)
  if (tolerant.length === 3) patterns.push(tolerant[0] + SEP + tolerant[2]);

  // 4. Fuzzy
  if (tolerant.length >= 2) {
    const lastPrefix = tolerant[tolerant.length - 1].slice(0, 4);
    patterns.push(tolerant[0] + '.{0,8}' + lastPrefix);
  }

  // 5. Concatenación sin acentos
  if (wordsClean.length >= 2) patterns.push(wordsClean.join(''));

  return [...new Set(patterns.filter(Boolean))].join('|');
}

`;

function patchPrepareAltaRow(code) {
  // Inyectar helper al tope (o actualizar si ya existe)
  let base;
  if (code.includes('buildInfluencerRegex')) {
    // Ya tiene el helper — reemplazar todo el bloque de la función anterior
    base = code.replace(
      /\/\/ ── buildInfluencerRegex[\s\S]+?^}/m,
      REGEX_HELPER.trim()
    );
    if (base === code) {
      // No pudo reemplazar el bloque viejo — simplemente continuar con el code existente
      base = code;
    }
    console.log('  (buildInfluencerRegex ya existía — helper actualizado)');
  } else {
    base = REGEX_HELPER + code;
  }

  const newCall = "buildInfluencerRegex(String($json.Cliente ?? $json.Nombre ?? '').trim())";

  // Reemplazar como propiedad de objeto: Regex_Anuncio: <expr>,
  let patched = base.replace(
    /Regex_Anuncio:\s*[^\n,}]+/,
    'Regex_Anuncio: ' + newCall
  );

  if (patched === base) {
    // Fallback: reemplazar como variable const
    patched = base.replace(
      /const\s+Regex_Anuncio\s*=\s*[^\n;]+;/,
      'const Regex_Anuncio = ' + newCall + ';'
    );
  }

  if (patched === base) {
    console.warn('  ⚠ No se encontró Regex_Anuncio para reemplazar — helper inyectado pero sin reemplazar assignment');
  } else {
    console.log('  ✓ Regex_Anuncio → buildInfluencerRegex(Cliente)');
  }

  return patched;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 Fix Listar Ads Flow + Regex');
  console.log('==============================');

  // Buscar UI Management workflow
  const listR = await api('GET', '/api/v1/workflows?limit=50');
  if (listR.s !== 200) { console.error('Error listando workflows:', listR.b); process.exit(1); }

  const wfList = listR.b.data ?? listR.b;
  const target = wfList.find(w => {
    const n = w.name.toLowerCase();
    return n.includes('contract ui management') ||
           n.includes('contract-ui-management') ||
           n.includes('ui management');
  });
  if (!target) {
    console.error('Workflow UI Management no encontrado. Disponibles:');
    wfList.forEach(w => console.log(' -', w.id, w.name));
    process.exit(1);
  }
  const WF_ID = target.id;
  console.log(`✓ Workflow: "${target.name}" (${WF_ID})`);

  const r = await api('GET', `/api/v1/workflows/${WF_ID}`);
  if (r.s !== 200) { console.error('GET error:', r.s, r.b); process.exit(1); }
  const wf = r.b;
  console.log(`✓ Nodos: ${wf.nodes.length}`);

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkp   = path.join(BACKUP_DIR, `${WF_ID}-${stamp}-pre-listar-ads-fix.json`);
  fs.writeFileSync(bkp, JSON.stringify(wf, null, 2));
  console.log(`✓ Backup: ${path.basename(bkp)}`);

  const nodes = wf.nodes;

  // ── Fix 1: GS Read For Listar Ads → Google Sheets getAll ──────────────────
  const gsReadIdx = nodes.findIndex(n => n.name === 'GS Read For Listar Ads');
  if (gsReadIdx === -1) {
    console.warn('⚠ Fix 1: nodo "GS Read For Listar Ads" no encontrado');
  } else {
    const currentType = nodes[gsReadIdx].type;
    if (currentType === 'n8n-nodes-base.googleSheets') {
      console.log('✓ Fix 1: GS Read For Listar Ads ya es Google Sheets — sin cambios');
    } else {
      console.log(`✓ Fix 1: GS Read For Listar Ads: ${currentType} → googleSheets`);
      nodes[gsReadIdx] = buildGSheetNode(nodes[gsReadIdx]);
    }
  }

  // ── Fix 2: Prepare Alta Row → regex sólida ────────────────────────────────
  const altaIdx = nodes.findIndex(n => n.name === 'Prepare Alta Row');
  if (altaIdx === -1) {
    console.warn('⚠ Fix 2: nodo "Prepare Alta Row" no encontrado');
  } else {
    const currentCode = nodes[altaIdx].parameters?.jsCode ?? '';
    console.log('\nFix 2: Prepare Alta Row — código actual (primeras 6 líneas):');
    currentCode.split('\n').slice(0, 6).forEach(l => console.log('  |', l));
    console.log('  ...');

    const patchedCode = patchPrepareAltaRow(currentCode);
    nodes[altaIdx].parameters.jsCode = patchedCode;
    console.log('✓ Fix 2: Prepare Alta Row actualizado con buildInfluencerRegex');
  }

  // ── PUT ────────────────────────────────────────────────────────────────────
  const payload = {
    name:        wf.name,
    nodes:       wf.nodes,
    connections: wf.connections,
    settings:    stripSettings(wf.settings || {}),
    staticData:  wf.staticData,
  };
  console.log(`\n📤 Subiendo UI Management (${nodes.length} nodos)...`);
  const put = await api('PUT', `/api/v1/workflows/${WF_ID}`, payload);
  if (put.s !== 200) {
    console.error('PUT error:', JSON.stringify(put.b).slice(0, 600));
    process.exit(1);
  }
  console.log('✅ UI Management actualizado\n');

  // ── Verificación ───────────────────────────────────────────────────────────
  const verify = await api('GET', `/api/v1/workflows/${WF_ID}`);
  const vn     = verify.b.nodes;

  const gsNode    = vn.find(n => n.name === 'GS Read For Listar Ads');
  const altaNode  = vn.find(n => n.name === 'Prepare Alta Row');
  const altaCode  = altaNode?.parameters?.jsCode ?? '';

  console.log('── Verificación ──────────────────────────────────────────────────');
  console.log('Fix 1 — GS Read es googleSheets:',
    gsNode?.type === 'n8n-nodes-base.googleSheets');
  console.log('Fix 1 — GS Read credential OK:',
    gsNode?.credentials?.googleApi?.id === 'BtY3uGIkB5umd39o');
  console.log('Fix 2 — buildInfluencerRegex inyectado:',
    altaCode.includes('buildInfluencerRegex'));
  console.log('Fix 2 — tolerant accent patterns:',
    altaCode.includes('[aá]') && altaCode.includes('[oó]'));
  console.log('Fix 2 — separadores flexibles (SEP):',
    altaCode.includes('[\\\\s_\\\\-.]{0,3}') || altaCode.includes('[\\s_\\-.]{0,3}'));
  console.log('──────────────────────────────────────────────────────────────────');

  console.log('\nPróximos pasos:');
  console.log('  1. Correr fix-notifications.js (si no se corrió)');
  console.log('  2. Abrir el UI → "Ver Ads" en cualquier contrato → debe mostrar ads del mock');
  console.log('  3. Crear una Alta nueva → revisar Regex_Anuncio en el Sheet (debe ser sólida)');
  console.log('  ⚠ Los contratos existentes tienen regex viejo — se pueden actualizar');
  console.log('    manualmente en el Sheet usando el mismo algoritmo.');
}

main().catch(e => { console.error(e); process.exit(1); });
