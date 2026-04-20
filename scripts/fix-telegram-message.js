/**
 * fix-telegram-message.js
 *
 * 1. Send_TelegramNotification: quita parse_mode (emojis corruptos rompen el parser de Telegram)
 * 2. Build_CriticalMessage / Build_InfoWarnMessage: reemplaza emojis garbled por texto limpio
 */

const fs   = require('fs');
const http = require('http');

const N8N_BASE = 'http://168.138.125.21:5678';
const N8N_KEY  = process.env.N8N_API_KEY;

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_BASE + path);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' }
    };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function stripSettings(raw) {
  const ALLOWED = [
    'executionOrder','saveManualExecutions','saveDataSuccessExecution',
    'saveDataErrorExecution','saveExecutionProgress','executionTimeout',
    'timezone','errorWorkflow','callerIds','callerPolicy'
  ];
  const s = {};
  for (const k of ALLOWED) if (raw[k] !== undefined) s[k] = raw[k];
  return s;
}

// Código limpio para Build_CriticalMessage (sin emojis corruptos)
const CRITICAL_CODE = `const m = $json.metrics;
const incidents = ($json.incidents ?? [])
  .map((it, i) => \`  \${i + 1}. \${it.code ?? 'INCIDENT'} - \${it.message ?? 'Sin detalle'}\`)
  .slice(0, 5);
const incidentsBlock = incidents.length ? incidents.join('\\n') : '  Sin incidentes reportados';

const message = [
  '[CRITICAL] AdsKiller Kill-Switch Diario',
  \`Execution ID: \${$json.execution_id ?? 'N/A'}\`,
  \`Correlation ID: \${$json.correlation_id}\`,
  \`Modo: \${$json.derived.execution_mode}\`,
  \`Estado: \${String($json.execution_status).toUpperCase()}\`,
  \`TZ: \${$json.timezone}\`,
  \`Fecha: \${$json.derived.executed_at}\`,
  '',
  'Metricas:',
  \`  Contratos evaluados: \${m.contracts_evaluated}\`,
  \`  Ads evaluados: \${m.ads_evaluated}\`,
  \`  Ads pausados OK: \${m.paused_success_count}\`,
  \`  Errores al pausar: \${m.paused_error_count}\`,
  \`  Preventivas 48h: \${m.preventive_48h_count}\`,
  \`  Vencidos sin pausar: \${m.expired_unpaused_count}\`,
  \`  Duracion (ms): \${m.duration_ms}\`,
  '',
  'Incidentes:',
  incidentsBlock,
  '',
  'Accion requerida: revisar anuncios vencidos sin pausar y escalar incidente operativo.'
].join('\\n');

return [{ json: { ...$json, message_text: message } }];`;

// Código limpio para Build_InfoWarnMessage (sin emojis corruptos)
const INFOWARN_CODE = `const m = $json.metrics;
const incidents = ($json.incidents ?? [])
  .map((it, i) => \`  \${i + 1}. \${it.code ?? 'INCIDENT'} - \${it.message ?? 'Sin detalle'}\`)
  .slice(0, 5);
const incidentsBlock = incidents.length ? incidents.join('\\n') : '  Sin incidentes reportados';

const severity = $json.derived.severity;
const message = [
  \`[\${severity}] AdsKiller Kill-Switch Diario\`,
  \`Execution ID: \${$json.execution_id ?? 'N/A'}\`,
  \`Correlation ID: \${$json.correlation_id}\`,
  \`Modo: \${$json.derived.execution_mode}\`,
  \`Estado: \${String($json.execution_status).toUpperCase()}\`,
  \`TZ: \${$json.timezone}\`,
  \`Fecha: \${$json.derived.executed_at}\`,
  '',
  'Metricas:',
  \`  Contratos evaluados: \${m.contracts_evaluated}\`,
  \`  Ads evaluados: \${m.ads_evaluated}\`,
  \`  Ads pausados OK: \${m.paused_success_count}\`,
  \`  Errores al pausar: \${m.paused_error_count}\`,
  \`  Preventivas 48h: \${m.preventive_48h_count}\`,
  \`  Vencidos sin pausar: \${m.expired_unpaused_count}\`,
  \`  Duracion (ms): \${m.duration_ms}\`,
  '',
  'Incidentes:',
  incidentsBlock
].join('\\n');

return [{ json: { ...$json, message_text: message } }];`;

async function fix() {
  console.log('[F3] Fetching...');
  const r = await apiRequest('GET', '/api/v1/workflows/BFHHQwYFfmcpqshb');
  if (r.status !== 200) { console.error('FAIL GET', r.status); return; }
  const wf = r.body;

  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  fs.writeFileSync(`workflows/backups/BFHHQwYFfmcpqshb-${stamp}-before-telegram-fix.json`, JSON.stringify(wf, null, 2));

  wf.nodes = wf.nodes.map(n => {
    // Fix 1: Remove parse_mode from Telegram node
    if (n.name === 'Send_TelegramNotification') {
      n.parameters.jsonBody = '={{ { chat_id: $json.notification.telegram.chat_id, text: $json.message_text } }}';
      console.log('  Send_TelegramNotification: parse_mode removed');
    }

    // Fix 2: Replace garbled code in message builders
    if (n.name === 'Build_CriticalMessage') {
      n.parameters.jsCode = CRITICAL_CODE;
      console.log('  Build_CriticalMessage: code cleaned');
    }
    if (n.name === 'Build_InfoWarnMessage') {
      n.parameters.jsCode = INFOWARN_CODE;
      console.log('  Build_InfoWarnMessage: code cleaned');
    }

    return n;
  });

  const payload = {
    name: wf.name, nodes: wf.nodes,
    connections: wf.connections,
    settings: stripSettings(wf.settings || {})
  };

  const put = await apiRequest('PUT', '/api/v1/workflows/BFHHQwYFfmcpqshb', payload);
  if (put.status === 200) console.log('  OK — F3 Telegram fix applied');
  else console.error('  FAIL PUT', put.status, JSON.stringify(put.body).slice(0,300));
}

(async () => {
  if (!N8N_KEY) { console.error('N8N_API_KEY missing'); process.exit(1); }
  await fix();
})();
