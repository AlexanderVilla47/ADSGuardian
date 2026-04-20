# AdsKiller — Node by Node Map

> Mapa técnico detallado por workflow JSON en `workflows/`.
>
> Incluye: nodo, tipo, función, inputs/outputs, dependencias, riesgo y evidencia/log.

---

## Workflow: `workflows/contract-ui-management.json`

| Nodo | Tipo de nodo | Función exacta | Inputs esperados | Outputs esperados | Dependencias | Riesgo si falla | Evidencia / log que deja |
|---|---|---|---|---|---|---|---|
| Webhook UI | `n8n-nodes-base.webhook` | Recibir requests de UI (`alta/consulta/extension`) | HTTP POST body | Item JSON con request | Endpoint publicado | Alto (UI queda sin operación) | Ejecución n8n + request payload |
| Normalize Request | `n8n-nodes-base.code` | Normaliza payload, action lower, timezone, request_ts, today_tz | `$json.body` | JSON normalizado | Webhook UI | Alto (routing inválido) | Datos normalizados en ejecución |
| Validate Input | `n8n-nodes-base.code` | Valida action y fechas (`YYYY-MM-DD`), valida `dias_proximos` | JSON normalizado | JSON válido o excepción (`ValidationError`) | Normalize Request | Alto (datos corruptos en Sheets) | Error explícito con detalle |
| Route Action | `n8n-nodes-base.switch` | Rutea por `alta`, `consulta`, `extension` | `action` válida | Rama correspondiente | Validate Input | Alto (acción incorrecta) | Ruta ejecutada visible en grafo |
| Prepare Alta Row | `n8n-nodes-base.code` | Construye fila de alta con defaults (`Status_Contrato`, `Notificado_Previo`) | Campos de alta | Fila lista para append | Route Action (alta) | Medio-Alto | Fila construida en data output |
| GS Append Alta | `n8n-nodes-base.googleSheets` | Inserta nuevo contrato en hoja `Contratos` | Fila de alta | Confirmación de append | Prepare Alta Row + credenciales GS | Alto (no se crean contratos) | Respuesta API de Google Sheets |
| Respond Alta | `n8n-nodes-base.respondToWebhook` | Respuesta HTTP 201 con contrato creado | Resultado de append | JSON `ok=true` | GS Append Alta | Medio | Respuesta HTTP a UI |
| GS Read Contratos | `n8n-nodes-base.googleSheets` | Lee todos los contratos para consulta | Acción consulta | Lista de filas | Route Action (consulta) + credenciales GS | Alto | Lectura de filas en ejecución |
| Filter Proximos Vencer | `n8n-nodes-base.code` | Filtra por ventana `[hoy, hoy+dias]`, excluye finalizados, ordena | Fila contratos + `dias_proximos` | Lista filtrada | GS Read Contratos | Medio-Alto | Conteo y filas resultantes |
| Respond Consulta | `n8n-nodes-base.respondToWebhook` | Respuesta HTTP 200 con `total` y `data` | Resultado filtrado | JSON de consulta | Filter Proximos Vencer | Medio | Respuesta HTTP a UI |
| GS Read For Extension | `n8n-nodes-base.googleSheets` | Lee contratos para buscar `ID_Contrato` a extender | Acción extension | Lista de filas | Route Action (extension) + credenciales GS | Alto | Lectura de filas |
| Prepare Extension Row | `n8n-nodes-base.code` | Busca contrato, valida existencia, actualiza fecha y resetea `Notificado_Previo` | Lista de contratos + request extension | Fila actualizada o `NotFoundError` | GS Read For Extension | Alto | Error de negocio o fila actualizada |
| GS Update Extension | `n8n-nodes-base.googleSheets` | `appendOrUpdate` por `ID_Contrato` | Fila actualizada | Confirmación de update | Prepare Extension Row + credenciales GS | Alto | Resultado update Sheets |
| Respond Extension | `n8n-nodes-base.respondToWebhook` | Respuesta HTTP 200 de extensión | Resultado update | JSON de éxito | GS Update Extension | Medio | Respuesta HTTP a UI |

---

## Workflow: `workflows/contract-guard-daily-killswitch.json`

| Nodo | Tipo de nodo | Función exacta | Inputs esperados | Outputs esperados | Dependencias | Riesgo si falla | Evidencia / log que deja |
|---|---|---|---|---|---|---|---|
| Cron Diario 00:01 | `n8n-nodes-base.cron` | Trigger programado diario | Hora cron | Disparo scheduled | Config cron | Alto (sin corrida automática) | Historial de trigger |
| Trigger Manual On-Demand | `n8n-nodes-base.manualTrigger` | Trigger manual operativo | Ejecución manual | Disparo manual | Operador | Medio-Alto | Ejecución manual registrada |
| Contexto Scheduled | `n8n-nodes-base.code` | Setea `run_mode=scheduled` | Trigger cron | Contexto de ejecución | Cron Diario 00:01 | Medio | Campo `run_mode` |
| Contexto Manual | `n8n-nodes-base.code` | Setea `run_mode=manual` | Trigger manual | Contexto de ejecución | Trigger Manual | Medio | Campo `run_mode` |
| Sheets - Leer Contratos | `n8n-nodes-base.googleSheets` | Lee contratos de hoja | Contexto run_mode | Filas de contratos | Contexto Scheduled/Manual + credenciales GS | Alto | Filas leídas |
| Clasificar Contratos (Activo / 48h / Vencido) | `n8n-nodes-base.code` | Filtra activos, valida fecha, calcula ventana preventiva/vencido, arma regex y correlation_id | Filas contratos | Items accionables con `control_type` | Sheets - Leer Contratos | Crítico | `control_type`, `days_to_end`, `correlation_id` |
| Rutear Tipo de Control | `n8n-nodes-base.switch` | Rama `preventive` vs `expired` | `control_type` | Rama correspondiente | Clasificar Contratos | Alto | Ruta tomada |
| Payload Alerta Preventiva | `n8n-nodes-base.set` | Arma payload WARNING 48h | Item preventive | JSON alerta preventiva | Rutear Tipo de Control | Medio | `alert_type=PREVENTIVE_48H` |
| Emitir Alerta Operativa | `n8n-nodes-base.httpRequest` | Envía alerta preventiva a webhook operativo | Payload alerta | Respuesta webhook | Payload Alerta Preventiva + `ALERT_WEBHOOK_URL` | Medio-Alto | HTTP status envío |
| Sheets - Marcar Notificado_Previo | `n8n-nodes-base.googleSheets` | Marca `Notificado_Previo=true` + timestamp | Contrato preventive | Fila actualizada | Emitir Alerta Operativa | Alto | Update en Sheets |
| Regex Coincide con Nombre (Sheet) | `n8n-nodes-base.if` | Verifica match regex en nombre de Sheet | `regexMatchesSheetName` | true→precheck / false→alerta crítica | Rutear Tipo de Control | Alto | Rama true/false |
| Init Retry Precheck | `n8n-nodes-base.set` | Inicializa contador retry pre-check | Contrato expired elegible | `precheck_attempt=1`, `max=3` | Regex Coincide true | Medio | Contadores de retry |
| Meta - Precheck Estado Ad | `n8n-nodes-base.httpRequest` | Consulta estado/nombre de Ad en Meta | `Ad_ID` | Full response HTTP | Init Retry Precheck / Wait Precheck + credencial n8n `Meta Ads API (Bearer)` | Crítico | `statusCode`, body Meta |
| Evaluar Precheck Meta | `n8n-nodes-base.code` | Decide `ready_to_pause` / `retry` / `not_actionable` / `failed` | Respuesta Meta + estado retry | Estado de precheck y contexto | Meta - Precheck Estado Ad | Crítico | `precheck_state`, status, razón |
| Rutear Estado Precheck | `n8n-nodes-base.switch` | Rutea estado precheck (pausa/retry/fallo) | `precheck_state` | Rama adecuada | Evaluar Precheck Meta | Crítico | Ruta por estado |
| Wait 5m Precheck Retry | `n8n-nodes-base.wait` | Espera 5 min entre retries precheck | Estado retry | Reintento precheck | Rutear Estado Precheck | Medio | Delay registrado |
| Init Retry Pausa | `n8n-nodes-base.set` | Inicializa contador retry pausa | Estado ready_to_pause | `pause_attempt=1`, `max=3` | Rutear Estado Precheck | Medio | Contadores pausa |
| Meta - Pausar Ad | `n8n-nodes-base.httpRequest` | Ejecuta pausa de Ad (`status=PAUSED`) | `Ad_ID` | Full response HTTP | Init Retry Pausa / Wait Pausa + credencial n8n `Meta Ads API (Bearer)` | Crítico | HTTP status pausa |
| Evaluar Pausa | `n8n-nodes-base.code` | Decide `success` / `retry` / `failed` según status y attempts | Respuesta pausa + contadores | Estado de pausa | Meta - Pausar Ad | Crítico | `pause_state`, `pause_reason` |
| Rutear Resultado Pausa | `n8n-nodes-base.switch` | Rutea éxito / retry / falla final | `pause_state` | Postcheck / wait retry / alerta crítica | Evaluar Pausa | Crítico | Ruta tomada |
| Meta - Postcheck Estado Ad | `n8n-nodes-base.httpRequest` | Revalida estado del Ad luego de pausa | `Ad_ID` | Full response HTTP | Rama success de `Rutear Resultado Pausa` + credencial n8n `Meta Ads API (Bearer)` | Crítico | `statusCode`, body Meta |
| Evaluar Postcheck Meta | `n8n-nodes-base.code` | Confirma `effective_status=PAUSED` para habilitar finalización | Respuesta postcheck + contexto de pausa | `postcheck_state=confirmed_paused|failed` | Meta - Postcheck Estado Ad | Crítico | `postcheck_state`, `ad_status_postcheck` |
| Wait 5m Pausa Retry | `n8n-nodes-base.wait` | Espera 5 min entre retries de pausa | Estado retry | Reintento pausa | Rutear Resultado Pausa | Medio | Delay registrado |
| Sheets - Marcar Finalizado | `n8n-nodes-base.googleSheets` | Actualiza `Status_Contrato=Finalizado` + fecha fin | Pausa 2xx + postcheck `PAUSED` | Fila finalizada | Finalizado Payload Valido + credenciales GS | Crítico | Update de estado final |
| Alerta Crítica - Regex inválido | `n8n-nodes-base.set` | Construye alerta crítica por no match regex | Rama false regex | Payload CRITICAL | Regex Coincide false | Alto | `alert_type=...REGEX_MISMATCH` |
| Alerta Crítica - Precheck fallido | `n8n-nodes-base.set` | Construye alerta crítica por precheck no recuperable | Rama fallo precheck | Payload CRITICAL | Rutear Estado Precheck (fallo) | Crítico | `alert_type=...PRECHECK_FAILED` |
| Alerta Crítica - Pausa fallida | `n8n-nodes-base.set` | Construye alerta crítica por retry agotado/fallo pausa | Rama falla pausa | Payload CRITICAL | Rutear Resultado Pausa (fallo) | Crítico | `alert_type=...RETRY_EXHAUSTED` |
| Emitir Alerta Crítica | `n8n-nodes-base.httpRequest` | Envía alerta crítica al webhook operativo | Payload CRITICAL | Respuesta webhook | Nodos de alerta + `ALERT_WEBHOOK_URL` | Crítico | HTTP status alerta |
| Stop and Error - Escalar Incidente | `n8n-nodes-base.stopAndError` | Corta ejecución con error explícito para trazabilidad fuerte | Payload crítico enviado | Error de ejecución | Emitir Alerta Crítica | Crítico | Error visible en ejecución |

---

## Workflow: `workflows/ops-reporting-alerts.json`

| Nodo | Tipo de nodo | Función exacta | Inputs esperados | Outputs esperados | Dependencias | Riesgo si falla | Evidencia / log que deja |
|---|---|---|---|---|---|---|---|
| KillSwitch Result Webhook | `n8n-nodes-base.webhook` | Recibe resumen de ejecución del kill-switch | POST JSON | Item de entrada | Endpoint activo | Alto | Payload recibido |
| Normalize Payload | `n8n-nodes-base.code` | Normaliza métricas, incidents, channel, execution_status; deriva severidad | Payload webhook | JSON normalizado + `derived.*` | Webhook | Alto | `derived.severity`, métricas normalizadas |
| Is Critical Alert | `n8n-nodes-base.if` | Separa CRITICAL de INFO/WARN | `derived.severity` o `derived.is_critical` | Rama CRITICAL o normal | Normalize Payload | Medio-Alto | Rama ejecutada |
| Build CRITICAL Message | `n8n-nodes-base.code` | Construye mensaje crítico con métricas/incidentes y acción requerida | Payload normalizado | `message_text` crítico | Is Critical Alert (true) | Medio | Mensaje generado |
| Build INFO/WARN Message | `n8n-nodes-base.code` | Construye mensaje INFO o WARN | Payload normalizado | `message_text` | Is Critical Alert (false) | Medio | Mensaje generado |
| Is Slack Channel | `n8n-nodes-base.if` | Evalúa si canal es Slack | `notification.channel` | Slack o siguiente validación | Build Message | Medio | Rama seleccionada |
| Send Slack Notification | `n8n-nodes-base.httpRequest` | Envía mensaje a webhook Slack | `notification.slack.webhook_url`, `message_text` | Éxito o error output | Is Slack Channel | Alto | HTTP status envío |
| Is Telegram Channel | `n8n-nodes-base.if` | Evalúa si canal es Telegram | `notification.channel` | Telegram o unsupported | Is Slack Channel (false) | Medio | Rama seleccionada |
| Send Telegram Notification | `n8n-nodes-base.httpRequest` | Envía mensaje vía API Telegram Bot | token/chat_id/message | Éxito o error output | Is Telegram Channel | Alto | HTTP status envío |
| Log Channel Send Failure | `n8n-nodes-base.code` | Log estructurado de fallo de canal (sin fallback automático) | Error output de send nodes | Evento `ops_notification_channel_error` | Send Slack/Telegram error output | Medio | Evento de error con correlation_id |
| Log Slack Sent | `n8n-nodes-base.code` | Log de notificación Slack enviada | Éxito Slack | Evento `ops_notification_sent` | Send Slack Notification | Bajo | Log éxito Slack |
| Log Telegram Sent | `n8n-nodes-base.code` | Log de notificación Telegram enviada | Éxito Telegram | Evento `ops_notification_sent` | Send Telegram Notification | Bajo | Log éxito Telegram |
| Log Unsupported Channel | `n8n-nodes-base.code` | Log cuando channel no es Slack/Telegram | Canal inválido | Evento `ops_notification_channel_unsupported` | Is Telegram Channel (false) | Medio | Log de canal no soportado |

---

## Archivo no-workflow: `workflows/_integration-payload-contract.json`

Este archivo **no contiene nodos**. Es una definición de contrato canónico E2E.

| Artefacto | Tipo | Función | Inputs | Outputs | Dependencias | Riesgo si falla | Evidencia |
|---|---|---|---|---|---|---|---|
| `_integration-payload-contract.json` | JSON schema/example | Estandarizar payload entre kill-switch y reporting | N/A | Estructura canónica (`execution`, `metrics`, `results`, `errors`) | Alineación entre equipos/workflows | Alto (drift de contrato e integraciones rotas) | Archivo versionado en repo |

---

## Observaciones de consistencia detectadas

1. Existen alias de campos entre workflows/spec (`ID_Contrato` vs `Contrato_ID`, etc.).
2. Reporting soporta Slack o Telegram como canal en payload; no hay fallback automático entre canales.
3. Para auditoría fuerte, el kill-switch ya incluye `Stop and Error` en incidentes críticos.
