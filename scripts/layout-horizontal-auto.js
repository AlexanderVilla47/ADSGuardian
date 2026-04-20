const fs = require('fs');
const path = require('path');
const http = require('http');

const N8N_BASE = (process.env.N8N_BASE_URL || 'http://168.138.125.21:5678').replace(/\/+$/, '');
const N8N_KEY = process.env.N8N_API_KEY;
const WORKFLOW_IDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['cFBr6GavlSWDsUFz', '8mlwAxLtJVrwpLhi', 'BFHHQwYFfmcpqshb'];

const ALLOWED_SETTINGS = [
  'executionOrder',
  'saveManualExecutions',
  'saveDataSuccessExecution',
  'saveDataErrorExecution',
  'saveExecutionProgress',
  'executionTimeout',
  'timezone',
  'errorWorkflow',
  'callerIds',
  'callerPolicy',
];

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(`${N8N_BASE}${endpoint}`);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method,
        headers: {
          'X-N8N-API-KEY': N8N_KEY,
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function extractEdges(connections) {
  const edges = [];
  for (const [source, channelMap] of Object.entries(connections || {})) {
    if (!channelMap || typeof channelMap !== 'object') continue;
    for (const outputs of Object.values(channelMap)) {
      if (!Array.isArray(outputs)) continue;
      for (const output of outputs) {
        if (!Array.isArray(output)) continue;
        for (const link of output) {
          if (link && typeof link.node === 'string') {
            edges.push([source, link.node]);
          }
        }
      }
    }
  }
  return edges;
}

function stableSortByExistingPosition(nodesByName, names) {
  return names.slice().sort((a, b) => {
    const pa = nodesByName.get(a)?.position ?? [0, 0];
    const pb = nodesByName.get(b)?.position ?? [0, 0];
    if (pa[1] !== pb[1]) return pa[1] - pb[1];
    if (pa[0] !== pb[0]) return pa[0] - pb[0];
    return a.localeCompare(b);
  });
}

function autoLayout(nodes, connections) {
  const nodeNames = nodes.map((n) => n.name);
  const nameSet = new Set(nodeNames);
  const nodesByName = new Map(nodes.map((n) => [n.name, n]));
  const edges = extractEdges(connections).filter(([s, t]) => nameSet.has(s) && nameSet.has(t));

  const indegree = new Map(nodeNames.map((n) => [n, 0]));
  const adj = new Map(nodeNames.map((n) => [n, []]));
  const incoming = new Map(nodeNames.map((n) => [n, []]));

  for (const [s, t] of edges) {
    adj.get(s).push(t);
    incoming.get(t).push(s);
    indegree.set(t, indegree.get(t) + 1);
  }

  const level = new Map(nodeNames.map((n) => [n, 0]));
  const queue = stableSortByExistingPosition(
    nodesByName,
    nodeNames.filter((n) => indegree.get(n) === 0),
  );
  const processed = new Set();

  while (queue.length) {
    const u = queue.shift();
    processed.add(u);
    for (const v of adj.get(u)) {
      level.set(v, Math.max(level.get(v), level.get(u) + 1));
      indegree.set(v, indegree.get(v) - 1);
      if (indegree.get(v) === 0) queue.push(v);
    }
    queue.sort((a, b) => {
      const la = level.get(a);
      const lb = level.get(b);
      if (la !== lb) return la - lb;
      return stableSortByExistingPosition(nodesByName, [a, b])[0] === a ? -1 : 1;
    });
  }

  const unresolved = nodeNames.filter((n) => !processed.has(n));
  for (const n of unresolved) {
    const preds = incoming.get(n);
    if (preds.length) {
      level.set(
        n,
        Math.max(
          level.get(n),
          Math.max(...preds.map((p) => level.get(p))) + 1,
        ),
      );
    }
  }

  const groups = new Map();
  for (const name of nodeNames) {
    const l = level.get(name) || 0;
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l).push(name);
  }

  const levels = Array.from(groups.keys()).sort((a, b) => a - b);
  const X_GAP = 380;
  const Y_GAP = 220;
  const X_START = 0;

  for (const l of levels) {
    const names = stableSortByExistingPosition(nodesByName, groups.get(l));
    const center = (names.length - 1) / 2;
    for (let i = 0; i < names.length; i++) {
      const n = nodesByName.get(names[i]);
      n.position = [
        Math.round(X_START + l * X_GAP),
        Math.round((i - center) * Y_GAP),
      ];
    }
  }

  return nodes;
}

function minimalSettings(raw) {
  const settings = {};
  const source = raw || {};
  for (const k of ALLOWED_SETTINGS) {
    if (source[k] !== undefined) settings[k] = source[k];
  }
  return settings;
}

async function runOne(id) {
  const getRes = await apiRequest('GET', `/api/v1/workflows/${id}`);
  if (getRes.status !== 200) {
    throw new Error(`GET ${id} failed: ${getRes.status}`);
  }
  const wf = getRes.body;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupDir = path.join('workflows', 'backups', `layout-auto-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `${id}-before-layout-auto.json`);
  fs.writeFileSync(backupPath, JSON.stringify(wf, null, 2));

  const nodes = autoLayout(wf.nodes, wf.connections);
  const payload = {
    name: wf.name,
    nodes,
    connections: wf.connections,
    settings: minimalSettings(wf.settings),
  };

  const putRes = await apiRequest('PUT', `/api/v1/workflows/${id}`, payload);
  if (putRes.status !== 200) {
    throw new Error(`PUT ${id} failed: ${putRes.status} ${JSON.stringify(putRes.body).slice(0, 300)}`);
  }

  return { id, name: wf.name, nodes: nodes.length, backupPath };
}

(async () => {
  if (!N8N_KEY) {
    console.error('ERROR: N8N_API_KEY env var not set');
    process.exit(1);
  }
  const results = [];
  for (const id of WORKFLOW_IDS) {
    const r = await runOne(id);
    console.log(`OK ${id} (${r.name}) nodes=${r.nodes} backup=${r.backupPath}`);
    results.push(r);
  }
  console.log('DONE');
})();

