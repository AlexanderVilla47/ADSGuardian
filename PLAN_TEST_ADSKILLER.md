# PLAN_TEST_ADSKILLER

## Resumen de alcance

Plan vivo de testing del flujo AdsKiller (UI + KillSwitch + alertas), construido solo con evidencia existente en el repo.
Orden de prioridad aplicado: `test.json` -> `workflows/*.json` -> `docs/*.md`.

Estados:
- ✅ Completado: hay evidencia directa y resultado observable.
- 🔄 En progreso: hay evidencia parcial o indirecta.
- ⏳ Pendiente: sin evidencia suficiente.

## Checklist de casos de prueba (evidencia real)

| ID | Estado | Caso | Evidencia (archivo + key/ruta) | Resultado observado | Criterio de aceptacion |
|---|---|---|---|---|---|
| AK-TC-01 | ✅ Completado | Vencidos terminan en `Finalizado` en hoja de contratos | `test.json` -> `[0..4].Contrato_ID`, `[0..4].Status_Contrato`, `[0..4].Fecha_Finalizacion` | `CTR-0001..CTR-0005` figuran con `Status_Contrato=Finalizado` y timestamp de finalizacion cargado | Para cada contrato vencido pausable, el estado persiste en `Finalizado` con fecha de finalizacion |
| AK-TC-02 | ✅ Completado | Preventiva 48h emite alerta operativa | `workflows/mock-alerts-receiver.json` -> bloque "Output de Payload Alerta Preventiva" (`alert_type=PREVENTIVE_48H`) | Se observa payload `WARNING` con mensaje de preventiva para `CTR-9001` | En ventana 48h, se emite alerta preventiva y queda mensaje trazable |
| AK-TC-03 | ✅ Completado | Camino critico escala incidente cuando queda vencido sin pausar | `workflows/mock-alerts-receiver.json` -> bloque error `Stop and Error - Escalar Incidente` (`errorMessage`) | Se observa error critico con tipo `EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED` y contrato/ad en mensaje | Si hay vencido no pausado, el flujo debe escalar incidente critico con detalle del contrato/ad |
| AK-TC-04 | 🔄 En progreso | Ruteo `not_actionable` para vencido no elegible | `docs/PROD-CUTOVER-RUNBOOK.md` -> "Casos cerrados hoy (PASS)" (`Ruteo not_actionable funcionando`) | Hay declaracion de PASS, pero sin `execution_id` ni salida de nodo en repo | Debe existir evidencia tecnica completa: `execution_id` + rama `not_actionable` + payload/nodo de salida |
| AK-TC-05B | ✅ Completado | Precheck 200 ACTIVE + pausa 404 non-retryable | API n8n remota (`workflowId=8mlwAxLtJVrwpLhi`) evaluada con metodologia deterministica estricta sobre una sola corrida manual posterior al mensaje "listo": `execution_id=583` | `execution_id=583` (manual, `retryOf=null`) cumple inputs forzados: `Meta - Precheck Estado Ad.statusCode=200` + `effective_status=ACTIVE` y `Meta - Pausar Ad.statusCode=404`. Resultado esperado verificado: `Normalizar HTTP Pausa.retryable=false`, `Evaluar Pausa.pause_state=failed`, `pause_reason=non_retryable_meta_response`, `pause_attempt=1`, `pause_max_attempts=3`, `Wait 5m Pausa Retry=0`, `Alerta Crítica.alert_type=EXPIRED_NOT_PAUSED_NON_RETRYABLE`, sin error por nodo no ejecutado. Dictamen: `PASS` | Para AK-TC-05B, la corrida solo es valida si los inputs forzados cumplen `precheck=200 ACTIVE` y `pausa=404`; si no, veredicto obligatorio: `RUN INVALIDO` |
| AK-TC-06 | ⏳ Pendiente | Precheck Meta fallido corta flujo antes de pausar | `workflows/contract-guard-daily-killswitch.json` -> nodos `Alerta Crítica - Precheck fallido`, `Rutear Estado Precheck` | Sin evidencia suficiente de ejecucion real de esta rama (no hay outputs/exec IDs en repo) | Con precheck no recuperable, no debe pausar; debe emitir alerta critica de precheck |
| AK-TC-07 | ⏳ Pendiente | Extension de contrato resetea preventiva 48h | `docs/qa-test-data.md` -> Escenario H (esperado) | Sin evidencia suficiente de before/after real en datos del repo | Tras extension, `Notificado_Previo` debe volver a `false` y habilitar nueva preventiva |
| AK-TC-08 | ⏳ Pendiente | Ejecucion manual forzada queda trazada | `workflows/contract-guard-daily-killswitch.json` -> nodo `Trigger Manual On-Demand` y `Contexto Manual` (`run_mode='manual'`) | Existe implementacion, pero sin evidencia de corrida manual real en repo | Debe registrarse corrida manual con correlacion y evidencia de salida |
| AK-TC-09 | 🔄 En progreso | Validar pausa real Meta antes de `Finalizado` (2xx + confirmacion post-pausa) | `test.json` muestra `Finalizado`, pero no incluye status HTTP de Meta ni post-check de estado | Sin evidencia suficiente para asegurar que cada `Finalizado` fue precedido por pausa real confirmada en Meta | Solo marcar `Finalizado` cuando exista: (1) respuesta 2xx de pausa y (2) confirmacion posterior de estado `PAUSED` |

## Bateria mock remota (API n8n) - 2026-04-08

Base URL evaluada: `http://168.138.125.21.nip.io:5678`.

### Preflight auth (solo lectura)

| Endpoint | Resultado | Evidencia |
|---|---|---|
| `/healthz` | PASS | HTTP 200 |
| `/api/v1/workflows?limit=1` | PASS | HTTP 200 |
| `/api/v1/executions?limit=1` | PASS | HTTP 200 |

### Estado de ejecucion de bateria mock

| Caso operativo | Estado | Evidencia real |
|---|---|---|
| Identificacion de workflows AdsKiller activos en instancia remota | ✅ Completado | Activos detectados: `8mlwAxLtJVrwpLhi` (Contract Guard), `YKJI902TH3uIeJHD` (Mock Alerts Receiver), `rpnGFPo0nDthwzdB` (contract-ui-management) |
| Validacion cardinalidad end-to-end mock | 🔄 En progreso | En `execution_id=548`, rama de pausa mantiene cardinalidad `1->1` y `Wait 5m Pausa Retry=0` |
| Rama critica `EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED` | 🔄 En progreso | `execution_id=548` sigue emitiendo `EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED` con `pause_attempt=1/3` y `pause_reason=non_retryable_meta_response` |
| Consistencia de finalizacion interna en mock | ✅ Completado (parcial de caso) | En `execution_id=536` no hay actualizacion a `Finalizado` para el item fallido; termina en error critico |

### Evidencia capturada en este intento (metodologia estricta AK-TC-05B)

- Preflight autenticado OK: `/healthz`, `/api/v1/workflows?limit=1`, `/api/v1/executions?limit=1` en HTTP 200.
- Corrida manual mas reciente posterior al mensaje "listo" (y unica usada para veredicto): `execution_id=580` (modo `manual`, `retryOf=null`, `startedAt=2026-04-08T15:07:26.109Z`).
- Nodos alcanzados en `execution_id=580`: `Trigger Manual On-Demand`, `Contexto Manual`, `Sheets - Leer Contratos`, `Clasificar Contratos (Activo / 48h / Vencido)`, `Expand Preventiva`, `Expand Vencidos`, `Regex Coincide con Nombre (Sheet)`, `Init Retry Precheck`, `Meta - Precheck Estado Ad`, `Normalizar HTTP Precheck`, `Evaluar Precheck Meta`, `Rutear Estado Precheck`, `Init Retry Pausa`, `Meta - Pausar Ad`, `Normalizar HTTP Pausa`, `Evaluar Pausa`, `Rutear Resultado Pausa`, `Build Finalizado Payload`, `Finalizado Payload Valido`, `Sheets - Marcar Finalizado`.
- Validacion de inputs forzados AK-TC-05B en `execution_id=580`: precheck cumple (`Meta - Precheck Estado Ad.statusCode=200`, `Normalizar HTTP Precheck.http_body.effective_status=ACTIVE`), pero pausa NO cumple (`Meta - Pausar Ad.statusCode=200`, esperado `404`).
- Veredicto deterministico AK-TC-05B: `RUN INVALIDO` por corrida no valida para el caso (no se forzo `pausa=404`, por lo tanto no aplica evaluar PASS/FAIL).
- Validacion final estricta AK-TC-05B sobre ultima corrida manual posterior al mensaje "listo": `execution_id=583` (manual, `retryOf=null`, `startedAt=2026-04-08T15:21:48.310Z`).
- Inputs forzados cumplidos en `execution_id=583`: `Meta - Precheck Estado Ad.statusCode=200`, `Normalizar HTTP Precheck.http_body.effective_status=ACTIVE`, `Meta - Pausar Ad.statusCode=404`.
- Resultado de negocio esperado confirmado en `execution_id=583`: `Normalizar HTTP Pausa.retryable=false`, `Evaluar Pausa.pause_state=failed`, `pause_reason=non_retryable_meta_response`, `pause_attempt=1`, `pause_max_attempts=3`, `Wait 5m Pausa Retry=0`, `Alerta Crítica - Pausa fallida.alert_type=EXPIRED_NOT_PAUSED_NON_RETRYABLE`.
- Veredicto deterministico final AK-TC-05B: `PASS`.

### Mini guia ejecutable hoy - AK-TC-09

- precondiciones: existe contrato vencido pausable (estado activo en Meta) y el flujo `contract-guard-daily-killswitch` esta disponible para corrida manual con timezone `America/Argentina/Buenos_Aires`.
- input de prueba: usar un contrato de `test.json` (ej. `CTR-0001`) y su anuncio asociado, forzando corrida manual (`run_mode='manual'`) para ese item.
- pasos de ejecucion: (1) disparar `Trigger Manual On-Demand`; (2) confirmar precheck `ACTIVE`; (3) ejecutar pausa en Meta; (4) ejecutar post-check inmediato de estado del ad; (5) actualizar contrato a `Finalizado` solo si el post-check devuelve `PAUSED`.
- expected output exacto: respuesta de pausa con `statusCode=200`; confirmacion post-pausa con `effective_status='PAUSED'`; persistencia final en contrato con `Status_Contrato='Finalizado'` y `Fecha_Finalizacion` no vacia.
- evidencia a capturar (archivo/key): `test.json` -> `[?].Contrato_ID='CTR-0001'`, `[?].Status_Contrato='Finalizado'`, `[?].Fecha_Finalizacion`; `workflows/contract-guard-daily-killswitch.json` -> salida del nodo de pausa (`statusCode`) + salida del nodo post-check (`effective_status='PAUSED'`) con `execution_id`.

## Pendientes para Produccion

- Bloqueante: validar pausa real Meta antes de `Finalizado` con evidencia doble obligatoria (2xx + confirmacion post-pausa de estado `PAUSED`).
- Bloqueante: cerrar evidencia de retries 3x/5m (precheck y pausa) con `execution_id` y salidas de nodos de wait/reintento.
- Bloqueante: cerrar evidencia de rama `precheck_failed` sin avance a pausa.
- Bloqueante: cerrar evidencia de extension que resetea preventiva (`Notificado_Previo=false`) con before/after.
- Bloqueante: corrida manual forzada con trazabilidad operativa (`run_mode`, `correlation_id`, resultado final).

## Historial de avance

| Fecha | Cambio de estado | Detalle |
|---|---|---|
| 2026-04-08 | Inicializacion del plan vivo | Se relevo evidencia real disponible (`test.json`, `workflows/mock-alerts-receiver.json`, `docs/PROD-CUTOVER-RUNBOOK.md`) y se normalizaron casos en estados ✅/🔄/⏳ |
| 2026-04-08 | Casos en ✅ (baseline) | AK-TC-01, AK-TC-02, AK-TC-03 quedan marcados como completados por evidencia observable en repo |
| 2026-04-08 | Casos en 🔄 (baseline) | AK-TC-04, AK-TC-05 quedan en progreso por evidencia parcial o declarativa |
| 2026-04-08 | Casos en ⏳ (baseline) | AK-TC-06, AK-TC-07, AK-TC-08, AK-TC-09 quedan pendientes por falta de evidencia suficiente |
| 2026-04-08 | Bateria mock remota bloqueada por auth | Preflight sobre `http://168.138.125.21.nip.io:5678`: `/healthz=200`, `/api/v1/workflows?limit=1=401`, `/api/v1/executions?limit=1=401`; no se pudieron capturar `execution_id` ni evidencia de nodos en la instancia |
| 2026-04-08 | Piloto controlado bloqueado por API key invalida | Reintento read-only con `N8N_MCP_TOKEN` y headers `X-N8N-API-KEY`, `Authorization: Bearer` y `api-key`: `/api/v1/workflows?limit=1=401` y `/api/v1/executions?limit=1=401`; no se ejecuta corrida para cumplir restriccion de "exactamente 1 test" |
| 2026-04-08 | Piloto mock abortado en preflight (key explicita) | Validacion obligatoria con API key explicita (redactada): `/healthz=200`, `/api/v1/workflows?limit=1=401`, `/api/v1/executions?limit=1=401`; se aborta sin disparar corrida para respetar criterio de seguridad y requisito de abortar ante no-200 |
| 2026-04-08 | AK-TC-05 ejecutado en remoto (1 corrida) | Preflight OK (`/healthz`, `/api/v1/workflows`, `/api/v1/executions` en 200). Se ejecuto `execution_id=536` por retry de `466` en `8mlwAxLtJVrwpLhi`; termina en `Stop and Error - Escalar Incidente` con `EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED`, pero sin 3 intentos ni waits (`pause_attempt=1`, `Wait 5m Pausa Retry=0`) |
| 2026-04-08 | Fix logico AK-TC-05 aplicado (pendiente validacion) | Se ajusto `Evaluar Pausa` en `8mlwAxLtJVrwpLhi`: `EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED` solo cuando `attempt >= max_attempts`; para falla no reintentable antes de agotar retries se emite `EXPIRED_NOT_PAUSED_NON_RETRYABLE`. Workflow guardado en remoto y export sincronizado en `workflows/contract-guard-daily-killswitch.json`; sin retest en esta tarea. |
| 2026-04-08 | Retest AK-TC-05 (cierre GREEN) en FAIL | Preflight OK y corrida unica `execution_id=548` (`retryOf=536`) en `8mlwAxLtJVrwpLhi`. Evidencia: `pause_attempt=1/3`, `pause_reason=non_retryable_meta_response`, `Wait 5m Pausa Retry=0`, pero alerta emitida como `EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED`; `Stop and Error - Escalar Incidente` falla con `Node 'Alerta Cr?tica - Pausa fallida' hasn't been executed`. |
| 2026-04-08 | Segundo fix AK-TC-05 + 1 retest en FAIL | Se aplico segundo fix en remoto sobre `Evaluar Pausa` (normalizacion de `pause_reason`), `Alerta Crítica - Pausa fallida` (derivacion de `alert_type` por `attempt/maxAttempts` + `retryable`) y `Stop and Error - Escalar Incidente` (mensaje con payload actual y fallback). Se ejecuto 1 retest (`execution_id=549`, `retryOf=548`) y persiste desvio: `alert_type=EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED` con `pause_attempt=1/3`, `wait_runs=0`, y error `Node 'Alerta Cr?tica - Pausa fallida' hasn't been executed`. |
| 2026-04-08 | Verificacion manual reciente AK-TC-05 sin cierre | Se relevo la ultima corrida manual `execution_id=558` (`retryOf=null`) y no ejercita la rama critica: ambos items finalizan con `pause_state=success`, `retryable=false`, `pause_attempt=1/3` y HTTP 200. AK-TC-05 sigue en 🔄 por falta de evidencia directa del caso non-retryable en este intento. |
| 2026-04-08 | AK-TC-05B con metodologia estricta: NO EJERCITADO | Se aplica regla deterministica de evidencia unica posterior al ultimo fix (`updatedAt=2026-04-08T14:28:48.425Z`). Se usa solo `execution_id=571` (manual, `retryOf=null`), que no alcanza la rama objetivo (`Meta API - Precheck Estado Ad`/`Meta API - Pausar Ad`/`Evaluar Pausa`/`Wait 5m Pausa Retry`/`Alerta Crítica - Pausa fallida`/`Stop and Error - Escalar Incidente`). Veredicto obligatorio: `NO EJERCITADO`. |
| 2026-04-08 | AK-TC-05B con metodologia estricta: RUN INVALIDO | Se usa exclusivamente la ultima corrida manual posterior al mensaje "listo": `execution_id=580` (`startedAt=2026-04-08T15:07:26.109Z`, `retryOf=null`). La corrida llega a precheck y pausa, pero no cumple los inputs forzados del caso: `Meta - Precheck Estado Ad.statusCode=200` y `effective_status=ACTIVE` (OK), `Meta - Pausar Ad.statusCode=200` (esperado `404`). Por regla deterministica, no corresponde PASS/FAIL: dictamen `RUN INVALIDO`. |
| 2026-04-08 | AK-TC-05B validacion final estricta: PASS | Se usa exclusivamente la ultima corrida manual posterior al mensaje "listo": `execution_id=583` (`startedAt=2026-04-08T15:21:48.310Z`, `retryOf=null`). Cumple inputs forzados (`precheck=200 ACTIVE`, `pausa=404`) y valida salida esperada no reintentable (`retryable=false`, `pause_state=failed`, `pause_reason=non_retryable_meta_response`, `pause_attempt=1/3`, `Wait 5m=0`, `alert_type=EXPIRED_NOT_PAUSED_NON_RETRYABLE`). Dictamen final: `PASS`. |
