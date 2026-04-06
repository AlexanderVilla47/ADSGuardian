# AdsKiller — SPEC MVP (final)

## 1) Objetivo y KPI del MVP

### Objetivo
Implementar una automatización operativa en n8n que detecte anuncios vencidos en Meta Ads y los pause **a nivel Ad**, con soporte de UI para altas, consultas y extensiones de contrato, minimizando riesgo de anuncios activos fuera de vigencia.

### KPI del MVP
- **KPI-1 (principal):** 100% de anuncios vencidos detectados en un ciclo deben terminar en estado pausado o generar alerta crítica trazable.
- **KPI-2:** 0 ejecuciones de pausa sobre entidades que no sean Ad (Ad Set/Campaign prohibido).
- **KPI-3:** 100% de contratos creados/extendidos con fecha válida `YYYY-MM-DD`.
- **KPI-4:** 100% de fallos persistentes de pausa (post reintentos) generan alerta crítica.
- **KPI-5:** 100% de ejecuciones manuales quedan trazadas con actor, timestamp y resultado.

---

## 2) Alcance (incluye / no incluye)

### Incluye (MVP)
- Pausa de anuncios solo a nivel **Ad** en Meta Ads.
- UI operativa para:
  - Alta de contratos/reglas.
  - Consulta de próximos a vencer / vencidos.
  - Extensión de vigencia.
  - Ejecución manual forzada.
- Evaluación programada de vencimientos.
- Preventiva 48h previa al vencimiento (una sola vez por contrato-ad; se resetea con extensión).
- Pre-check de estado `ACTIVE` antes de pausar.
- Matching por regex flexible case-insensitive sobre nombre de anuncio.
- Retry para Meta API en `429/500`: 3 intentos, 5 minutos entre intentos.
- Alertado crítico cuando un anuncio vencido no pudo pausarse.

### No incluye (MVP)
- Fallback operativo por Slack/Telegram.
- Pausas a nivel Ad Set o Campaign.
- Motor avanzado de priorización de incidentes más allá de severidad definida.

---

## 3) Requisitos funcionales (RF)

| ID | Requisito |
|---|---|
| RF-01 | El sistema MUST permitir alta de contrato desde UI con validación obligatoria de formato de fecha `YYYY-MM-DD`. |
| RF-02 | El sistema MUST ejecutar evaluación programada en timezone `America/Argentina/Buenos_Aires`. |
| RF-03 | El sistema MUST permitir ejecución manual forzada desde UI, con trazabilidad de operador y resultado. |
| RF-04 | El sistema MUST identificar anuncios asociados por regex flexible case-insensitive sobre nombre de anuncio. |
| RF-05 | El sistema MUST disparar evento preventivo 48h antes del vencimiento solo una vez por contrato-ad. |
| RF-06 | El sistema MUST resetear bandera preventiva al extender vigencia del contrato. |
| RF-07 | El sistema MUST intentar pausa al vencimiento efectivo únicamente sobre Ads. |
| RF-08 | El sistema MUST realizar pre-check en Meta y pausar solo si estado actual del Ad es `ACTIVE`. |
| RF-09 | El sistema MUST aplicar retry para errores `429` y `500` con política fija: 3 intentos y espera de 5 minutos. |
| RF-10 | Si la pausa en Meta es exitosa, el sistema MUST actualizar `Status_Contrato` a `Finalizado`. |
| RF-11 | Si un anuncio vencido no pudo pausarse tras retries, el sistema MUST emitir alerta crítica. |
| RF-12 | El sistema MUST exponer consulta operativa de próximos a vencer, vencidos y estado de acciones ejecutadas. |

---

## 4) Requisitos no funcionales (RNF)

| ID | Requisito |
|---|---|
| RNF-01 | Timezone operativa fija: `America/Argentina/Buenos_Aires` en todas las evaluaciones de vencimiento. |
| RNF-02 | Trazabilidad completa de ejecuciones programadas y manuales (inicio, fin, resultado, correlación). |
| RNF-03 | Observabilidad mínima obligatoria: logs estructurados, métricas de éxito/error/retry/latencia y alertas por severidad. |
| RNF-04 | Resiliencia mínima Meta Ads API: reintentos sólo para `429/500`, sin retry ciego para `4xx` no recuperables. |
| RNF-05 | Validación estricta de entrada de fecha; rechazar cualquier formato distinto a `YYYY-MM-DD`. |
| RNF-06 | Seguridad operativa: no exponer tokens/secretos en logs ni en respuestas de UI. |

---

## 5) Modelo de datos (Google Sheets)

## Hoja `Contratos`

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `Contrato_ID` | String | Sí | Único, no vacío (ej. `CTR-000123`). |
| `Cliente` | String | Sí | 1..120 chars. |
| `Regex_Anuncio` | String | Sí | Regex válida; evaluación case-insensitive. |
| `Fecha_Inicio` | Date(String) | Sí | `YYYY-MM-DD` estricto. |
| `Fecha_Fin` | Date(String) | Sí | `YYYY-MM-DD` estricto; `Fecha_Fin >= Fecha_Inicio`. |
| `Ad_ID` | String | No | Si está presente, formato numérico de Meta. |
| `Status_Contrato` | Enum | Sí | `Activo`, `Finalizado`, `Extendido`, `Error_Pausa`. |
| `Preventiva_48h_Emitida` | Boolean | Sí | Default `false`; única emisión por vigencia activa. |
| `Preventiva_48h_Timestamp` | DateTime | No | ISO8601 al emitir preventiva. |
| `Ultima_Ejecucion_ID` | String | No | Referencia a `Ejecuciones.Ejecucion_ID`. |
| `Ultimo_Error_Codigo` | String | No | Código técnico final si falló pausa. |
| `Ultimo_Error_Detalle` | String | No | Mensaje resumido para operación. |
| `Updated_At` | DateTime | Sí | ISO8601, actualización de registro. |

Reglas de validación clave:
- Rechazar alta/extensión si fecha no cumple regex `^\d{4}-\d{2}-\d{2}$`.
- En extensión, `Fecha_Fin` nueva MUST ser mayor a la vigente.
- Al extender: `Preventiva_48h_Emitida` MUST resetearse a `false`.

## Hoja `Ejecuciones`

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `Ejecucion_ID` | String | Sí | Único por corrida. |
| `Tipo_Ejecucion` | Enum | Sí | `Programada` / `Manual_Forzada`. |
| `Trigger_Timestamp` | DateTime | Sí | ISO8601 (tz BA normalizada). |
| `Actor` | String | Condicional | Obligatorio si `Manual_Forzada`. |
| `Contrato_ID` | String | Sí | Debe existir en `Contratos`. |
| `Ad_ID` | String | No | Obligatorio para intento de pausa. |
| `Meta_Precheck_Estado` | Enum | No | `ACTIVE`, `PAUSED`, `UNKNOWN`. |
| `Intentos_Pausa` | Integer | Sí | 0..3. |
| `Resultado` | Enum | Sí | `Sin_Accion`, `Pausado`, `Error_Recuperable`, `Error_Final`. |
| `Http_Status_Final` | Integer | No | 100..599. |
| `Duracion_ms` | Integer | Sí | >=0. |
| `Correlation_ID` | String | Sí | Obligatorio para trazabilidad end-to-end. |

## Hoja `Alertas` (operativa)

| Campo | Tipo | Obligatorio | Validación |
|---|---|---|---|
| `Alerta_ID` | String | Sí | Único. |
| `Severidad` | Enum | Sí | `INFO`, `WARN`, `CRITICAL`. |
| `Contrato_ID` | String | Sí | Referencia válida. |
| `Ad_ID` | String | No | Si aplica. |
| `Motivo` | String | Sí | No vacío. |
| `Correlation_ID` | String | Sí | Debe existir en `Ejecuciones`. |
| `Creada_At` | DateTime | Sí | ISO8601. |
| `Estado` | Enum | Sí | `Abierta`, `En_Analisis`, `Cerrada`. |

---

## 6) Reglas de negocio cerradas

1. La pausa se ejecuta **solo a nivel Ad**.
2. UI incluida para altas, consultas y extensiones.
3. Preventiva 48h: una sola vez por contrato-ad y reset al extender vigencia.
4. Sin fallback Slack/Telegram en MVP.
5. Si pausa Meta es exitosa, `Status_Contrato` → `Finalizado`.
6. Fecha estricta `YYYY-MM-DD` (sin excepciones).
7. Ejecución forzada manual permitida.
8. Alerta crítica si queda anuncio vencido sin pausar.
9. Pre-check `ACTIVE` antes de pausar.
10. Matching por regex flexible case-insensitive sobre nombre de anuncio.
11. Retry Meta `429/500`: 3 intentos, 5 minutos entre intentos.
12. Timezone operativa: `America/Argentina/Buenos_Aires`.

---

## 7) Escenarios Given / When / Then

### Escenario 1 — Alta contrato válida
- **Given** operador en UI con datos completos y fecha `2026-06-30`
- **When** confirma alta
- **Then** se crea fila en `Contratos` con `Status_Contrato=Activo` y `Preventiva_48h_Emitida=false`

### Escenario 2 — Consulta próximos a vencer
- **Given** existen contratos con vencimiento en los próximos 7 días
- **When** operador abre vista de consulta
- **Then** UI muestra lista ordenada por `Fecha_Fin` con estado y anuncio asociado

### Escenario 3 — Extensión de contrato
- **Given** contrato activo con `Fecha_Fin=2026-06-30`
- **When** operador extiende a `2026-07-15`
- **Then** `Fecha_Fin` se actualiza, `Status_Contrato=Extendido` y `Preventiva_48h_Emitida=false`

### Escenario 4 — Preventiva 48h (una sola vez)
- **Given** contrato activo a 48h del vencimiento y `Preventiva_48h_Emitida=false`
- **When** corre scheduler
- **Then** se emite evento preventivo y bandera pasa a `true`

### Escenario 5 — Kill-switch por vencimiento
- **Given** contrato vencido y anuncio matcheado por regex
- **When** corre evaluación de vencimiento
- **Then** sistema intenta pausar el Ad y registra ejecución

### Escenario 6 — Pre-check ACTIVE
- **Given** contrato vencido con Ad en Meta estado `PAUSED`
- **When** flujo llega a pre-check
- **Then** no ejecuta pausa, registra `Sin_Accion` con motivo `No_ACTIVE`

### Escenario 7 — Retry 429/500 (3x, 5m)
- **Given** intento de pausa devuelve `429`
- **When** aplica política de resiliencia
- **Then** reintenta hasta 3 veces con espera de 5 minutos entre intentos

### Escenario 8 — Alerta crítica por falla persistente
- **Given** agotados los 3 intentos y sin pausa exitosa
- **When** finaliza la ejecución
- **Then** crea alerta `CRITICAL` en `Alertas` con `Correlation_ID`

### Escenario 9 — Ejecución manual forzada
- **Given** operador dispara corrida manual desde UI
- **When** se inicia workflow
- **Then** se registra `Tipo_Ejecucion=Manual_Forzada`, `Actor` y resultado completo

### Escenario 10 — Error de formato de fecha
- **Given** operador intenta alta con fecha `30/06/2026`
- **When** envía formulario
- **Then** sistema rechaza la operación e informa error `FormatoFechaInvalido`

### Escenario 11 — Matching regex case-insensitive
- **Given** regex `promo.*abril` y anuncio `PROMO Super Abril 2026`
- **When** se evalúan anuncios activos
- **Then** el anuncio se considera match válido

### Escenario 12 — Estado final tras pausa exitosa
- **Given** pausa de Ad responde éxito en Meta
- **When** se persiste resultado
- **Then** `Status_Contrato` cambia a `Finalizado`

---

## 8) Observabilidad y alertas

## Logs estructurados mínimos
Campos obligatorios por evento:
- `timestamp`
- `workflow_name`
- `execution_id`
- `correlation_id`
- `contrato_id`
- `ad_id` (si aplica)
- `event_type` (`precheck`, `pause_attempt`, `retry`, `final_status`, `alert`)
- `severity` (`INFO`, `WARN`, `ERROR`)
- `http_status` (si aplica)

## Métricas mínimas
- `execution_success_total`
- `execution_error_total`
- `execution_duration_ms`
- `retry_count_total`
- `meta_api_429_total`
- `meta_api_500_total`
- `ads_vencidos_detectados_total`
- `ads_vencidos_no_pausados_total`

## Severidades
- `INFO`: alta/consulta/extensión, inicio/fin de corrida, pausa exitosa.
- `WARN`: reintentos por `429/500`, preventiva emitida.
- `CRITICAL`: anuncio vencido no pausado tras política de retry.

---

## 9) Criterios de aceptación medibles

1. **CA-01:** Dado set de prueba con anuncios vencidos, 100% termina pausado o con alerta crítica registrada.
2. **CA-02:** 0 acciones de pausa sobre Ad Set/Campaign en logs de ejecución MVP.
3. **CA-03:** 100% de entradas de fecha inválida son rechazadas con error explícito.
4. **CA-04:** Escenarios de `429` y `500` evidencian exactamente 3 intentos máximo con espera de 5 minutos.
5. **CA-05:** Toda pausa exitosa cambia `Status_Contrato` a `Finalizado`.
6. **CA-06:** Preventiva 48h se emite una sola vez por vigencia y se rehabilita tras extensión.
7. **CA-07:** 100% de ejecuciones manuales tienen `Actor`, `Correlation_ID` y resultado final.
8. **CA-08:** Matching regex case-insensitive validado en al menos 5 casos de prueba con variaciones de mayúsculas/minúsculas.

---

## 10) Riesgos + mitigaciones

| Riesgo | Impacto | Mitigación MVP |
|---|---|---|
| Rate-limit o error Meta persistente (`429/500`) | Anuncio vencido puede quedar activo | Retry 3x/5m + alerta crítica obligatoria. |
| Fechas ambiguas o mal cargadas | Evaluación de vencimiento incorrecta | Validación estricta `YYYY-MM-DD` y rechazo inmediato. |
| Regex mal definida | Falsos positivos/negativos en matching | Validación de regex en alta + revisión operativa en UI. |
| Falta de trazabilidad en incidentes | MTTR alto | Correlation ID + logs estructurados + tabla de ejecuciones/alertas. |
| Uso accidental en nivel no permitido | Riesgo de pausa masiva incorrecta | Restricción funcional explícita: solo endpoint/objeto Ad. |

---

## 11) Checklist go-live MVP

- [ ] Workflow programado activo en timezone `America/Argentina/Buenos_Aires`.
- [ ] Trigger manual forzado operativo desde UI.
- [ ] Validación de fecha `YYYY-MM-DD` habilitada en alta/extensión.
- [ ] Matching regex case-insensitive validado con casos reales.
- [ ] Pre-check `ACTIVE` implementado y evidenciado en logs.
- [ ] Retry `429/500` configurado: 3 intentos, espera 5 minutos.
- [ ] Actualización automática `Status_Contrato=Finalizado` tras pausa exitosa.
- [ ] Emisión de alerta `CRITICAL` ante anuncio vencido no pausado.
- [ ] Logs estructurados con `correlation_id` verificados.
- [ ] Métricas mínimas expuestas y visibles para operación.
- [ ] Pruebas de los 12 escenarios Given/When/Then ejecutadas y documentadas.
- [ ] Confirmado explícitamente: **sin fallback Slack/Telegram en MVP**.
