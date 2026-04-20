/**
 * apply-rich-messages.js
 *
 * Actualiza F3:
 * - Build_CriticalMessage y Build_InfoWarnMessage: generan message_slack (Block Kit) y message_telegram (HTML)
 * - Send_SlackNotification: usa message_slack
 * - Send_TelegramNotification: usa message_telegram con parse_mode HTML
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
  const ALLOWED = ['executionOrder','saveManualExecutions','saveDataSuccessExecution',
    'saveDataErrorExecution','saveExecutionProgress','executionTimeout',
    'timezone','errorWorkflow','callerIds','callerPolicy'];
  const s = {};
  for (const k of ALLOWED) if (raw[k] !== undefined) s[k] = raw[k];
  return s;
}

// ─── Build_CriticalMessage ────────────────────────────────────────────────────

const CRITICAL_CODE = `
const m = $json.metrics;
const incidents = ($json.incidents ?? []).slice(0, 5);

// ── helpers ──
const durationSec = (m.duration_ms / 1000).toFixed(1);
const incidentLines = incidents.length
  ? incidents.map(it => \`  \${it.code ?? 'INCIDENT'} — \${it.message ?? 'Sin detalle'}\`).join('\\n')
  : '  Sin incidentes reportados';

// ── Slack Block Kit ───────────────────────────────────────────────────────────
const slackPayload = {
  text: '[CRITICAL] AdsKiller Kill-Switch — revision requerida',
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: ':rotating_light: CRITICAL — AdsKiller Kill-Switch Diario', emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: \`*Execution ID*\\n\\\`\${$json.execution_id ?? 'N/A'}\\\`\` },
        { type: 'mrkdwn', text: \`*Correlation ID*\\n\\\`\${$json.correlation_id}\\\`\` },
        { type: 'mrkdwn', text: \`*Modo*\\n\${$json.derived.execution_mode}\` },
        { type: 'mrkdwn', text: \`*Estado*\\n\${String($json.execution_status).toUpperCase()}\` }
      ]
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          '*Metricas*',
          \`• Contratos evaluados: \${m.contracts_evaluated}  |  Ads evaluados: \${m.ads_evaluated}\`,
          \`• Pausados OK: \${m.paused_success_count}  |  Errores al pausar: \${m.paused_error_count}\`,
          \`• Preventivas 48h: \${m.preventive_48h_count}  |  Duracion: \${durationSec}s\`,
          \`• :warning: *Vencidos sin pausar: \${m.expired_unpaused_count}*\`
        ].join('\\n')
      }
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: incidents.length
          ? '*Incidentes*\\n' + incidents.map(it => \`:x: \${it.code ?? 'INCIDENT'} — \${it.message ?? ''}\`).join('\\n')
          : '*Incidentes*\\nSin incidentes reportados'
      }
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: \`:warning: *Accion requerida:* revisar anuncios vencidos sin pausar y escalar incidente operativo.\` }
      ]
    }
  ]
};

// ── Telegram HTML ─────────────────────────────────────────────────────────────
const incidentHtml = incidents.length
  ? incidents.map(it => \`&#10060; <b>\${it.code ?? 'INCIDENT'}</b> — \${it.message ?? ''}\`).join('\\n')
  : 'Sin incidentes reportados';

const telegramText = [
  '&#128680; <b>CRITICAL — AdsKiller Kill-Switch Diario</b>',
  '',
  \`&#128203; <b>Execution ID:</b> <code>\${$json.execution_id ?? 'N/A'}</code>\`,
  \`&#128279; <b>Correlation ID:</b> <code>\${$json.correlation_id}</code>\`,
  \`&#9881; \${$json.derived.execution_mode} | \${String($json.execution_status).toUpperCase()}\`,
  '',
  '<b>Metricas:</b>',
  \`  Contratos: \${m.contracts_evaluated}  |  Ads: \${m.ads_evaluated}\`,
  \`  Pausados OK: \${m.paused_success_count} &#9989;  |  Errores: \${m.paused_error_count}\`,
  \`  Preventivas 48h: \${m.preventive_48h_count}  |  Duracion: \${durationSec}s\`,
  \`  Vencidos sin pausar: <b>\${m.expired_unpaused_count}</b> &#9888;\`,
  '',
  '<b>Incidentes:</b>',
  incidentHtml,
  '',
  '<i>&#9888; Accion requerida: revisar anuncios vencidos sin pausar y escalar incidente operativo.</i>'
].join('\\n');

return [{ json: { ...$json, message_text: telegramText, message_slack: slackPayload, message_telegram: telegramText } }];
`.trim();

// ─── Build_InfoWarnMessage ────────────────────────────────────────────────────

const INFOWARN_CODE = `
const m = $json.metrics;
const incidents = ($json.incidents ?? []).slice(0, 5);
const severity = $json.derived.severity; // INFO o WARN

const durationSec = (m.duration_ms / 1000).toFixed(1);

const severityEmoji = severity === 'WARN' ? ':warning:' : ':white_check_mark:';
const severityEmojiHtml = severity === 'WARN' ? '&#9888;' : '&#9989;';

// ── Slack Block Kit ───────────────────────────────────────────────────────────
const incidentSlack = incidents.length
  ? incidents.map(it => \`:x: \${it.code ?? 'INCIDENT'} — \${it.message ?? ''}\`).join('\\n')
  : 'Sin incidentes reportados';

const slackPayload = {
  text: \`[\${severity}] AdsKiller Kill-Switch\`,
  blocks: [
    {
      type: 'header',
      text: { type: 'plain_text', text: \`\${severity === 'WARN' ? ':warning:' : ':white_check_mark:'} \${severity} — AdsKiller Kill-Switch Diario\`, emoji: true }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: \`*Execution ID*\\n\\\`\${$json.execution_id ?? 'N/A'}\\\`\` },
        { type: 'mrkdwn', text: \`*Correlation ID*\\n\\\`\${$json.correlation_id}\\\`\` },
        { type: 'mrkdwn', text: \`*Modo*\\n\${$json.derived.execution_mode}\` },
        { type: 'mrkdwn', text: \`*Estado*\\n\${String($json.execution_status).toUpperCase()}\` }
      ]
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          '*Metricas*',
          \`• Contratos evaluados: \${m.contracts_evaluated}  |  Ads evaluados: \${m.ads_evaluated}\`,
          \`• Pausados OK: \${m.paused_success_count}  |  Errores al pausar: \${m.paused_error_count}\`,
          \`• Preventivas 48h: \${m.preventive_48h_count}  |  Duracion: \${durationSec}s\`
        ].join('\\n')
      }
    },
    ...(incidents.length ? [
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Incidentes*\\n' + incidents.map(it => \`:warning: \${it.code ?? 'INCIDENT'} — \${it.message ?? ''}\`).join('\\n')
        }
      }
    ] : [])
  ]
};

// ── Telegram HTML ─────────────────────────────────────────────────────────────
const incidentHtml = incidents.length
  ? incidents.map(it => \`&#9888; <b>\${it.code ?? 'INCIDENT'}</b> — \${it.message ?? ''}\`).join('\\n')
  : null;

const telegramLines = [
  \`\${severityEmojiHtml} <b>\${severity} — AdsKiller Kill-Switch Diario</b>\`,
  '',
  \`&#128203; <b>Execution ID:</b> <code>\${$json.execution_id ?? 'N/A'}</code>\`,
  \`&#128279; <b>Correlation ID:</b> <code>\${$json.correlation_id}</code>\`,
  \`&#9881; \${$json.derived.execution_mode} | \${String($json.execution_status).toUpperCase()}\`,
  '',
  '<b>Metricas:</b>',
  \`  Contratos: \${m.contracts_evaluated}  |  Ads: \${m.ads_evaluated}\`,
  \`  Pausados OK: \${m.paused_success_count} &#9989;  |  Errores: \${m.paused_error_count}\`,
  \`  Preventivas 48h: \${m.preventive_48h_count}  |  Duracion: \${durationSec}s\`
];
if (incidentHtml) {
  telegramLines.push('', '<b>Incidentes:</b>', incidentHtml);
}
const telegramText = telegramLines.join('\\n');

return [{ json: { ...$json, message_text: telegramText, message_slack: slackPayload, message_telegram: telegramText } }];
`.trim();

// ─── Apply ────────────────────────────────────────────────────────────────────

async function apply() {
  console.log('[F3] Fetching...');
  const r = await apiRequest('GET', '/api/v1/workflows/BFHHQwYFfmcpqshb');
  if (r.status !== 200) { console.error('FAIL GET', r.status); return; }
  const wf = r.body;

  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  fs.writeFileSync(`workflows/backups/BFHHQwYFfmcpqshb-${stamp}-before-rich-msg.json`, JSON.stringify(wf, null, 2));

  wf.nodes = wf.nodes.map(n => {
    if (n.name === 'Build_CriticalMessage') {
      n.parameters.jsCode = CRITICAL_CODE;
      console.log('  Build_CriticalMessage: rich format applied');
    }
    if (n.name === 'Build_InfoWarnMessage') {
      n.parameters.jsCode = INFOWARN_CODE;
      console.log('  Build_InfoWarnMessage: rich format applied');
    }
    // Slack: send Block Kit payload
    if (n.name === 'Send_SlackNotification') {
      n.parameters.jsonBody = '={{ $json.message_slack }}';
      console.log('  Send_SlackNotification: -> message_slack (Block Kit)');
    }
    // Telegram: send HTML
    if (n.name === 'Send_TelegramNotification') {
      n.parameters.jsonBody = '={{ { chat_id: $json.notification.telegram.chat_id, text: $json.message_telegram, parse_mode: "HTML" } }}';
      console.log('  Send_TelegramNotification: -> message_telegram (HTML)');
    }
    return n;
  });

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: stripSettings(wf.settings || {}) };
  const put = await apiRequest('PUT', '/api/v1/workflows/BFHHQwYFfmcpqshb', payload);
  if (put.status === 200) console.log('  OK — rich messages deployed');
  else console.error('  FAIL PUT', put.status, JSON.stringify(put.body).slice(0, 300));
}

(async () => {
  if (!N8N_KEY) { console.error('N8N_API_KEY missing'); process.exit(1); }
  await apply();
})();
