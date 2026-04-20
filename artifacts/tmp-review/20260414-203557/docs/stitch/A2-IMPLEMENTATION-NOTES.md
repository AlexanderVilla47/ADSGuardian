# A2 Implementation Notes

Fecha: 2026-04-13

## Alcance implementado en repo

1. F1 (`workflows/contract-ui-management-v2.json`)
   - Nuevas actions: `baja_manual`, `listar_ads`, `run_now`, `history`, `pause_ad`, `pause_active`.
   - `pause_active` con guardrails:
     - `dry_run=true` -> preview sin pausar.
     - `dry_run=false` requiere `confirm=true`.
     - `batch_limit` validado entre 1 y 100.
   - Tracking minimo en operaciones manuales:
     - `tracking_id`, `correlation_id`, `actor`, `requested_at`, `execution_id`.
   - Persistencia de tracking/historial en hoja `Operations_Log`.
   - Endpoint funcional de historial (`history`) con filtros y paginacion.

2. F2 (`workflows/contract-guard-daily-killswitch.json`)
   - Nuevo ingreso interno para ejecucion desde F1:
     - `Trigger Internal Execute Workflow` + `Contexto Internal`.
   - Clasificacion extendida para `pause_ad` y `pause_active` (ejecucion real), reutilizando pipeline existente:
     - `Regex Coincide con Nombre (Sheet)`.
     - `Meta - Precheck Estado Ad`.
     - `Meta - Pausar Ad`.
   - Ajuste de waits a politica operativa vigente:
     - `Wait 5m Precheck Retry` -> `5 minutes`.
     - `Wait 5m Pausa Retry` -> `5 minutes`.

## Decisiones tecnicas

1. `run_now` y operaciones manuales se modelan asincronas de cara al front (`202`) con `tracking_id`.
2. Historial A2 se apoya en Google Sheets (`Operations_Log`) para evitar introducir DB nueva en MVP.
3. `pause_active` se separa en dos modos:
   - Preview (`dry_run`) en F1.
   - Ejecucion real en F2 solo con `confirm=true`.

## Limites actuales

1. Runtime remoto probado no refleja estos cambios aun; la validacion corta con `400 ValidationError`.
2. No se obtuvo `execution_id` de n8n para A2 en probe remoto.
3. `influencers/search` permanece fuera de alcance de este bloque.

## Riesgos

1. Si `Operations_Log` no existe en Sheets productivo, `history`/tracking queda degradado.
2. Sin despliegue de F1/F2 actualizados, la UI seguira viendo `Input invalido` en acciones A2.
3. `pause_active` puede finalizar muchos contratos si el lote no se controla operativamente.

## Validacion deterministica minima A2

Endpoint de probe: `POST http://168.138.125.21.nip.io:5678/webhook/contract-ui-management-v2`

| Accion A2 | Ultimo resultado observado | execution_id | Veredicto |
|---|---|---|---|
| `run_now` | HTTP 400 `ValidationError` | N/A | RUN_INVALIDO |
| `history` | HTTP 400 `ValidationError` | N/A | RUN_INVALIDO |
| `baja_manual` | HTTP 400 `ValidationError` | N/A | RUN_INVALIDO |
| `listar_ads` | HTTP 400 `ValidationError` | N/A | RUN_INVALIDO |
| `pause_ad` | HTTP 400 `ValidationError` | N/A | RUN_INVALIDO |
| `pause_active` | HTTP 400 `ValidationError` | N/A | RUN_INVALIDO |

Evidencia detallada: `test.json`.

## A2-P3 (timeboxed) - pause_ad manual + blueprint pause_active batch

Fecha: 2026-04-13

### Evidencia runtime de hoy (host `http://168.138.125.21:5678`)

- Preflight API n8n OK con `X-N8N-API-KEY`:
  - Workflow F2 (`8mlwAxLtJVrwpLhi`) activo.
  - Workflow F1 (`cFBr6GavlSWDsUFz`) activo.
- `pause_ad` manual ejecutado por webhook F1:
  - Request: `action=pause_ad`, `Contrato_ID=CTR-0001`, `Ad_ID=23856236684240596`.
  - Resultado webhook: `{"ok":true,"data":{"accepted":true,"status":"queued"},"meta":{"execution_id":"919"}}`.
  - F1 `execution_id=919`: ruta completa hasta `Execute F2 Internal` y `Respond Operation Accepted`.
  - F2 `execution_id=920`: se ejercitan `Meta_Check_Precheck_Estado_Ad`, `Pause_Meta_Pausar_Ad`, `Sheets - Marcar Finalizado`.

### Veredicto deterministico A2-P3

- `pause_ad` (objetivo: pausa manual por `Ad_ID` puntual): `PARCIAL`.
  - Lo que SI: dispatch F1->F2 y pipeline precheck/pausa corriendo.
  - Lo que NO: en la ultima corrida (`execution_id=920`) no aparece el `Ad_ID` solicitado y el item procesado fue `CTR-9001` con `run_mode=scheduled`; por regla deterministica, el objetivo manual queda `NO EJERCITADO`.
- `pause_active`: `PARCIAL`.
  - Hay guardrails base en repo (`dry_run` + `confirm` + `batch_limit`).
  - Falta migrar a handshake operativo por token y validar runtime GREEN.

### Blueprint ejecutable para `pause_active` batch

1. Paso preview (`dry_run=true`):
   - Input obligatorio: `contract_id`, `dry_run=true`, `max_batch_size`.
   - Salida: lista de candidatos + `confirm_token` firmado y con vencimiento corto (ej. 10 min).
2. Paso confirmacion (`dry_run=false`):
   - Input obligatorio: `contract_id`, `dry_run=false`, `confirm_token`, `max_batch_size`.
   - Validaciones: token valido/no vencido, token atado a `contract_id` + actor + hash de candidatos + limite.
3. Ejecucion batch:
   - Pausar hasta `max_batch_size` candidatos.
   - Reusar pipeline F2 de precheck `ACTIVE` + pausa + update finalizacion.
   - Respuesta con resumen (`processed`, `paused`, `skipped_non_active`, `errors`).

### Parametros operativos A2-P3 (contrato propuesto)

- `dry_run` (`boolean`, requerido): `true` para preview, `false` para ejecutar.
- `confirm_token` (`string`, requerido cuando `dry_run=false`): token emitido por preview.
- `max_batch_size` (`int`, requerido, `1..100`): limite duro del lote por corrida.

## A2-P1 - run-now + history (timebox)

Fecha: 2026-04-13

- Endpoint operativo para front (workflows actuales): `POST /webhook/contract-ui-management-v2` con `action`.
- Mapeo de contrato frontend:
  - `POST /api/v1/operations/run-now` -> payload webhook `{ "action": "run_now", "requested_by": "...", "correlation_id": "..." }`.
  - `GET /api/v1/operations/history` -> payload webhook `{ "action": "history", "from": "...", "to": "...", "result": "...", "run_mode": "...", "execution_id": "...", "page": 1, "page_size": 25 }`.

Evidencia deterministica (ultima ejecucion por accion):

| Accion | HTTP | execution_id | status | Resultado |
|---|---|---|---|---|
| `run_now` | 202 | F1 `934` / F2 `935` | `success` / `success` | LISTO |
| `history` | 200 (body vacio) | F1 `949` | `error` | FAIL (`EAUTH` en `GS Read Operations History`; sin `env vars denied`) |

Notas:

1. `run_now` ya despacha correctamente el flujo interno F1 -> F2 (`Execute F2 Internal`).
2. `history` ya no falla por `env vars denied` (A2.1 aplicado con `documentId` + credencial fija runtime-compatible), pero sigue en rojo por `EAUTH` de Google Sheets OAuth2 en runtime.

## A2-P2 - baja_manual + listar_ads (timebox)

Fecha: 2026-04-13

- F1 desplegado por API en workflow `cFBr6GavlSWDsUFz` usando `PUT /api/v1/workflows/cFBr6GavlSWDsUFz` con header `X-N8N-API-KEY`.
- Verificacion post-deploy:
  - `Validate Input` incluye `baja_manual` y `listar_ads` en `allowedActions`.
  - Nodos presentes: `GS Read For Baja` y `GS Read For Listar Ads`.

Evidencia deterministica (ultima ejecucion por accion):

| Accion | execution_id (F1) | Nodo objetivo alcanzado | status | Veredicto |
|---|---|---|---|---|
| `baja_manual` | `950` | `GS Read For Baja` | `error` | FAIL |
| `listar_ads` | `951` | `GS Read For Listar Ads` | `error` | FAIL |

Riesgo/limitacion actual:

1. En A2.1 se removio la dependencia de `$env.*` en ramas `history`, `baja_manual` y `listar_ads` (nodos Google Sheets con `documentId` fijo + credencial fija runtime-compatible).
2. El bloqueo actual ya no es de expresiones; ahora es `NodeApiError EAUTH` (refresh token Google OAuth2 invalido/expirado) en los tres nodos objetivo.
