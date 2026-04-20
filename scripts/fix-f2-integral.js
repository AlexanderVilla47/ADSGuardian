/**
 * fix-f2-integral.js
 *
 * Fix único GET → modify → PUT para F2 (8mlwAxLtJVrwpLhi).
 * Aplica 7 fixes en un solo ciclo:
 *
 *  Fix 1: Clasificar — else if isPreventiveWindow (diffDays=0)
 *  Fix 2: Dedup por Contrato antes de Sheets - Marcar Finalizado
 *  Fix 3: Evaluar Precheck Meta — restaura contexto desde Init Retry Precheck
 *  Fix 4: Evaluar Pausa — restaura contexto desde Init Retry Pausa
 *  Fix 5: Build Finalizado Payload — simplificado, sin getNodeJson
 *  Fix 6: Split Ads + Bypass Precheck — contrato con 0 ads → Finalizado
 *  Fix 7: not_actionable → Build Finalizado (ads ya pausados = contrato Finalizado)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const N8N_KEY    = process.env.N8N_API_KEY;
const F2_ID      = '8mlwAxLtJVrwpLhi';
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');

function api(method, p, body) {
  return new Promise((res, rej) => {
    const bs = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '168.138.125.21', port: 5678, path: p, method,
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

// ─── Node codes ──────────────────────────────────────────────────────────────

const SPLIT_ADS_CODE = `const inputItems = $input.all();
const contracts = $('Expand Vencidos').all();

const result = [];
for (let i = 0; i < inputItems.length; i++) {
  const contract = contracts[i]?.json ?? {};
  const ads = inputItems[i]?.json?.data ?? [];

  if (ads.length === 0) {
    // No ads found — emit synthetic item so contract still gets marked Finalizado
    result.push({ json: {
      Contrato_ID:      String(contract.Contrato_ID ?? ''),
      Regex_Anuncio:    String(contract.Regex_Anuncio ?? ''),
      regex_pattern:    String(contract.Regex_Anuncio ?? ''),
      Fecha_Fin:        String(contract.Fecha_Fin ?? ''),
      Ad_ID:            '',
      Ad_Name:          '',
      Ad_Status:        '',
      no_ads_to_pause:  true,
    }});
    continue;
  }

  for (const ad of ads) {
    result.push({ json: {
      Contrato_ID:      String(contract.Contrato_ID ?? ''),
      Regex_Anuncio:    String(contract.Regex_Anuncio ?? ''),
      regex_pattern:    String(contract.Regex_Anuncio ?? ''),
      Fecha_Fin:        String(contract.Fecha_Fin ?? ''),
      Ad_ID:            String(ad.id   ?? ''),
      Ad_Name:          String(ad.name ?? ''),
      Ad_Status:        String(ad.effective_status ?? ad.status ?? '').toUpperCase(),
      no_ads_to_pause:  false,
    }});
  }
}
return result;`;

const EVALUAR_PRECHECK_CODE = `const inputItems = $input.all();
const initRetryItems = $('Init Retry Precheck').all();

return inputItems.map((inputItem, idx) => {
  const response = inputItem.json || {};
  const contractCtx = initRetryItems[idx]?.json ?? {};
  const row = { ...contractCtx, ...(inputItem.json || {}) };

  row.Contrato_ID   = String(row.Contrato_ID   || '').trim();
  row.regex_pattern = String(row.regex_pattern || row.Regex_Anuncio || '').trim();

  const attempt     = Number(row.precheck_attempt || 1);
  const maxAttempts = Number(row.precheck_max_attempts || 3);
  const httpStatus  = Number(response.http_status || 0);
  const httpBody    = response.http_body && typeof response.http_body === 'object' ? response.http_body : {};
  const httpOk      = Boolean(response.http_ok);
  const retryable   = Boolean(response.retryable);

  if (retryable && attempt < maxAttempts) {
    return { json: { ...row, precheck_attempt: attempt + 1, precheck_state: 'retry',
      precheck_status_code: httpStatus, precheck_http_ok: httpOk } };
  }

  if (!httpOk) {
    return { json: { ...row, precheck_state: 'failed',
      precheck_status_code: httpStatus, precheck_http_ok: httpOk,
      precheck_reason: 'meta_precheck_non_2xx' } };
  }

  const adNameMeta   = String(httpBody.name || '').trim();
  const regexPattern = row.regex_pattern;
  let regexMatchesMetaName = false;
  try { regexMatchesMetaName = !!regexPattern && new RegExp(regexPattern, 'i').test(adNameMeta); } catch (_) {}

  const status   = String(httpBody.status || httpBody.effective_status || '').toUpperCase();
  const isActive = status === 'ACTIVE';
  const regexOk  = !regexPattern || regexMatchesMetaName;

  if (!isActive || !regexOk) {
    return { json: { ...row, precheck_state: 'not_actionable',
      precheck_status_code: httpStatus, precheck_http_ok: httpOk,
      ad_status_meta: status || 'UNKNOWN', regexMatchesMetaName, ad_name_meta: adNameMeta } };
  }
  return { json: { ...row, precheck_state: 'ready_to_pause',
    precheck_status_code: httpStatus, precheck_http_ok: httpOk,
    ad_status_meta: status, regexMatchesMetaName, ad_name_meta: adNameMeta } };
});`;

const EVALUAR_PAUSA_CODE = `const inputItems = $input.all();
const initRetryPausaItems = $('Init Retry Pausa').all();

return inputItems.map((inputItem, idx) => {
  const response = inputItem.json || {};
  const contractCtx = initRetryPausaItems[idx]?.json ?? {};
  const row = { ...contractCtx, ...(inputItem.json || {}) };

  row.Contrato_ID = String(row.Contrato_ID || '').trim();

  const attempt     = Number(row.pause_attempt || 1);
  const maxAttempts = Number(row.pause_max_attempts || 3);
  const httpStatus  = Number(response.http_status || 0);
  const httpOk      = Boolean(response.http_ok);
  const retryable   = Boolean(response.retryable);

  if (httpOk) {
    return { json: { ...row, pause_state: 'success',
      pause_status_code: httpStatus, pause_http_ok: httpOk } };
  }
  if (retryable && attempt < maxAttempts) {
    return { json: { ...row, pause_attempt: attempt + 1, pause_state: 'retry',
      pause_status_code: httpStatus, pause_http_ok: httpOk } };
  }
  return { json: { ...row, pause_state: 'failed',
    pause_status_code: httpStatus, pause_http_ok: httpOk,
    pause_reason: retryable ? 'retry_exhausted' : 'non_retryable_meta_response' } };
});`;

const BUILD_FINALIZADO_CODE = `// Contexto ya restaurado en steps anteriores — simplemente marcamos Finalizado.
const nowIso = $now.setZone('America/Argentina/Buenos_Aires').toISO();
return $input.all().map(item => {
  const data = item.json || {};
  return { json: {
    ...data,
    Contrato_ID:        String(data.Contrato_ID || '').trim(),
    Status_Contrato:    'Finalizado',
    Fecha_Finalizacion: nowIso,
    Updated_At:         nowIso,
  }};
});`;

const DEDUP_CODE = `// Un solo ítem por contrato — evita N escrituras en Sheets para N ads del mismo contrato.
const seen = new Set();
return $input.all().filter(item => {
  const id = item.json.Contrato_ID;
  if (!id || seen.has(id)) return false;
  seen.add(id);
  return true;
});`;

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!N8N_KEY) { console.error('N8N_API_KEY requerida'); process.exit(1); }

  console.log('🔧 Fix F2 Integral — GET → modify all → PUT');
  console.log('============================================');

  const r = await api('GET', `/api/v1/workflows/${F2_ID}`);
  if (r.s !== 200) { console.error('GET error:', r.s, JSON.stringify(r.b).slice(0,200)); process.exit(1); }
  const wf = r.b;
  console.log(`✓ F2 obtenido: ${wf.nodes.length} nodos`);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkp = path.join(BACKUP_DIR, `${F2_ID}-${stamp}-pre-integral.json`);
  fs.writeFileSync(bkp, JSON.stringify(wf, null, 2));
  console.log(`✓ Backup: ${path.basename(bkp)}`);

  const nodes = wf.nodes;
  const conns = wf.connections;

  // ── Mapeo de nodos por nombre ────────────────────────────────────────────
  const nodeByName = name => nodes.find(n => n.name === name);

  // ── Fix 1: else if isPreventiveWindow ────────────────────────────────────
  const clsNode = nodes.find(n => n.name.includes('Clasificar'));
  if (clsNode) {
    const before = clsNode.parameters.jsCode;
    const after = before.replace(
      "if (isExpired) controlType = 'expired';\n  if (isPreventiveWindow",
      "if (isExpired) controlType = 'expired';\n  else if (isPreventiveWindow"
    );
    clsNode.parameters.jsCode = after;
    console.log(before !== after ? '✓ Fix 1: else if aplicado' : '✓ Fix 1: else if ya estaba');
  } else console.warn('⚠ Fix 1: nodo Clasificar no encontrado');

  // ── Fix 3: Evaluar Precheck Meta ─────────────────────────────────────────
  const evalPrecheckNode = nodes.find(n =>
    n.name === 'Evaluar Precheck Meta' || n.name === 'Evaluate_Precheck_Meta'
  );
  if (evalPrecheckNode) {
    evalPrecheckNode.parameters.jsCode = EVALUAR_PRECHECK_CODE;
    console.log('✓ Fix 3: Evaluar Precheck Meta — sin getNodeJson, restaura desde Init Retry Precheck');
  } else console.warn('⚠ Fix 3: Evaluar Precheck Meta no encontrado');

  // ── Fix 4: Evaluar Pausa ─────────────────────────────────────────────────
  const evalPausaNode = nodes.find(n =>
    n.name === 'Evaluar Pausa' || n.name === 'Evaluate_Pausa'
  );
  if (evalPausaNode) {
    evalPausaNode.parameters.jsCode = EVALUAR_PAUSA_CODE;
    console.log('✓ Fix 4: Evaluar Pausa — sin getNodeJson, restaura desde Init Retry Pausa');
  } else console.warn('⚠ Fix 4: Evaluar Pausa no encontrado');

  // ── Fix 5: Build Finalizado Payload ──────────────────────────────────────
  const buildNode = nodeByName('Build Finalizado Payload');
  if (buildNode) {
    buildNode.parameters.jsCode = BUILD_FINALIZADO_CODE;
    console.log('✓ Fix 5: Build Finalizado Payload — simplificado, sin getNodeJson');
  } else console.warn('⚠ Fix 5: Build Finalizado Payload no encontrado');

  // ── Fix 6: Split Ads + Bypass node ───────────────────────────────────────
  const splitNode = nodeByName('Split Ads por Contrato');
  if (splitNode) {
    splitNode.parameters.jsCode = SPLIT_ADS_CODE;
    console.log('✓ Fix 6a: Split Ads — emite ítem sintético cuando ads.length === 0');
  } else console.warn('⚠ Fix 6a: Split Ads por Contrato no encontrado');

  if (!nodeByName('Bypass Precheck si no hay Ads')) {
    const splitPos = splitNode?.position ?? [1620, 500];
    const bypassNode = {
      id: 'bypass-precheck-no-ads',
      name: 'Bypass Precheck si no hay Ads',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [splitPos[0] + 240, splitPos[1]],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [{
            id: 'no-ads-check',
            leftValue: '={{ $json.no_ads_to_pause }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'equals' },
          }],
          combinator: 'and',
        },
      },
    };
    nodes.push(bypassNode);

    // Split Ads → Bypass
    conns['Split Ads por Contrato'] = { main: [[{ node: 'Bypass Precheck si no hay Ads', type: 'main', index: 0 }]] };
    // Bypass TRUE (output[0]) → Build Finalizado | FALSE (output[1]) → Init Retry Precheck
    conns['Bypass Precheck si no hay Ads'] = { main: [
      [{ node: 'Build Finalizado Payload', type: 'main', index: 0 }],
      [{ node: 'Init Retry Precheck',      type: 'main', index: 0 }],
    ]};
    console.log('✓ Fix 6b: Bypass Precheck si no hay Ads agregado y conectado');
  } else {
    console.log('✓ Fix 6b: Bypass Precheck ya existía');
  }

  // ── Fix 7: not_actionable → Build Finalizado ─────────────────────────────
  // Find the switch node that routes precheck states
  const switchNodeName = [
    'Evaluate_Rutear_Estado_Precheck',
    'Evaluar Rutear Estado Precheck',
    'Rutear Estado Precheck',
  ].find(name => conns[name]);

  if (switchNodeName) {
    const outputs = conns[switchNodeName].main;
    // Find which output currently points to a "No Operation" node
    let notActionableIdx = -1;
    for (let i = 0; i < outputs.length; i++) {
      const target = outputs[i]?.[0]?.node ?? '';
      if (target.toLowerCase().includes('no operation') || target.toLowerCase().includes('nothing')) {
        notActionableIdx = i;
        break;
      }
    }
    if (notActionableIdx >= 0) {
      outputs[notActionableIdx] = [{ node: 'Build Finalizado Payload', type: 'main', index: 0 }];
      console.log(`✓ Fix 7: output[${notActionableIdx}] (not_actionable) → Build Finalizado Payload`);
    } else {
      console.log('  → no encontré output a No Operation, revisando output[2]...');
      if (outputs.length >= 3) {
        console.log('  → output[2] actual:', JSON.stringify(outputs[2]));
        outputs[2] = [{ node: 'Build Finalizado Payload', type: 'main', index: 0 }];
        console.log('✓ Fix 7: output[2] redirigido a Build Finalizado Payload');
      }
    }
  } else {
    console.warn('⚠ Fix 7: switch Rutear Estado Precheck no encontrado en connections');
    console.log('  Keys disponibles:', Object.keys(conns).filter(k => k.toLowerCase().includes('evaluar') || k.toLowerCase().includes('rutear')));
  }

  // ── Fix 2: Dedup por Contrato ─────────────────────────────────────────────
  if (!nodeByName('Dedup por Contrato')) {
    const sheetsNode = nodeByName('Sheets - Marcar Finalizado');
    const sheetsPos  = sheetsNode?.position ?? [2200, 500];
    const dedupNode  = {
      id: 'dedup-por-contrato',
      name: 'Dedup por Contrato',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [sheetsPos[0] - 220, sheetsPos[1]],
      parameters: { jsCode: DEDUP_CODE },
    };
    nodes.push(dedupNode);

    // Find who connects TRUE output to Sheets - Marcar Finalizado and redirect through Dedup
    const finValidoNode = nodeByName('Finalizado Payload Valido');
    if (finValidoNode && conns[finValidoNode.name]) {
      const finConns = conns[finValidoNode.name].main;
      for (let i = 0; i < finConns.length; i++) {
        if (finConns[i]?.[0]?.node === 'Sheets - Marcar Finalizado') {
          finConns[i] = [{ node: 'Dedup por Contrato', type: 'main', index: 0 }];
          console.log(`✓ Fix 2: Finalizado Payload Valido output[${i}] → Dedup`);
        }
      }
    }
    conns['Dedup por Contrato'] = { main: [[{ node: 'Sheets - Marcar Finalizado', type: 'main', index: 0 }]] };
    console.log('✓ Fix 2: Dedup por Contrato agregado → Sheets - Marcar Finalizado');
  } else {
    console.log('✓ Fix 2: Dedup ya existía');
  }

  // ── PUT ──────────────────────────────────────────────────────────────────
  const payload = {
    name: wf.name, nodes: wf.nodes, connections: wf.connections,
    settings: stripSettings(wf.settings || {}), staticData: wf.staticData,
  };
  console.log(`\n📤 Subiendo F2 (${nodes.length} nodos)...`);
  const put = await api('PUT', `/api/v1/workflows/${F2_ID}`, payload);
  if (put.s !== 200) {
    console.error('PUT error:', JSON.stringify(put.b).slice(0, 600));
    process.exit(1);
  }
  console.log('✅ F2 actualizado\n');

  // ── Verificación ─────────────────────────────────────────────────────────
  const verify = await api('GET', `/api/v1/workflows/${F2_ID}`);
  const vn = verify.b.nodes;
  const vc = verify.b.connections;
  console.log('── Verificación ──────────────────────────────────');
  const clsCode = vn.find(n => n.name.includes('Clasificar'))?.parameters?.jsCode ?? '';
  console.log('Fix 1 else if:', clsCode.includes("else if (isPreventiveWindow"));
  console.log('Fix 2 Dedup:', !!vn.find(n => n.name === 'Dedup por Contrato'));
  const epCode = vn.find(n => n.name.includes('Precheck Meta') || n.name === 'Evaluate_Precheck_Meta')?.parameters?.jsCode ?? '';
  console.log('Fix 3 sin getNodeJson:', !epCode.includes('getNodeJson') && epCode.includes('initRetryItems'));
  const evCode = vn.find(n => n.name.includes('Evaluar Pausa') || n.name === 'Evaluate_Pausa')?.parameters?.jsCode ?? '';
  console.log('Fix 4 sin getNodeJson:', !evCode.includes('getNodeJson') && evCode.includes('initRetryPausaItems'));
  const bfCode = vn.find(n => n.name === 'Build Finalizado Payload')?.parameters?.jsCode ?? '';
  console.log('Fix 5 simplificado:', bfCode.includes('$input.all()') && !bfCode.includes('getNodeJson'));
  console.log('Fix 6 Bypass:', !!vn.find(n => n.name === 'Bypass Precheck si no hay Ads'));
  console.log('Fix 6 Split→Bypass:', vc['Split Ads por Contrato']?.main?.[0]?.[0]?.node);
  if (switchNodeName) {
    const swOut = vc[switchNodeName]?.main ?? [];
    console.log('Fix 7 not_actionable→:', swOut[2]?.[0]?.node ?? swOut[3]?.[0]?.node ?? '?');
  }
  console.log('──────────────────────────────────────────────────');
}

main().catch(e => { console.error(e); process.exit(1); });
