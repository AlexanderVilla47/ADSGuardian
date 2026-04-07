# AdsKiller — Handbook Integral (Handover Total)

> Documento principal de transferencia operativa y técnica.
>
> Audiencia: personas con y sin contexto técnico.
>
> Base de evidencia: `AGENTS.md`, `docs/spec-mvp.md` y workflows versionados en `workflows/*.json`.

---

## 1) Resumen ejecutivo

AdsKiller existe para resolver un problema crítico: **evitar que anuncios vencidos queden activos en Meta Ads**.

¿Cómo lo hace?
- Centraliza contratos en Google Sheets.
- Permite operación desde UI (alta, consulta, extensión y ejecución manual).
- Ejecuta un kill-switch diario (y manual) en n8n para detectar vencidos.
- Antes de pausar, valida que el Ad esté realmente `ACTIVE`.
- Aplica retries controlados ante `429/500`.
- Si no logra pausar un vencido, dispara alerta crítica y deja trazabilidad.

Resultado esperado de negocio:
- Cero anuncios vencidos activos al cierre operativo, o incidente crítico explícito y trazable.

---

## 2) Arquitectura completa y conexión entre workflows

## 2.1 Componentes
1. **UI operativa**
   - Llama al workflow `contract-ui-management`.
2. **Google Sheets**
   - Fuente operativa (Contratos, Ejecuciones, Alertas según spec).
3. **n8n — workflow de UI**
   - Alta / Consulta / Extensión de contratos.
4. **n8n — workflow kill-switch diario**
   - Evalúa preventiva 48h y vencimiento.
   - Ejecuta pre-check + pausa Meta.
5. **Meta Ads API**
   - Estado de Ad y acción de pausa.
6. **n8n — workflow reporting/alerts**
   - Resume ejecución y notifica por canal configurado.
7. **Artefacto de contrato E2E**
   - `workflows/_integration-payload-contract.json` (esquema canónico de salida/consumo entre flujos).

## 2.2 Relación entre workflows
- `contract-ui-management.json`
  - Administra ciclo de vida de contratos.
- `contract-guard-daily-killswitch.json`
  - Consume contratos y ejecuta lógica de control diario.
- `ops-reporting-alerts.json`
  - Consume resumen del kill-switch y emite notificación operacional.

---

## 3) Diagrama textual end-to-end

```text
[UI Operativa]
   | POST /contract-ui-management
   v
[Workflow contract-ui-management]
   | valida action/fechas
   | escribe/lee/actualiza Google Sheets
   v
[Google Sheets: Contratos]
   | (diario 00:01 o manual)
   v
[Workflow contract-guard-daily-killswitch]
   | clasifica preventive/expired
   | preventive -> alerta WARNING + marca Notificado_Previo
   | expired -> regex check -> precheck Meta ACTIVE
   | ACTIVE -> pausa Ad (retry 3x, wait 5m)
   | éxito -> Status_Contrato=Finalizado
   | fallo persistente -> alerta CRITICAL + Stop and Error
   v
[Meta Ads API]
   | estado y respuesta de pausa
   v
[Workflow ops-reporting-alerts]
   | normaliza payload de ejecución
   | deriva severidad INFO/WARN/CRITICAL
   | notifica por Slack o Telegram según channel
   | log de éxito/fallo/canal inválido
   v
[Operación]
```

---

## 4) Contrato de datos completo

## 4.1 Google Sheets (según `docs/spec-mvp.md` + workflows)

### Hoja `Contratos`

| Campo | Tipo | Obligatorio | Regla |
|---|---|---:|---|
| `Contrato_ID` / `ID_Contrato` | string | Sí | ID único |
| `Cliente` | string | Sí | 1..120 chars |
| `Anuncio_Regex` / `Regex_Anuncio` | string | Sí | Regex válida, case-insensitive |
| `Fecha_Inicio` / `Fecha_Alta` | date string | Sí | `YYYY-MM-DD` |
| `Fecha_Fin` / `Fecha_Expiracion` | date string | Sí | `YYYY-MM-DD`, >= inicio |
| `Ad_ID` | string | No | ID de Ad Meta |
| `Ad_Name` | string | No | Nombre para fallback regex |
| `Status_Contrato` | enum | Sí | `Activo`, `Finalizado`, `Extendido`, etc. |
| `Notificado_Previo` / `Preventiva_48h_Emitida` | boolean | Sí | default `false` |
| `Fecha_Notificado_Previo` | datetime | No | ISO8601 |
| `Updated_At` | datetime | Sí | ISO8601 |

> Nota de naming: hay variación de nombres entre spec y workflows (`Contrato_ID` vs `ID_Contrato`, `Fecha_Fin` vs `Fecha_Expiracion`). Ver sección de diferencias.

### Hoja `Ejecuciones` (recomendada en spec)

| Campo | Tipo | Uso |
|---|---|---|
| `Ejecucion_ID` | string | ID único corrida |
| `Tipo_Ejecucion` | enum | Programada / Manual_Forzada |
| `Contrato_ID` | string | trazabilidad |
| `Ad_ID` | string | trazabilidad |
| `Meta_Precheck_Estado` | enum | ACTIVE/PAUSED/UNKNOWN |
| `Intentos_Pausa` | int | 0..3 |
| `Resultado` | enum | Sin_Accion/Pausado/Error_* |
| `Http_Status_Final` | int | diagnóstico |
| `Duracion_ms` | int | métricas |
| `Correlation_ID` | string | correlación end-to-end |

### Hoja `Alertas` (recomendada en spec)

| Campo | Tipo | Uso |
|---|---|---|
| `Alerta_ID` | string | ID único |
| `Severidad` | enum | INFO/WARN/CRITICAL |
| `Contrato_ID` | string | referencia |
| `Ad_ID` | string | referencia |
| `Motivo` | string | motivo alerta |
| `Correlation_ID` | string | correlación |
| `Estado` | enum | Abierta/En_Analisis/Cerrada |

## 4.2 Payloads de integración

### A) UI → `contract-ui-management`

```json
{ "action": "alta | consulta | extension" }
```

Alta:
```json
{
  "action": "alta",
  "ID_Contrato": "CTR-1001",
  "Cliente": "Acme SA",
  "Anuncio_Regex": "promo_otoño_2026",
  "Fecha_Expiracion": "2026-04-15",
  "Ad_ID": "12001234567890"
}
```

Consulta:
```json
{ "action": "consulta", "dias_proximos": 7 }
```

Extensión:
```json
{
  "action": "extension",
  "ID_Contrato": "CTR-1001",
  "Nueva_Fecha_Expiracion": "2026-05-15"
}
```

### B) Kill-switch → Ops reporting (canónico)

Referencia oficial: `workflows/_integration-payload-contract.json`

Campos críticos:
- `schema_version`, `event_type`, `timezone`
- `correlation_id`
- `execution.execution_id`, `execution.run_type`, `execution.status`
- `severity`
- `metrics.*`
- `results[]`, `errors[]`

### C) Ops reporting → canal notificación
- Slack: webhook URL + `text`.
- Telegram: bot token + chat id + `text`.

---

## 5) Reglas de negocio cerradas

1. Pausa solo a nivel **Ad**.
2. Pre-check en Meta antes de pausar.
3. Solo pausar si estado Meta = `ACTIVE`.
4. Si pausa exitosa → `Status_Contrato = Finalizado`.
5. Fecha estricta `YYYY-MM-DD`.
6. Matching por regex flexible case-insensitive.
7. Preventiva 48h una sola vez por vigencia.
8. Extensión de vigencia resetea preventiva.
9. Timezone fija `America/Argentina/Buenos_Aires`.
10. Retry para `429/500`: 3 intentos con espera de 5 minutos.
11. Ejecución forzada manual permitida y trazable.
12. Si queda vencido sin pausar → alerta crítica obligatoria.

---

## 6) Sección por workflow

## 6.1 Workflow: `contract-ui-management`

### Propósito
Gestionar desde UI: alta, consulta y extensión de contratos.

### Trigger(s)
- `Webhook UI` (`POST /contract-ui-management`).

### Entradas / Salidas
- Entrada: payload con `action`.
- Salida: respuesta síncrona por `Respond to Webhook` (201/200).

### Paso a paso
1. Normaliza request y agrega `timezone` + timestamps.
2. Valida acción y formato de fechas.
3. Rutea por acción:
   - `alta`: prepara fila y hace append en Sheets.
   - `consulta`: lee contratos y filtra próximos vencimientos.
   - `extension`: busca contrato, actualiza fecha y resetea `Notificado_Previo`.
4. Responde JSON a UI.

### Errores esperables y manejo
- Acción inválida → `ValidationError`.
- Fecha inválida → `ValidationError`.
- Contrato inexistente en extensión → `NotFoundError`.

### Payload ejemplo
```json
{ "action": "consulta", "dias_proximos": 10 }
```

---

## 6.2 Workflow: `contract-guard-daily-killswitch`

### Propósito
Controlar diariamente contratos activos, emitir preventiva 48h y pausar Ads vencidos.

### Trigger(s)
- `Cron Diario 00:01` (`1 0 * * *`).
- `Trigger Manual On-Demand`.

### Entradas / Salidas
- Entrada: filas de Google Sheets + variables de entorno (`GSHEET_*`, `META_ACCESS_TOKEN`, `ALERT_WEBHOOK_URL`).
- Salida:
  - updates en Sheets (`Notificado_Previo`, `Status_Contrato`),
  - alertas WARNING/CRITICAL,
  - `Stop and Error` en incidentes críticos.

### Paso a paso
1. Define contexto de ejecución (scheduled/manual).
2. Lee contratos desde Sheets.
3. Clasifica cada contrato (`preventive` / `expired`) con timezone BA.
4. Rama preventiva:
   - arma alerta WARNING,
   - emite alerta,
   - marca `Notificado_Previo=true`.
5. Rama vencidos:
   - valida regex contra nombre de Sheet,
   - inicializa retry pre-check,
   - pre-check Meta (GET Ad),
   - rutea estado precheck (`ready_to_pause`, `retry`, `not_actionable`, fallo final),
   - si ready: pausa Ad con retry 3x/5m,
   - si éxito: marca `Finalizado`,
   - si fallo: alerta crítica + `Stop and Error`.

### Errores esperables y manejo
- `429/500` en pre-check o pausa → retry 3x con `Wait 5m`.
- Regex no matchea → alerta crítica.
- Pre-check no recuperable → alerta crítica.
- Pausa fallida no recuperable o retry agotado → alerta crítica + error explícito.

### Payload ejemplo de alerta crítica
```json
{
  "alert_severity": "CRITICAL",
  "alert_type": "EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED",
  "Contrato_ID": "CTR-10021",
  "Ad_ID": "120212300001234567",
  "pause_status_code": 429,
  "pause_attempt": 3,
  "correlation_id": "ak-1712345678901-a1b2c3"
}
```

---

## 6.3 Workflow: `ops-reporting-alerts`

### Propósito
Recibir resumen de ejecución kill-switch, derivar severidad y notificar al canal operativo.

### Trigger(s)
- `Webhook` (`POST /ops-reporting-alerts`, respuesta inmediata onReceived).

### Entradas / Salidas
- Entrada: payload de resumen de ejecución (`execution_*`, `metrics`, `incidents`, `notification`).
- Salida:
  - envío a Slack o Telegram,
  - log de envío exitoso,
  - log de fallo de canal,
  - log de canal no soportado.

### Paso a paso
1. Normaliza payload y métricas.
2. Deriva severidad:
   - CRITICAL si `expired_unpaused_count > 0`.
   - WARN si hubo errores/incidentes.
   - INFO en operación limpia.
3. Construye mensaje (plantilla CRITICAL o INFO/WARN).
4. Rutea canal:
   - Slack,
   - Telegram,
   - o unsupported.
5. Registra evento de resultado.

### Errores esperables y manejo
- Falla envío Slack/Telegram → `continueErrorOutput` + `Log Channel Send Failure`.
- Canal inválido → `Log Unsupported Channel`.

### Payload ejemplo
```json
{
  "execution_id": "ks-2026-04-05-001",
  "execution_status": "success",
  "metrics": { "expired_unpaused_count": 0 },
  "notification": {
    "channel": "slack",
    "slack": { "webhook_url": "https://hooks.slack.com/services/XXX/YYY/ZZZ" }
  }
}
```

---

## 6.4 Archivo: `_integration-payload-contract.json`

No es un workflow ejecutable: es un **contrato de integración canónico** para intercambio E2E.

Uso:
- alinear producer/consumer,
- evitar drift de payload entre kill-switch y reporting,
- garantizar versionado (`schema_version`).

---

## 7) “Qué pasa si…” (fallos y edge cases)

1. Si `action` no es alta/consulta/extension → error de validación.
2. Si fecha no cumple `YYYY-MM-DD` → rechazo inmediato.
3. Si extensión apunta a contrato inexistente → `NotFoundError`.
4. Si `dias_proximos` está fuera de 1..60 → rechazo.
5. Si contrato no está activo → kill-switch lo ignora.
6. Si `Fecha_Fin` inválida en Sheets → fila se omite.
7. Si contrato cae en ventana 48h y ya estaba notificado → no duplica preventiva.
8. Si regex de Sheet no matchea → alerta crítica.
9. Si pre-check Meta devuelve `429` → retry.
10. Si pre-check Meta devuelve `500` → retry.
11. Si pre-check Meta no 200 tras retries → alerta crítica.
12. Si pre-check da `PAUSED`/no ACTIVE → no intenta pausa.
13. Si pausa Meta devuelve `429/500` → retry.
14. Si pausa Meta falla tras retries → alerta crítica + Stop and Error.
15. Si pausa Meta éxito → `Status_Contrato=Finalizado`.
16. Si falla canal Slack/Telegram en reporting → queda log de fallo, sin fallback automático.
17. Si channel no soportado → log de canal inválido.
18. Si no llega `correlation_id` en reporting → lo deriva desde execution_id/timestamp.

---

## 8) Runbook operativo

> Para transición controlada de mock/testing a producción (cutover one-shot), usar: **`docs/PROD-CUTOVER-RUNBOOK.md`**.

## Diario
- Revisar corrida `Cron Diario 00:01`.
- Revisar incidentes `CRITICAL` y resolver primero vencidos no pausados.
- Verificar update de `Status_Contrato` en casos pausados.
- Confirmar notificaciones/reporting del día.

## Semanal
- Auditar tasa de retries 429/500.
- Auditar contratos con errores de validación o regex.
- Revisar desviaciones de naming de columnas en Sheets.

## Mensual
- Rotar/validar credenciales (Meta, Google Sheets, canales).
- Revisar métricas de confiabilidad y tiempos de ejecución.
- Ejecutar prueba controlada de incidente crítico.

---

## 9) Checklist de go-live

- [ ] Workflows importados y activos en entorno correcto.
- [ ] Timezone de workflows en `America/Argentina/Buenos_Aires`.
- [ ] Credenciales configuradas por entorno.
- [ ] Variables de entorno cargadas (`GSHEET_*`, `META_ACCESS_TOKEN`, `ALERT_WEBHOOK_URL`).
- [ ] Validación de fechas en UI management probada.
- [ ] Retry 3x/5m probado (pre-check y pausa).
- [ ] `Status_Contrato=Finalizado` probado en pausa exitosa.
- [ ] Alerta crítica probada en fallo persistente.
- [ ] Reporting probado para Slack y/o Telegram.
- [ ] Trazabilidad con correlation_id validada en punta a punta.

---

## 10) Checklist de incident response

1. Confirmar `execution_id` + `correlation_id` del incidente.
2. Identificar etapa de falla: validación / pre-check / pausa / canal alerta.
3. Si hay vencido sin pausa: tratar como P1.
4. Ejecutar corrida manual si corresponde.
5. Aplicar mitigación inmediata (credenciales, cuota, contrato, regex).
6. Validar cierre técnico (ad pausado) y de dato (`Status_Contrato`).
7. Documentar causa raíz y acción preventiva.

---

## 11) Matriz de responsabilidades (RACI)

| Actividad | Operador | Owner Técnico | Owner Negocio | Soporte Integración |
|---|---|---|---|---|
| Alta/consulta/extensión en UI | R | C | A | I |
| Operación diaria de kill-switch | R | A | I | C |
| Gestión de incidentes críticos | R | A | C | C |
| Mantenimiento de credenciales | I | A | I | R |
| Evolución de workflows | I | A | C | R |
| Monitoreo de KPIs | C | R | A | I |

---

## 12) Seguridad (secrets y credenciales)

Advertencias obligatorias:
1. No hardcodear tokens en Code nodes.
2. No exponer `META_ACCESS_TOKEN` ni webhooks en logs/documentación pública.
3. Segregar credenciales por entorno (dev/staging/prod).
4. Aplicar mínimo privilegio en Meta Ads.
5. Rotar secretos periódicamente y tras incidentes.
6. Proteger endpoints webhook (ideal: auth/HMAC/API key, aún no incluido en MVP base).

---

## 13) Diferencias detectadas y cómo resolverlas

## Diferencias detectadas
1. **Inconsistencia de nombres de campos** entre specs/docs/workflows:
   - `Contrato_ID` vs `ID_Contrato`.
   - `Fecha_Fin` vs `Fecha_Expiracion`.
   - `Regex_Anuncio` vs `Anuncio_Regex`.
2. Algunos docs históricos declaran “no existe `docs/spec-mvp.md`”, pero actualmente **sí existe**.
3. Baseline de `AGENTS.md` dice “sin fallback Slack/Telegram en MVP”; el workflow de reporting permite Slack/Telegram como canal seleccionable (sin fallback entre ellos).

## Cómo resolver
1. Definir un diccionario canónico de campos y migración de aliases.
2. Depurar docs históricos para eliminar afirmaciones desactualizadas.
3. Aclarar política de alerting:
   - si Slack/Telegram son canales permitidos de notificación primaria,
   - o si deben salir del scope MVP.

---

## 14) Glosario para no técnicos

- **Ad**: anuncio individual en Meta.
- **Kill-switch**: mecanismo automático para cortar anuncios vencidos.
- **Workflow**: secuencia de pasos automatizados en n8n.
- **Trigger**: evento que inicia un workflow.
- **Pre-check**: verificación previa a una acción sensible.
- **Retry**: reintento cuando hay error temporal.
- **429**: límite de llamadas excedido.
- **500**: error interno del proveedor.
- **Correlation ID**: identificador único para seguir una ejecución punta a punta.
- **Regex**: patrón flexible para matchear textos.
- **Runbook**: guía operativa para ejecutar tareas/incidentes.

---

## 15) Referencias

- `AGENTS.md`
- `docs/spec-mvp.md`
- `docs/workflow-ui-management.md`
- `docs/workflow-killswitch-daily.md`
- `docs/workflow-ops-reporting-alerts.md`
- `docs/integration-e2e.md`
- `docs/NODE-BY-NODE-MAP.md`
- `workflows/*.json`
