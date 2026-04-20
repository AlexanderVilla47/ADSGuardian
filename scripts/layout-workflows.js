const fs = require('fs');
const http = require('http');

const N8N_BASE = 'http://168.138.125.21:5678';
const N8N_KEY = process.env.N8N_API_KEY;

// ─────────────────────────────────────────────────
// POSITION MAPS (node name → [x, y])
// ─────────────────────────────────────────────────

const F1_POSITIONS = {
  // Main spine
  'Webhook UI':             [0, 0],
  'Normalize Request':      [280, 0],
  'Validate Input':         [560, 0],
  'Route Action':           [840, 0],
  // Validation error (above main spine)
  'Respond Validation Error': [560, -220],
  // Branch: alta (y=220)
  'Prepare Alta Row':       [1120, 220],
  'GS Append Alta':         [1400, 220],
  'Respond Alta':           [1680, 220],
  // Branch: consulta (y=440)
  'GS Read Contratos':      [1120, 440],
  'Filter Proximos Vencer': [1400, 440],
  'Respond Consulta':       [1680, 440],
  // Branch: extension (y=660)
  'GS Read For Extension':  [1120, 660],
  'Prepare Extension Row':  [1400, 660],
  'GS Update Extension':    [1680, 660],
  'Respond Extension':      [1960, 660],
  // Branch: baja_manual (y=880)
  'GS Read For Baja':       [1120, 880],
  'Prepare Baja Row':       [1400, 880],
  'GS Update Baja':         [1680, 880],
  'Respond Baja Manual':    [1960, 880],
  // Branch: listar_ads (y=1100)
  'GS Read For Listar Ads':     [1120, 1100],
  'Build Listar Ads Response':  [1400, 1100],
  'Respond Listar Ads':         [1680, 1100],
  // Branch: run_now / pause_active shared (y=1320)
  'Build Operation Tracking':   [1120, 1320],
  'GS Append Operation Log':    [1400, 1320],
  'Respond Operation Accepted': [1680, 1320],
  // F2 dispatch sub-branch (y=1540)
  'Build Internal Payload F1->F2': [1120, 1540],
  'Should Dispatch F2':            [1400, 1540],
  'Execute F2 Internal':           [1680, 1540],
  'Log F1 Chain Dispatch OK':      [1960, 1440],
  'Log F1 Chain Dispatch Error':   [1960, 1640],
  // Branch: history (y=1760)
  'GS Read Operations History': [1120, 1760],
  'Build History Response':     [1400, 1760],
  'Respond History':            [1680, 1760],
  // Branch: pause_active preview (y=1980)
  'GS Read For Pause Active Preview': [1120, 1980],
  'Build Pause Active Preview':       [1400, 1980],
  'Respond Pause Active Preview':     [1680, 1980],
  // Branch: search (y=2200)
  'GS Read For Search':    [1120, 2200],
  'Filter Search Results': [1400, 2200],
  'Respond Search':        [1680, 2200],
};

const F2_POSITIONS = {
  // Entry triggers
  'Cron Diario 00:01':         [0, -160],
  'Trigger Manual On-Demand':  [0, 0],
  'Contexto Scheduled':        [240, -160],
  'Contexto Manual':           [240, 0],
  // Shared spine
  'Sheets - Leer Contratos':   [480, -80],
  'Clasificar Contratos (Activo / 48h / Vencido)': [760, -80],
  // Preventiva branch (y=-300)
  'Expand Preventiva':         [1000, -300],
  'Payload Alerta Preventiva': [1240, -300],
  'Emitir Alerta Operativa':   [1480, -300],
  'If':                        [1720, -300],
  'No Operation, do nothing1': [1960, -460],
  'Merge':                     [1960, -300],
  'Sheets - Marcar Notificado_Previo': [2200, -300],
  // Vencidos / pausa lane (y=120)
  'Expand Vencidos':                   [1000, 120],
  'Regex Coincide con Nombre (Sheet)': [1240, 120],
  'Init Retry Precheck':               [1480, 120],
  'Meta - Precheck Estado Ad':         [1720, 120],
  'Normalizar HTTP Precheck':          [1960, 120],
  'Evaluar Precheck Meta':             [2200, 120],
  'Rutear Estado Precheck':            [2440, 120],
  'Wait 5m Precheck Retry':            [2440, 340],
  'No Operation, do nothing':          [2440, 520],
  'Init Retry Pausa':                  [2680, 120],
  'Meta - Pausar Ad':                  [2920, 120],
  'Normalizar HTTP Pausa':             [3160, 120],
  'Evaluar Pausa':                     [3400, 120],
  'Rutear Resultado Pausa':            [3640, 120],
  'Wait 5m Pausa Retry':               [3640, 340],
  'Build Finalizado Payload':          [3880, 120],
  'Finalizado Payload Valido':         [4120, 120],
  'Sheets - Marcar Finalizado':        [4360, 120],
  // Alerts row (y=620) — node names with Latin1 encoding as they appear in JSON
  'Alerta Cr\u00ed\u00adtica - Regex inv\u00e1\u00adlido':   [1480, 620],
  'Alerta CrÃ­tica - Regex invÃ¡lido':                        [1480, 620],
  'Alerta Cr\u00edtica - Regex inv\u00e1lido':                [1480, 620],
  'Alerta Cr\u00ed\u00adtica - Precheck fallido':              [2680, 620],
  'Alerta CrÃ­tica - Precheck fallido':                        [2680, 620],
  'Alerta Cr\u00edtica - Precheck fallido':                    [2680, 620],
  'Alerta Cr\u00ed\u00adtica - Pausa fallida':                 [4120, 620],
  'Alerta CrÃ­tica - Pausa fallida':                           [4120, 620],
  'Alerta Cr\u00edtica - Pausa fallida':                       [4120, 620],
  'Emitir Alerta CrÃ­tica':                                    [4360, 620],
  'Emitir Alerta Cr\u00edtica':                                [4360, 620],
  'Stop and Error - Escalar Incidente':                        [4600, 620],
};

const F3_POSITIONS = {
  'Normalize_InternalExecuteTrigger':  [0, -120],
  'Normalize_KillSwitchResultWebhook': [0, 120],
  'Normalize_Payload':    [240, 0],
  'Is_CriticalAlert':     [480, 0],
  'Build_CriticalMessage':[720, -240],
  'Build_InfoWarnMessage':[720, 240],
  'Build Alert Row F3':       [960, -420],
  'GS Append Alertas F3':     [1200, -420],
  'Is_SlackChannel':          [960, 0],
  'Send_SlackNotification':   [1200, -200],
  'Is_TelegramChannel':       [1200, 200],
  'Log_SlackSent':            [1440, -360],
  'Log_ChannelSendFailure':   [1440, -120],
  'Send_TelegramNotification':[1440, 120],
  'Log_UnsupportedChannel':   [1440, 360],
  'Log_TelegramSent':         [1680, 120],
  'Build OpsLog Row F3':          [1680, -120],
  'GS Append Operations Log F3':  [1920, -120],
};

// ─────────────────────────────────────────────────
// HTTP helper
// ─────────────────────────────────────────────────

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(N8N_BASE + path);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search,
      method,
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

// ─────────────────────────────────────────────────
// Apply layout to one workflow
// ─────────────────────────────────────────────────

async function applyLayout(workflowId, posMap, label) {
  console.log(`\n[${label}] Getting workflow ${workflowId}...`);
  const getRes = await apiRequest('GET', `/api/v1/workflows/${workflowId}`);
  if (getRes.status !== 200) { console.error(`  FAIL GET: ${getRes.status}`); return; }

  const wf = getRes.body;
  let moved = 0;
  const notFound = [];

  wf.nodes = wf.nodes.map(node => {
    const pos = posMap[node.name];
    if (pos) { node.position = pos; moved++; }
    else notFound.push(node.name);
    return node;
  });

  if (notFound.length) console.log(`  WARN no position defined for: ${notFound.join(' | ')}`);
  console.log(`  Repositioned ${moved}/${wf.nodes.length} nodes`);

  // Backup before PUT
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = `workflows/backups/${workflowId}-${stamp}-before-layout.json`;
  fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));
  console.log(`  Backup saved: ${backupPath}`);

  // Strip settings to n8n-accepted fields only (binaryMode etc. cause 400)
  const ALLOWED_SETTINGS = [
    'executionOrder','saveManualExecutions','saveDataSuccessExecution',
    'saveDataErrorExecution','saveExecutionProgress','executionTimeout',
    'timezone','errorWorkflow','callerIds','callerPolicy'
  ];
  const rawSettings = wf.settings || {};
  const settings = {};
  for (const k of ALLOWED_SETTINGS) {
    if (rawSettings[k] !== undefined) settings[k] = rawSettings[k];
  }

  // Minimal PUT
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings
  };

  console.log(`  PUTting...`);
  const putRes = await apiRequest('PUT', `/api/v1/workflows/${workflowId}`, payload);
  if (putRes.status === 200) {
    console.log(`  OK — ${label} layout applied`);
  } else {
    console.error(`  FAIL PUT ${putRes.status}:`, JSON.stringify(putRes.body).slice(0, 400));
  }
}

// ─────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────

(async () => {
  if (!N8N_KEY) { console.error('ERROR: N8N_API_KEY env var not set'); process.exit(1); }
  await applyLayout('cFBr6GavlSWDsUFz', F1_POSITIONS, 'F1 contract-ui-management');
  await applyLayout('8mlwAxLtJVrwpLhi', F2_POSITIONS, 'F2 killswitch');
  await applyLayout('BFHHQwYFfmcpqshb', F3_POSITIONS, 'F3 ops-reporting');
  console.log('\nDone. In the canvas: Ctrl+Shift+H to fit view.');
})();
