/**
 * fix-notifications.js
 *
 * Fix C: Inyectar credenciales de notificación en F2 antes de llamar a F3.
 *
 * Situación real (post-investigación):
 *   - F3 (BFHHQwYFfmcpqshb) ya está ACTIVE — no necesita activarse
 *   - F2 llama a F3 via dos nodos HTTP Request:
 *       1. "Emitir Alerta Operativa"  (rama preventiva)
 *       2. "Emitir Alerta Crítica"    (rama crítica/vencida)
 *   - Ambos envían `$json` como body → F3 lee $json.notification.telegram.bot_token
 *   - Como ese campo no existe en $json, F3 nunca envía Telegram ni Slack
 *
 * Fix: insertar nodo "Set Notification Config" (Code) ANTES de cada uno de esos
 *      dos nodos HTTP, que mezcle las credenciales en el item antes de enviarlo.
 *
 * Env vars requeridas:
 *   N8N_API_KEY
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *   SLACK_WEBHOOK_URL    (opcional, dejar vacío si no se usa)
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const N8N_KEY          = process.env.N8N_API_KEY;
const TELEGRAM_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SLACK_WEBHOOK    = process.env.SLACK_WEBHOOK_URL ?? '';

const F2_ID      = '8mlwAxLtJVrwpLhi';
const BACKUP_DIR = path.join(__dirname, '..', 'workflows', 'backups');

if (!N8N_KEY)          { console.error('N8N_API_KEY requerida');        process.exit(1); }
if (!TELEGRAM_TOKEN)   { console.error('TELEGRAM_BOT_TOKEN requerida'); process.exit(1); }
if (!TELEGRAM_CHAT_ID) { console.error('TELEGRAM_CHAT_ID requerida');   process.exit(1); }

// ─── HTTP helper ─────────────────────────────────────────────────────────────
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

// ─── Código del nodo Consolidar Alertas Preventivas ─────────────────────────
// Colapsa N items preventivos en 1 solo item con lista de influencers.
// Va ANTES de Set Notif Config en la rama preventiva.
const CONSOLIDAR_CODE = [
  '// Consolida N alertas preventivas en 1 mensaje con lista de influencers',
  'const items = $input.all();',
  'const incidents = items.map(item => {',
  '  const j = item.json;',
  "  const id     = String(j.Contrato_ID ?? '');",
  "  const nombre = String(j.Cliente ?? j.Nombre ?? j.nombre ?? id);",
  "  const fecha  = String(j.Fecha_Fin ?? j.fecha_fin ?? '');",
  "  return { code: 'PREVENTIVE_48H', message: nombre + ' (' + id + ') \u2014 vence ' + fecha };",
  '});',
  '',
  'return [{',
  '  json: {',
  '    ...items[0]?.json,',
  '    incidents,',
  '    metrics: {',
  '      contracts_evaluated:    items.length,',
  '      ads_evaluated:          0,',
  '      paused_success_count:   0,',
  '      paused_error_count:     0,',
  '      expired_unpaused_count: 0,',
  '      preventive_48h_count:   items.length,',
  '      duration_ms:            0,',
  '    },',
  '  },',
  '}];',
].join('\n');

// ─── Código del nodo Set Notification Config ──────────────────────────────────
// Inyecta SOLO credenciales + contexto de ejecución.
// metrics e incidents ya vienen del nodo Consolidar que lo precede.
function buildNotifCode() {
  return `// Inyecta credenciales de notificación y contexto de ejecución antes de F3
// metrics e incidents son calculados por el nodo Consolidar Alertas Preventivas
return $input.all().map(item => ({
  json: {
    ...item.json,
    execution_status: item.json.execution_status ?? 'warn',
    execution_mode:   String(item.json.run_mode ?? item.json.execution_mode ?? 'scheduled'),
    executed_at:      item.json.executed_at ?? new Date().toISOString(),
    correlation_id:   item.json.correlation_id ?? \`ak-\${Date.now()}-notif\`,
    notification: {
      channel: 'telegram',
      telegram: {
        bot_token: ${JSON.stringify(TELEGRAM_TOKEN)},
        chat_id:   ${JSON.stringify(String(TELEGRAM_CHAT_ID))},
      },
      slack: {
        webhook_url: ${JSON.stringify(SLACK_WEBHOOK)},
      },
    },
  },
}));`;
}

// ─── Helper: insertar nodo ANTES de un nodo objetivo ─────────────────────────
// Rewiring: todas las conexiones que apuntaban a targetName → apuntan al nuevo nodo
//           nuevo nodo → apunta a targetName
function insertNodeBefore(nodes, connections, targetName, newNode) {
  // Si ya existe, solo actualizar el código (idempotente)
  const existing = nodes.find(n => n.name === newNode.name);
  if (existing) {
    if (newNode.parameters?.jsCode) existing.parameters.jsCode = newNode.parameters.jsCode;
    console.log(`  (${newNode.name} ya existía — código actualizado)`);
    return;
  }

  // Posicionar a la izquierda del nodo objetivo
  const targetNode = nodes.find(n => n.name === targetName);
  newNode.position = targetNode?.position
    ? [targetNode.position[0] - 280, targetNode.position[1]]
    : [0, 0];

  nodes.push(newNode);

  // Redirigir conexiones entrantes al nuevo nodo
  for (const [srcName, srcConns] of Object.entries(connections)) {
    (srcConns.main ?? []).forEach((slot, slotIdx) => {
      if (!slot) return;
      slot.forEach((conn, connIdx) => {
        if (conn.node === targetName) {
          connections[srcName].main[slotIdx][connIdx] = { ...conn, node: newNode.name };
        }
      });
    });
  }

  // Nuevo nodo → objetivo
  connections[newNode.name] = {
    main: [[{ node: targetName, type: 'main', index: 0 }]],
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔧 Fix Notificaciones — inyectar credenciales en F2');
  console.log('====================================================');
  console.log('  Telegram chat_id:', TELEGRAM_CHAT_ID);
  console.log('  Slack webhook:   ', SLACK_WEBHOOK ? 'configurado' : '(vacío)');

  // GET F2
  const r = await api('GET', `/api/v1/workflows/${F2_ID}`);
  if (r.s !== 200) { console.error('GET F2 error:', r.s, r.b); process.exit(1); }
  const wf = r.b;
  console.log(`\n✓ F2 obtenido: "${wf.name}" (${wf.nodes.length} nodos)`);

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const bkp   = path.join(BACKUP_DIR, `${F2_ID}-${stamp}-pre-notif-fix.json`);
  fs.writeFileSync(bkp, JSON.stringify(wf, null, 2));
  console.log(`✓ Backup: ${path.basename(bkp)}`);

  const nodes = wf.nodes;
  const conns = wf.connections;
  const notifCode = buildNotifCode();

  // Nodos HTTP que llaman a F3 — necesitan credenciales inyectadas antes
  // Nota: algunos nombres tienen mojibake (doble-encodeo UTF-8) en la DB de n8n,
  // por eso buscamos por URL del webhook en lugar de nombre exacto.
  const f3WebhookUrl = 'ops-reporting-alerts';
  const f3Callers = nodes.filter(n =>
    n.type === 'n8n-nodes-base.httpRequest' &&
    String(n.parameters?.url ?? '').includes(f3WebhookUrl)
  );
  const targets = f3Callers.map(n => n.name);
  console.log(`\nNodos que llaman a F3: ${targets.join(', ')}`);

  for (const targetName of targets) {
    const targetNode = nodes.find(n => n.name === targetName);
    if (!targetNode) {
      console.warn(`\n⚠ "${targetName}" no encontrado — skip`);
      continue;
    }
    const setNodeName = `Set Notif Config (${targetName})`;
    console.log(`\n✓ Insertando/actualizando "${setNodeName}" antes de "${targetName}"`);
    insertNodeBefore(nodes, conns, targetName, {
      id:          `set-notif-${targetName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name:        setNodeName,
      type:        'n8n-nodes-base.code',
      typeVersion: 2,
      parameters:  { jsCode: notifCode },
    });
  }

  // ── Fix 3: Consolidar Alertas Preventivas (rama preventiva solamente) ──────
  // Buscar el Set Notif Config de la rama preventiva (contiene "Operativa")
  const preventiveSetNotif = nodes.find(n =>
    n.name.startsWith('Set Notif Config') && n.name.includes('Operativa')
  );
  if (preventiveSetNotif) {
    const consolidarName = 'Consolidar Alertas Preventivas';
    console.log(`\n✓ Insertando/actualizando "${consolidarName}" antes de "${preventiveSetNotif.name}"`);
    insertNodeBefore(nodes, conns, preventiveSetNotif.name, {
      id:          'consolidar-alertas-preventivas',
      name:        consolidarName,
      type:        'n8n-nodes-base.code',
      typeVersion: 2,
      parameters:  { jsCode: CONSOLIDAR_CODE },
    });
  } else {
    console.warn('\n⚠ Fix 3: Set Notif Config (Operativa) no encontrado — no se insertó Consolidar');
    console.warn('  Nodos Set Notif Config disponibles:', nodes.filter(n => n.name.startsWith('Set Notif Config')).map(n => n.name));
  }

  // PUT F2
  const payload = {
    name:        wf.name,
    nodes:       wf.nodes,
    connections: wf.connections,
    settings:    stripSettings(wf.settings || {}),
    staticData:  wf.staticData,
  };
  console.log(`\n📤 Subiendo F2 (${nodes.length} nodos)...`);
  const put = await api('PUT', `/api/v1/workflows/${F2_ID}`, payload);
  if (put.s !== 200) {
    console.error('PUT error:', JSON.stringify(put.b).slice(0, 600));
    process.exit(1);
  }
  console.log('✅ F2 actualizado\n');

  // Verificación
  const verify = await api('GET', `/api/v1/workflows/${F2_ID}`);
  const vn          = verify.b.nodes;
  const verifyConns = verify.b.connections;

  console.log('── Verificación ──────────────────────────────────────────────────');
  for (const targetName of targets) {
    const setName  = `Set Notif Config (${targetName})`;
    const n        = vn.find(x => x.name === setName);
    const hasToken = n?.parameters?.jsCode?.includes(TELEGRAM_TOKEN.slice(0, 10));
    const hasMetricsOverride = n?.parameters?.jsCode?.includes('contracts_evaluated');
    const outgoing = verifyConns[setName]?.main?.[0]?.[0]?.node;
    console.log(`✓ ${setName}`);
    console.log(`  existe=${!!n}, token_ok=${!!hasToken}, metrics_override=${!!hasMetricsOverride} (debe ser false), → "${outgoing ?? '(sin conexión)'}"`);
  }
  const consolidar = vn.find(n => n.name === 'Consolidar Alertas Preventivas');
  const consolidarOut = verifyConns['Consolidar Alertas Preventivas']?.main?.[0]?.[0]?.node;
  console.log('\n✓ Consolidar Alertas Preventivas');
  console.log(`  existe=${!!consolidar}, incidents_ok=${consolidar?.parameters?.jsCode?.includes('PREVENTIVE_48H') ?? false}, → "${consolidarOut ?? '(sin conexión)'}"`);
  console.log('──────────────────────────────────────────────────────────────────');
  console.log('\nPróximos pasos:');
  console.log('  1. Correr F2 manualmente en n8n');
  console.log('  2. Verificar 1 solo mensaje en Telegram con lista de influencers');
  console.log('  3. Revisar historial de F3 (BFHHQwYFfmcpqshb)');
}

main().catch(e => { console.error(e); process.exit(1); });
