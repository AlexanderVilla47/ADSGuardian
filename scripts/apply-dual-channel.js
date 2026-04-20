/**
 * apply-dual-channel.js
 *
 * 1. F3: cambia Is_SlackChannel e Is_TelegramChannel a routing por presencia
 *        de credenciales (no por campo "channel").
 *        Conecta ambos IFs en PARALELO desde Build_CriticalMessage y Build_InfoWarnMessage.
 *
 * 2. F2: agrega campo "notification" con Slack + Telegram en Payload Alerta Preventiva.
 *        Cambia URL de Emitir Alerta Operativa y Emitir Alerta Crítica a F3 real.
 */

const fs   = require('fs');
const http = require('http');

const N8N_BASE = 'http://168.138.125.21:5678';
const N8N_KEY  = process.env.N8N_API_KEY;

const SLACK_WEBHOOK = '__REDACTED_SLACK_WEBHOOK__';
const TG_BOT_TOKEN  = '__REDACTED_TELEGRAM_BOT_TOKEN__';
const TG_CHAT_ID    = '__REDACTED_TELEGRAM_CHAT_ID__';
const F3_WEBHOOK_URL = 'http://168.138.125.21:5678/webhook/ops-reporting-alerts';

// ── HTTP helper ────────────────────────────────────────────────────────────────

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

// ── IF v2 condition helper ────────────────────────────────────────────────────

function ifV2Exists(leftExpr) {
  return {
    conditions: {
      options: { caseSensitive: false, leftValue: '', typeValidation: 'loose' },
      conditions: [{
        leftValue: leftExpr,
        rightValue: '',
        operator: { type: 'string', operation: 'notEmpty' }
      }],
      combinator: 'and'
    }
  };
}

// ── F3 fix ────────────────────────────────────────────────────────────────────

async function fixF3() {
  console.log('\n[F3] Fetching...');
  const r = await apiRequest('GET', '/api/v1/workflows/BFHHQwYFfmcpqshb');
  if (r.status !== 200) { console.error('  FAIL GET', r.status); return; }
  const wf = r.body;

  // Backup
  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  fs.writeFileSync(`workflows/backups/BFHHQwYFfmcpqshb-${stamp}-before-dual-channel.json`, JSON.stringify(wf, null, 2));

  wf.nodes = wf.nodes.map(n => {
    // Is_SlackChannel: check webhook_url exists
    if (n.name === 'Is_SlackChannel') {
      n.parameters = ifV2Exists('={{ $json.notification.slack.webhook_url }}');
    }
    // Is_TelegramChannel: check bot_token exists
    if (n.name === 'Is_TelegramChannel') {
      n.parameters = ifV2Exists('={{ $json.notification.telegram.bot_token }}');
    }
    return n;
  });

  // Connections: both IFs now wired in parallel from Build_CriticalMessage and Build_InfoWarnMessage
  // Current: Build_Critical → Is_Slack [0] → Send_Slack / [1] → Is_Telegram
  //          Build_InfoWarn → Is_Slack [0] → Send_Slack / [1] → Is_Telegram
  // New:     Build_Critical → Is_Slack AND Is_Telegram (parallel)
  //          Build_InfoWarn → Is_Slack AND Is_Telegram (parallel)
  // Is_Slack [0] → Send_Slack | [1] → (noop — no unsupported for slack)
  // Is_Telegram [0] → Send_Telegram | [1] → Log_UnsupportedChannel

  const conn = wf.connections;

  // Wire both message builders to both IFs in parallel
  ['Build_CriticalMessage', 'Build_InfoWarnMessage'].forEach(src => {
    conn[src] = {
      main: [
        [
          { node: 'Is_SlackChannel',   type: 'main', index: 0 },
          { node: 'Is_TelegramChannel', type: 'main', index: 0 }
        ]
      ]
    };
  });

  // Is_SlackChannel: [0] → Send_Slack, [1] → nothing (skip, no unsupported for slack alone)
  conn['Is_SlackChannel'] = {
    main: [
      [{ node: 'Send_SlackNotification', type: 'main', index: 0 }],
      [] // false branch: no Slack configured → silence
    ]
  };

  // Is_TelegramChannel: [0] → Send_Telegram, [1] → Log_UnsupportedChannel
  conn['Is_TelegramChannel'] = {
    main: [
      [{ node: 'Send_TelegramNotification', type: 'main', index: 0 }],
      [{ node: 'Log_UnsupportedChannel',    type: 'main', index: 0 }]
    ]
  };

  const payload = { name: wf.name, nodes: wf.nodes, connections: conn, settings: stripSettings(wf.settings || {}) };
  const put = await apiRequest('PUT', '/api/v1/workflows/BFHHQwYFfmcpqshb', payload);
  if (put.status === 200) console.log('  OK — F3 dual-channel routing applied');
  else console.error('  FAIL PUT', put.status, JSON.stringify(put.body).slice(0,300));
}

// ── F2 fix ────────────────────────────────────────────────────────────────────

async function fixF2() {
  console.log('\n[F2] Fetching...');
  const r = await apiRequest('GET', '/api/v1/workflows/8mlwAxLtJVrwpLhi');
  if (r.status !== 200) { console.error('  FAIL GET', r.status); return; }
  const wf = r.body;

  const stamp = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  fs.writeFileSync(`workflows/backups/8mlwAxLtJVrwpLhi-${stamp}-before-dual-channel.json`, JSON.stringify(wf, null, 2));

  const notificationValue = JSON.stringify({
    slack:    { webhook_url: SLACK_WEBHOOK },
    telegram: { bot_token: TG_BOT_TOKEN, chat_id: TG_CHAT_ID }
  });

  wf.nodes = wf.nodes.map(n => {
    // Payload Alerta Preventiva — add notification field
    if (n.name === 'Payload Alerta Preventiva') {
      const existing = n.parameters.assignments?.assignments ?? [];
      const hasNotif = existing.some(a => a.name === 'notification');
      if (!hasNotif) {
        existing.push({
          id: 'notif-dual-channel',
          name: 'notification',
          value: `=${notificationValue}`,
          type: 'object'
        });
        n.parameters.assignments.assignments = existing;
      } else {
        // update existing
        n.parameters.assignments.assignments = existing.map(a =>
          a.name === 'notification'
            ? { ...a, value: `=${notificationValue}`, type: 'object' }
            : a
        );
      }
      console.log('  Payload Alerta Preventiva — notification field set');
    }

    // Emitir Alerta Operativa — point to F3 real webhook
    if (n.name === 'Emitir Alerta Operativa') {
      n.parameters.url = F3_WEBHOOK_URL;
      console.log('  Emitir Alerta Operativa — URL → F3');
    }

    // Emitir Alerta Crítica (handle encoding variants)
    if (n.name.startsWith('Emitir Alerta')) {
      n.parameters.url = F3_WEBHOOK_URL;
      console.log(' ', n.name, '— URL → F3');
    }

    // Build Finalizado Payload — inject notification into return
    // Already uses $input.all().map() — we patch the jsCode to add notification
    if (n.name === 'Build Finalizado Payload') {
      if (!n.parameters.jsCode.includes('notification')) {
        n.parameters.jsCode = n.parameters.jsCode.replace(
          'Status_Contrato: \'Finalizado\'',
          `notification: ${notificationValue},\n      Status_Contrato: 'Finalizado'`
        );
        console.log('  Build Finalizado Payload — notification injected');
      }
    }

    return n;
  });

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: stripSettings(wf.settings || {}) };
  const put = await apiRequest('PUT', '/api/v1/workflows/8mlwAxLtJVrwpLhi', payload);
  if (put.status === 200) console.log('  OK — F2 dual-channel + F3 wiring applied');
  else console.error('  FAIL PUT', put.status, JSON.stringify(put.body).slice(0,300));
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  if (!N8N_KEY) { console.error('N8N_API_KEY missing'); process.exit(1); }
  await fixF3();
  await fixF2();
  console.log('\nDone.');
})();
