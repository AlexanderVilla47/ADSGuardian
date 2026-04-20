// Fix: pause_ad should NOT finalize the contract
// - Killswitch_Engine: detect pause_ad + target_ad_id → pause only that ad, set pause_state='ad_paused'
// - Finalizado Payload Valido: reject pause_state='ad_paused'

const fs = require('fs');
const path = require('path');

const F2_PATH = path.join(__dirname, '..', 'workflows', 'contract-guard-daily-killswitch.json');
const wf = JSON.parse(fs.readFileSync(F2_PATH, 'utf-8'));

// 1. Update Killswitch_Engine jsCode
const ke = wf.nodes.find(n => n.name === 'Killswitch_Engine');

ke.parameters.jsCode =
"const LIST_URL = 'http://168.138.125.21.nip.io:5678/webhook/ak-meta-list-v1';\n" +
"const PAUSE_URL = 'http://168.138.125.21.nip.io:5678/webhook/adskiller-meta-pause';\n" +
"const DELAY_MS = 300;\n" +
"\n" +
"const results = [];\n" +
"\n" +
"for (const item of $input.all()) {\n" +
"  const contract = item.json;\n" +
"\n" +
"  // Single ad pause — only pause the target ad, do NOT finalize contract\n" +
"  if (contract.action === 'pause_ad' && contract.target_ad_id) {\n" +
"    let state = 'failed';\n" +
"    let error = null;\n" +
"    try {\n" +
"      const resp = await fetch(PAUSE_URL, {\n" +
"        method: 'POST',\n" +
"        headers: { 'Content-Type': 'application/json' },\n" +
"        body: JSON.stringify({ ad_id: contract.target_ad_id }),\n" +
"      });\n" +
"      if (!resp.ok) throw new Error('HTTP ' + resp.status);\n" +
"      state = 'ad_paused';\n" +
"    } catch (e) {\n" +
"      error = e.message;\n" +
"    }\n" +
"    results.push({ json: {\n" +
"      ...contract,\n" +
"      pause_state: state,\n" +
"      ads_total: 1,\n" +
"      ads_paused: state === 'ad_paused' ? 1 : 0,\n" +
"      ads_failed: state === 'ad_paused' ? 0 : 1,\n" +
"      ad_results: [{ ad_id: contract.target_ad_id, state: state === 'ad_paused' ? 'paused' : 'failed', error }],\n" +
"      source: 'manual_pause',\n" +
"    }});\n" +
"    continue;\n" +
"  }\n" +
"\n" +
"  // Batch killswitch — list all active ads and pause them\n" +
"  const pattern = (contract.Cliente || '')\n" +
"    .toLowerCase().trim().split(/\\s+/).join('|');\n" +
"\n" +
"  let ads = [];\n" +
"  let listFailed = false;\n" +
"  try {\n" +
"    const listResp = await fetch(\n" +
"      LIST_URL + '?pattern=' + encodeURIComponent(pattern)\n" +
"        + '&contrato_id=' + encodeURIComponent(contract.Contrato_ID)\n" +
"    );\n" +
"    if (!listResp.ok) throw new Error('HTTP ' + listResp.status);\n" +
"    const body = await listResp.json();\n" +
"    const data = body.data || body;\n" +
"    ads = (Array.isArray(data) ? data : [])\n" +
"      .filter(ad => ad.status === 'ACTIVE' || ad.effective_status === 'ACTIVE');\n" +
"  } catch (e) {\n" +
"    listFailed = true;\n" +
"    ads = [];\n" +
"  }\n" +
"\n" +
"  let adsPaused = 0, adsFailed = 0;\n" +
"  const adResults = [];\n" +
"\n" +
"  for (const ad of ads) {\n" +
"    try {\n" +
"      const pauseResp = await fetch(PAUSE_URL, {\n" +
"        method: 'POST',\n" +
"        headers: { 'Content-Type': 'application/json' },\n" +
"        body: JSON.stringify({ ad_id: ad.id }),\n" +
"      });\n" +
"      if (!pauseResp.ok) throw new Error('HTTP ' + pauseResp.status);\n" +
"      adsPaused++;\n" +
"      adResults.push({ ad_id: ad.id, state: 'paused' });\n" +
"    } catch (e) {\n" +
"      adsFailed++;\n" +
"      adResults.push({ ad_id: ad.id, state: 'failed', error: e.message });\n" +
"    }\n" +
"    await new Promise(resolve => setTimeout(resolve, DELAY_MS));\n" +
"  }\n" +
"\n" +
"  let pause_state;\n" +
"  if (listFailed) {\n" +
"    pause_state = 'list_failed';\n" +
"  } else if (adsFailed === 0) {\n" +
"    pause_state = adsPaused > 0 ? 'success' : 'no_active_ads';\n" +
"  } else {\n" +
"    pause_state = adsPaused > 0 ? 'partial' : 'failed';\n" +
"  }\n" +
"\n" +
"  results.push({ json: {\n" +
"    ...contract,\n" +
"    pause_state,\n" +
"    ads_total: ads.length,\n" +
"    ads_paused: adsPaused,\n" +
"    ads_failed: adsFailed,\n" +
"    ad_results: adResults,\n" +
"    run_mode: 'killswitch',\n" +
"    source: 'killswitch_daily',\n" +
"  }});\n" +
"}\n" +
"\n" +
"return results;";

// 2. Update Finalizado Payload Valido — block ad_paused from finalization
const fpv = wf.nodes.find(n => n.name === 'Finalizado Payload Valido');
fpv.parameters.conditions.string = [
  { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'failed' },
  { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'list_failed' },
  { value1: '={{$json.pause_state}}', operation: 'notEqual', value2: 'ad_paused' },
  { value1: '={{String($json.Contrato_ID || \'\').trim()}}', operation: 'notEmpty' },
];

fs.writeFileSync(F2_PATH, JSON.stringify(wf, null, 2), 'utf-8');

// Verify
const verify = JSON.parse(fs.readFileSync(F2_PATH, 'utf-8'));
const keV = verify.nodes.find(n => n.name === 'Killswitch_Engine');
const fpvV = verify.nodes.find(n => n.name === 'Finalizado Payload Valido');
const code = keV.parameters.jsCode;

console.log('Killswitch_Engine:');
console.log('  Has pause_ad check:', code.includes("contract.action === 'pause_ad'"));
console.log('  Has target_ad_id:', code.includes('contract.target_ad_id'));
console.log('  Has ad_paused state:', code.includes("'ad_paused'"));
console.log('  Has continue:', code.includes('continue;'));
console.log('  Has $input.all():', code.includes('$input.all()'));
console.log('  Has /\\s+/:', code.includes('/\\s+/'));
console.log('  Has fetch:', code.includes('await fetch('));

console.log('\nFinalizado Payload Valido:');
console.log('  Conditions:', fpvV.parameters.conditions.string.length);
console.log('  Rejects ad_paused:', fpvV.parameters.conditions.string.some(c => c.value2 === 'ad_paused'));
