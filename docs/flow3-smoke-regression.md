# Flow3 smoke regression (minima automatica)

Script operativo: `scripts/flow3-smoke-regression.ps1`

Objetivo: correr 4 casos de regresion sobre el workflow `BFHHQwYFfmcpqshb` y cortar release si algun caso falla.

Casos cubiertos:

- `telegram`
- `slack`
- `both`
- `unsupported`

## Que valida el script

1. Preflight API (health, lectura de workflow, lectura de executions).
2. Disparo webhook por caso.
3. Lookup de execution por `correlation_id`.
4. Asserts minimos por ruteo/evento (sent o channel_error con canal correcto para telegram/slack/both; unsupported exige log unsupported y ausencia de envio/intent a canales soportados).
5. Tabla final PASS/FAIL y `exit code 1` si hay al menos un fallo.

## Variables de entorno requeridas

- `N8N_API_KEY` (obligatoria, se envia como `X-N8N-API-KEY` para `/api/v1`).

`N8N_MCP_TOKEN` queda en estado legacy/deprecado para Flow3 y no se usa en esta regresion.

## Variables opcionales

- `N8N_API_BASE_URL` (default: `http://168.138.125.21:5678/api/v1`).
- `N8N_FLOW3_WEBHOOK_URL` (default: `http://168.138.125.21:5678/webhook/ops-reporting-alerts`).
- `N8N_FLOW3_WORKFLOW_ID` (default: `BFHHQwYFfmcpqshb`).
- `N8N_FLOW3_LOOKUP_LIMIT` (default: `30`).
- `N8N_FLOW3_POLL_ATTEMPTS` (default: `20`).
- `N8N_FLOW3_POLL_INTERVAL_SECONDS` (default: `2`).
- `N8N_FLOW3_SLACK_WEBHOOK_URL` (opcional; si no existe usa placeholder invalido controlado).
- `N8N_FLOW3_TELEGRAM_BOT_TOKEN` (opcional; si no existe usa placeholder invalido controlado).
- `N8N_FLOW3_TELEGRAM_CHAT_ID` (opcional; si no existe usa placeholder `0`).

Nota: los placeholders invalidos sirven para validar observabilidad de fallo de canal (`ops_notification_channel_error`) sin exponer secretos.

## Ejecucion

```powershell
$env:N8N_API_KEY = "<tu-api-key>"
./scripts/flow3-smoke-regression.ps1
```

Con override de endpoints:

```powershell
$env:N8N_API_KEY = "<tu-api-key>"
$env:N8N_API_BASE_URL = "http://host:5678/api/v1"
$env:N8N_FLOW3_WEBHOOK_URL = "http://host:5678/webhook/ops-reporting-alerts"
./scripts/flow3-smoke-regression.ps1
```

## Salida esperada

- Tabla con columnas: `Case`, `ExecutionId`, `Status`, `Details`.
- `Smoke regression GREEN (4/4).` cuando todo pasa.
- Error final + `exit 1` cuando falla uno o mas casos.

## Uso recomendado en operacion/release

1. Correr antes de cualquier release de Flow3.
2. Guardar evidencia de `ExecutionId` por caso y timestamp.
3. Si falla un caso, bloquear release hasta nuevo GREEN completo (4/4).
