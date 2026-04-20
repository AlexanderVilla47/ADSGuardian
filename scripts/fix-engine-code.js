// Fix the Killswitch_Engine jsCode in F2 workflow JSON
// Avoids shell escaping issues by using a file instead of -e

const fs = require('fs');
const path = require('path');

const F2_PATH = path.join(__dirname, '..', 'workflows', 'contract-guard-daily-killswitch.json');
const wf = JSON.parse(fs.readFileSync(F2_PATH, 'utf-8'));
const ke = wf.nodes.find(n => n.name === 'Killswitch_Engine');

// The jsCode as it should appear in the n8n Code node (raw JavaScript)
ke.parameters.jsCode =
"const LIST_URL = 'http://168.138.125.21.nip.io:5678/webhook/ak-meta-list-v1';\n" +
"const PAUSE_URL = 'http://168.138.125.21.nip.io:5678/webhook/adskiller-meta-pause';\n" +
"const DELAY_MS = 300;\n" +
"\n" +
"const results = [];\n" +
"\n" +
"for (const item of $input.all()) {\n" +
"  const contract = item.json;\n" +
"  const pattern = (contract.Cliente || '')\n" +
"    .toLowerCase().trim().split(/\\s+/).join('|');\n" +
"\n" +
"  // 1. List active ads for this contract\n" +
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
"  // 2. Pause each ad sequentially with real async delay\n" +
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

fs.writeFileSync(F2_PATH, JSON.stringify(wf, null, 2), 'utf-8');

// Verify
const verify = JSON.parse(fs.readFileSync(F2_PATH, 'utf-8'));
const keV = verify.nodes.find(n => n.name === 'Killswitch_Engine');
const code = keV.parameters.jsCode;

console.log('Verification:');
console.log('  $input.all():', code.includes('$input.all()'));
console.log('  /\\s+/:', code.includes('/\\s+/'));
console.log('  await fetch(:', code.includes('await fetch('));
console.log('  listFailed:', code.includes('listFailed'));
console.log('  No $helpers:', !code.includes('$helpers'));
console.log('');
console.log('Line 7:', code.split('\n')[6]);
console.log('Line 10:', code.split('\n')[9]);
