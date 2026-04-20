# Runbook — n8n API directa para agentes (sin MCP)

## Objetivo y alcance

Este runbook define el estándar operativo para que cualquier agente pueda hacer **fixes y deploys de workflows n8n** por **API REST directa** usando `X-N8N-API-KEY`, de forma rápida, repetible y segura.

Alcance:
- Setup inicial de sesión en menos de 60 segundos.
- Verificación de conectividad/autorización.
- Patrón canónico de cambio: **GET → modificar → PUT**.
- Manejo de credenciales Google Sheets (`googleApi` + `authentication=serviceAccount`).
- Troubleshooting de errores reales vistos en AdsKiller.
- Rollback y validación post-deploy.

No alcance:
- Operación vía UI como ruta principal.
- Cualquier dependencia en MCP.

---

## Preflight de sesión (checklist de 60 segundos)

0. ✅ Corriste el bootstrap de sesión y obtuvo PASS en los 3 checks.
1. ✅ Estás en PowerShell y en la raíz del repo.
2. ✅ Tenés `N8N_BASE_URL` y `N8N_API_KEY` cargadas en env vars (NO hardcodeadas).
3. ✅ Probaste salud del n8n (`/healthz`) y auth real contra detalle de workflow (`/api/v1/workflows/{id}`).
4. ✅ Conocés `WORKFLOW_ID` objetivo.
5. ✅ Hiciste backup JSON del workflow actual antes de tocar nada.

Comando rápido:

```powershell
./scripts/n8n-session-bootstrap.ps1 -WorkflowId "<WORKFLOW_ID>"
```

Si el bootstrap falla, **no sigas** con preflight, backup ni deploy.

---

## Variables / entorno requerido

> Recomendado: definirlas por sesión (o en perfil local, nunca en repo).

```powershell
$env:N8N_BASE_URL = "http://TU_HOST:5678"
$env:N8N_API_KEY  = "<TU_API_KEY>"
$env:WORKFLOW_ID  = "<ID_WORKFLOW>"
```

Validación inmediata:

```powershell
if (-not $env:N8N_BASE_URL) { throw "Falta N8N_BASE_URL" }
if (-not $env:N8N_API_KEY)  { throw "Falta N8N_API_KEY" }
if (-not $env:WORKFLOW_ID)  { throw "Falta WORKFLOW_ID" }
```

---

## Verificación de sesión (health + workflow)

### Opción A — manual (copy/paste)

```powershell
$baseUrl = $env:N8N_BASE_URL.TrimEnd('/')
$headers = @{ "X-N8N-API-KEY" = $env:N8N_API_KEY; "Content-Type" = "application/json" }

# Health (puede variar según deploy)
Invoke-WebRequest -Uri "$baseUrl/healthz" -Method GET -TimeoutSec 20

# Auth real (detalle de workflow)
Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$($env:WORKFLOW_ID)" -Method GET -Headers $headers -TimeoutSec 30

# Listado opcional (solo conectividad/listado, NO prueba permisos de escritura)
Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows?limit=1" -Method GET -Headers $headers -TimeoutSec 30
```

### Opción B — script recomendado

```powershell
./scripts/n8n-session-bootstrap.ps1 -WorkflowId $env:WORKFLOW_ID
```

---

## Patrón canónico: GET → modificar → PUT

### Modelo de auth

- **Webhook auth** != **API REST auth**.
- Que un webhook responda no prueba permisos para `PUT /api/v1/workflows/{id}`.
- `GET /api/v1/workflows` solo confirma conectividad y listado; **no valida permisos de escritura**.

### Árbol de decisión de auth

1. `GET /api/v1/workflows/{id}` → **200**: seguir.
2. `GET /api/v1/workflows/{id}` → **401**: detener. Pedir key con scope `workflows read/write`.
3. `GET /api/v1/workflows/{id}` → **403**: detener. Permisos insuficientes por rol.
4. `GET /api/v1/workflows` → **200** pero detail falla: la red está bien, la auth no.

### Regla de oro

**Nunca** mandar el objeto entero del GET al PUT. El PUT debe ir con payload mínimo válido.

### Payload mínimo válido (plantilla)

```json
{
  "name": "Nombre workflow",
  "nodes": [],
  "connections": {},
  "settings": {}
}
```

Opcional según caso:
- `staticData`

### Campos que NO deben ir en PUT

No enviar (si vienen del GET):
- `id`
- `createdAt`
- `updatedAt`
- `active`
- `versionId`
- `isArchived`
- `triggerCount`
- cualquier metadata no requerida por schema de update

### Flujo operativo seguro

1. `GET` workflow actual.
2. Guardar backup timestamped (`workflows/backups/...before.json`).
3. Modificar sobre copia local.
4. Armar payload mínimo (`name`, `nodes`, `connections`, `settings`).
5. `PUT`.
6. `GET` de verificación.
7. Ejecutar test funcional mínimo del caso tocado.

### Protocolo canónico

**health -> detail auth-check -> backup -> PUT mínimo -> verify -> smoke**

---

## Ejemplo completo en PowerShell (sin ambigüedad)

```powershell
$ErrorActionPreference = "Stop"

$baseUrl = $env:N8N_BASE_URL.TrimEnd('/')
$apiKey = $env:N8N_API_KEY
$workflowId = $env:WORKFLOW_ID
$headers = @{ "X-N8N-API-KEY" = $apiKey; "Content-Type" = "application/json" }

# 1) GET actual
$wf = Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$workflowId" -Method GET -Headers $headers -TimeoutSec 30

# 2) Backup
$backupDir = "workflows/backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $backupDir "$workflowId-$stamp-before.json"
$wf | ConvertTo-Json -Depth 100 | Set-Content -Path $backupPath -Encoding UTF8

# 3) Modificación mínima de ejemplo (NO destructiva): renombrar workflow
$newName = "{0} [api-direct-{1}]" -f $wf.name, $stamp

# 4) Payload mínimo
$payload = @{
  name = $newName
  nodes = @($wf.nodes)
  connections = $wf.connections
  settings = if ($null -ne $wf.settings) { $wf.settings } else { @{} }
}

$body = $payload | ConvertTo-Json -Depth 100

# 5) PUT
$resp = Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$workflowId" -Method PUT -Headers $headers -Body $body -TimeoutSec 60

# 6) Verify
$check = Invoke-RestMethod -Uri "$baseUrl/api/v1/workflows/$workflowId" -Method GET -Headers $headers -TimeoutSec 30

Write-Host "PUT OK. workflowId=$($resp.id) name='$($check.name)'" -ForegroundColor Green
```

### Versión con script plantilla

```powershell
./scripts/n8n-update-workflow-template.ps1 -WorkflowId $env:WORKFLOW_ID
./scripts/n8n-update-workflow-template.ps1 -WorkflowId $env:WORKFLOW_ID -SourceFile "workflows/edits/flow3-fixed.json"
```

---

## Google Sheets: credenciales obligatorias para publicar

Para nodos `n8n-nodes-base.googleSheets`:

1. `credentials.googleApi` debe existir en el nodo.
2. `parameters.authentication` debe ser exactamente `serviceAccount`.

Ejemplo mínimo de nodo:

```json
{
  "name": "GS Read Contratos",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4,
  "parameters": {
    "operation": "read",
    "authentication": "serviceAccount",
    "documentId": "<DOC_ID>",
    "sheetName": "Contratos"
  },
  "credentials": {
    "googleApi": {
      "id": "<CREDENTIAL_ID>",
      "name": "Google Service Account"
    }
  }
}
```

Si falta uno de esos dos puntos, el publish/deploy puede romper con error de credenciales faltantes.

---

## Errores típicos y cómo resolver

### 1) `request/body must NOT have additional properties`

**Causa:** Estás enviando campos extra (normalmente copiados del GET completo).

**Fix:** Enviar payload mínimo (`name`, `nodes`, `connections`, `settings` + `staticData` si aplica).

---

### 2) `object is not iterable`

**Causas comunes:**
- `nodes` no se mandó como array.
- `connections.main` tiene estructura inválida (debe ser array de arrays de conexiones).
- Código de node asume iterable y recibe objeto/null.

**Fix operativo:**
1. Validar tipos antes del PUT:
   - `nodes` => array
   - `connections` => objeto
2. Si el error aparece en ejecución, revisar el node que usa `for...of` / `.map()` / `.filter()` y proteger nulls.

---

### 3) `Cannot publish workflow: Missing required credential`

**Causa:** Un nodo requiere credenciales y no tiene referencia válida, o `authentication` no coincide.

**Fix:**
1. Revisar nodos con `credentials` vacías o incompletas.
2. Para Google Sheets, confirmar:
   - `credentials.googleApi` presente
   - `parameters.authentication = serviceAccount`
3. Verificar que la credencial exista en ese ambiente (dev/staging/prod).

---

## Definition of Ready (DoR) para tocar workflows

Antes de cambiar cualquier workflow:

- [ ] `N8N_BASE_URL` y `N8N_API_KEY` cargados en env.
- [ ] `WORKFLOW_ID` confirmado.
- [ ] Preflight OK (`scripts/n8n-preflight.ps1`).
- [ ] `GET /api/v1/workflows/{id}` devuelve 200 con `X-N8N-API-KEY`.
- [ ] Backup del workflow actual guardado.
- [ ] Cambio mínimo definido (qué se toca y qué no).
- [ ] Plan de validación post-deploy definido (al menos 1 caso happy + 1 error path si aplica).
- [ ] Plan de rollback listo (archivo backup + comando de restore).

Si una casilla falla, **no deployar**.

---

## Rollback rápido y validación post-deploy

### Rollback

```powershell
$backup = "workflows/backups/<WORKFLOW_ID>-<TIMESTAMP>-before.json"
./scripts/n8n-update-workflow-template.ps1 -WorkflowId $env:WORKFLOW_ID -SourceFile $backup
```

### Validación post-deploy

1. GET de verificación del workflow actualizado.
2. Confirmar cantidad de nodos y conexiones esperadas.
3. Ejecutar smoke test funcional del endpoint/flujo tocado.
4. Verificar que no aparezcan errores de credenciales ni schema en ejecución.
5. Dejar evidencia mínima: timestamp, workflowId, resultado de smoke test.

---

## Comandos de inicio rápido (copiar/pegar)

```powershell
$env:N8N_BASE_URL = "http://TU_HOST:5678"
$env:N8N_API_KEY  = "<REDACTED_API_KEY>"
$env:WORKFLOW_ID  = "<WORKFLOW_ID>"

./scripts/n8n-preflight.ps1 -WorkflowId $env:WORKFLOW_ID
./scripts/n8n-update-workflow-template.ps1 -WorkflowId $env:WORKFLOW_ID -DryRun
./scripts/n8n-update-workflow-template.ps1 -WorkflowId $env:WORKFLOW_ID -SourceFile "workflows/edits/mi-cambio.json"
```

### Incidente de secretos

Si una key/token quedó expuesta en una nota, snippet o log:

1. Rotar la credencial de inmediato.
2. Reemplazar la referencia por `<REDACTED_API_KEY>`.
3. Re-validar con una key nueva antes de cualquier deploy.

---

## Referencias internas

- `scripts/n8n-preflight.ps1`
- `scripts/n8n-update-workflow-template.ps1`
- `docs/DEPLOY-SEARCH-HANDLER.md`
