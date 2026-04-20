---
name: n8n-api-direct-ops
description: Estandar operativo para fixes y deploys en n8n por API REST directa con X-N8N-API-KEY (sin MCP), incluyendo preflight, backup, PUT mínimo y verificación post-deploy. Trigger: usar cuando un agente deba modificar/publicar workflows por API directa de n8n.
license: Apache-2.0
metadata:
  author: AdsKiller
  version: "1.0.0"
---

# n8n API Direct Ops

## Propósito

Estandarizar una forma **rápida, segura y repetible** para operar workflows n8n vía API REST directa.

Objetivo principal:
- Evitar bloqueos en fixes/deploys por errores de payload, credenciales o validación.

## Cuándo usar

Usá esta skill cuando:
- Tengas que hacer un fix de workflow sin depender de UI.
- Tengas que desplegar cambios por `PUT /api/v1/workflows/{id}`.
- Necesites un proceso repetible para cualquier agente del equipo.

## Qué NO hacer

- NO hardcodear `N8N_API_KEY` en scripts o docs.
- NO subir el objeto completo del GET al PUT.
- NO tocar múltiples áreas no relacionadas en un mismo deploy.
- NO loggear secretos ni headers de auth.
- NO deployar sin backup previo.

## Modelo de auth

- **Webhook auth** != **API REST auth**.
- Que un webhook funcione no prueba que la API REST tenga permisos para publicar workflows.
- `GET /api/v1/workflows` solo verifica conectividad/listado.
- La prueba real de permisos es `GET /api/v1/workflows/{id}` con `X-N8N-API-KEY`.

## Árbol de decisión explícito

1. `GET /api/v1/workflows/{id}` → **200**: continuar.
2. `GET /api/v1/workflows/{id}` → **401**: detener. Pedir key con scope `workflows read/write`.
3. `GET /api/v1/workflows/{id}` → **403**: detener. Permisos insuficientes por rol.
4. `GET /api/v1/workflows` → **200** pero detail falla: conectividad OK, auth de escritura NO.

## Flujo operativo exacto

### 0) Bootstrap de sesión (obligatorio)

Antes de cualquier preflight, backup o deploy:

```powershell
./scripts/n8n-session-bootstrap.ps1 -WorkflowId $env:WORKFLOW_ID
```

Gates:
- Si falla con exit 1, corregí env vars o parámetro.
- Si falla con exit 2, pedí una key con scope `workflows read/write`.
- Si falla con exit 3, corregí rol/permisos.
- Si falla con exit 4, tratá el problema como conectividad o error HTTP genérico.
- Si no da PASS en `healthz`, `workflows_list` y `workflow_detail`, **NO CONTINUAR**.

### 1) Preflight

Variables requeridas:
- `N8N_BASE_URL`
- `N8N_API_KEY`
- `WORKFLOW_ID`

Comando:

```powershell
./scripts/n8n-preflight.ps1 -WorkflowId $env:WORKFLOW_ID
```

Gate:
- Si preflight falla => NO continuar.
- El bootstrap de sesión debe haber pasado antes.

Protocolo canónico:
**health -> detail auth-check -> backup -> PUT mínimo -> verify -> smoke**

### 2) Backup

Antes de cualquier cambio, hacer GET y guardar backup timestamped.

```powershell
$baseUrl = $env:N8N_BASE_URL.TrimEnd('/')
$headers = @{ "X-N8N-API-KEY" = $env:N8N_API_KEY; "Content-Type" = "application/json" }
$wf = Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$($env:WORKFLOW_ID)" -Method GET -Headers $headers
New-Item -ItemType Directory -Path "workflows/backups" -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$wf | ConvertTo-Json -Depth 100 | Set-Content "workflows/backups/$($env:WORKFLOW_ID)-$stamp-before.json" -Encoding UTF8
```

### 3) Cambio mínimo

Aplicar solo el fix definido. No mezclar refactors no solicitados.

### 4) PUT con payload mínimo

Usar siempre:

```json
{
  "name": "...",
  "nodes": [],
  "connections": {},
  "settings": {}
}
```

Script recomendado:

```powershell
./scripts/n8n-update-workflow-template.ps1 -WorkflowId $env:WORKFLOW_ID -SourceFile "workflows/edits/cambio.json"
```

### 5) Verify post-deploy

1. GET del workflow actualizado.
2. Smoke test del flujo tocado.
3. Confirmar ausencia de errores de schema/credenciales.
4. Si el GET detail no devuelve 200, tratarlo como fallo de deploy.

---

## Plantilla de payload mínimo (copy/paste)

```powershell
$payload = @{
  name = $wf.name
  nodes = @($wf.nodes)
  connections = $wf.connections
  settings = if ($null -ne $wf.settings) { $wf.settings } else { @{} }
}
$body = $payload | ConvertTo-Json -Depth 100
Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$workflowId" -Method PUT -Headers $headers -Body $body -TimeoutSec 60
```

---

## Credenciales Google Sheets (requisito de publish)

Para cada nodo Google Sheets:
- `credentials.googleApi` presente
- `parameters.authentication = "serviceAccount"`

Si no, podés recibir:
- `Cannot publish workflow: Missing required credential`

---

## Troubleshooting rápido

### `request/body must NOT have additional properties`
- Causa: payload con campos extra (`id`, `updatedAt`, etc.).
- Solución: reconstruir payload mínimo.

### `object is not iterable`
- Causa: `nodes`/`connections` mal tipados o lógica de nodo que asume array.
- Solución: validar estructura del JSON antes de PUT y proteger nulls en código.

### `Cannot publish workflow: Missing required credential`
- Causa: credencial faltante o auth mal configurada.
- Solución: revisar `credentials.googleApi` + `authentication=serviceAccount`.

---

## Checklist de seguridad

- [ ] API keys solo por env vars.
- [ ] No imprimir secretos en consola.
- [ ] Backup guardado antes del PUT.
- [ ] Rollback path definido.
- [ ] Scope del cambio acotado.
- [ ] `GET /api/v1/workflows/{id}` pasa con `X-N8N-API-KEY` antes de cualquier PUT.

## Incidente de secretos

Si aparece una key/token real en docs, scripts o tickets:

1. Rotarla de inmediato.
2. Sustituirla por `<REDACTED_API_KEY>`.
3. No reusar el ejemplo hasta revalidar con credencial nueva.

## Criterio de salida

Se considera terminado cuando:
- Preflight OK
- PUT exitoso con payload mínimo
- Validación funcional OK
- Evidencia mínima registrada (workflowId + timestamp + resultado)

## Referencias

- `docs/runbook-n8n-api-directa-agentes.md`
- `scripts/n8n-preflight.ps1`
- `scripts/n8n-update-workflow-template.ps1`
