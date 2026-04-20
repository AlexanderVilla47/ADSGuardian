# Workflow MVP — Ops Reporting & Alerts (Kill-Switch Diario)

## Objetivo

Publicar un resumen operativo por ejecución del kill-switch diario y disparar alerta crítica cuando haya anuncios vencidos que no pudieron pausarse.

Archivo exportable: `workflows/ops-reporting-alerts.json`

Timezone operativa fija del workflow: `America/Argentina/Buenos_Aires`.

---

## Contrato de entrada

Trigger: `Webhook` (`POST /ops-reporting-alerts`)

### Payload esperado (JSON)

```json
{
  "execution_id": "ks-2026-04-05-001",
  "correlation_id": "corr-9f17f1",
  "execution_mode": "scheduled",
  "executed_at": "2026-04-05T03:00:00-03:00",
  "timezone": "America/Argentina/Buenos_Aires",
  "execution_status": "success",
  "metrics": {
    "contracts_evaluated": 42,
    "ads_evaluated": 380,
    "paused_success_count": 11,
    "paused_error_count": 0,
    "expired_unpaused_count": 0,
    "preventive_48h_count": 7,
    "duration_ms": 48231
  },
  "incidents": [
    {
      "code": "META_429_RETRY",
      "message": "Retry aplicado en contrato CTR-121"
    }
  ],
  "notification": {
    "channel": "slack",
    "slack": {
      "webhook_url": "__REDACTED_SLACK_WEBHOOK__"
    },
    "telegram": {
      "bot_token": "123456:ABCDEF",
      "chat_id": "-1001234567890"
    }
  }
}
```

### Campos relevantes

- `notification.channel`: `slack` o `telegram`.
- `metrics.expired_unpaused_count`: activa rama CRITICAL cuando `> 0`.
- `execution_status`: reporta resultado de corrida (`success` / `error` / otros).

---

## Contrato de salida

En MVP, el webhook responde `200` inmediato (modo `onReceived`) al aceptar el evento.

Resultado operativo interno del workflow:

- Emite notificación por el canal seleccionado en payload.
- Loguea evento de envío exitoso o fallo de envío.
- Si el canal no es soportado, loguea error de canal no soportado.

No hay fallback automático entre canales en MVP.

---

## Severidades

### INFO

Se asigna cuando:

- `expired_unpaused_count == 0`
- `execution_status == success`
- sin incidentes relevantes ni errores de pausa.

### WARN

Se asigna cuando NO es CRITICAL y se cumple al menos uno:

- `execution_status != success`, o
- `paused_error_count > 0`, o
- existen incidentes en payload.

### CRITICAL

Se asigna cuando:

- `metrics.expired_unpaused_count > 0`

Además activa rama dedicada de alerta crítica con mensaje de escalamiento operativo.

---

## Plantillas de mensaje

### Plantilla INFO/WARN

```text
[SEVERITY] AdsKiller Kill-Switch Diario
Execution ID: {execution_id}
Correlation ID: {correlation_id}
Modo: {execution_mode}
Estado ejecución: {execution_status}
TZ: {timezone}
Fecha ejecución: {executed_at}

Métricas clave
- Contratos evaluados: {contracts_evaluated}
- Ads evaluados: {ads_evaluated}
- Ads pausados OK: {paused_success_count}
- Errores al pausar: {paused_error_count}
- Preventivas 48h: {preventive_48h_count}
- Vencidos sin pausar: {expired_unpaused_count}
- Duración (ms): {duration_ms}

Incidentes
{incidents_formatted}
```

### Plantilla CRITICAL

```text
[CRITICAL] AdsKiller Kill-Switch Diario
... (mismo resumen operativo)

Acción requerida: revisar anuncios vencidos sin pausar y escalar incidente operativo.
```

---

## Enrutamiento por canal

1. Si `derived.severity == CRITICAL` o `derived.is_critical == true` → `Build CRITICAL Message`.
2. Si no, `Build INFO/WARN Message`.
3. Si `notification.channel == slack` → `Send Slack Notification` (HTTP Webhook).
4. Si `notification.channel == telegram` → `Send Telegram Notification` (API Telegram Bot).
5. Otro valor → `Log Unsupported Channel`.

Errores de envío (`Slack` o `Telegram`) se enrutan a `Log Channel Send Failure` y el flujo finaliza sin intentar otro canal.

---

## Ejemplos de payload

### A) Éxito normal (INFO)

```json
{
  "execution_id": "ks-2026-04-05-001",
  "execution_mode": "scheduled",
  "execution_status": "success",
  "metrics": {
    "contracts_evaluated": 20,
    "ads_evaluated": 150,
    "paused_success_count": 4,
    "paused_error_count": 0,
    "expired_unpaused_count": 0,
    "preventive_48h_count": 3,
    "duration_ms": 21400
  },
  "incidents": [],
  "notification": {
    "channel": "slack",
    "slack": {
      "webhook_url": "__REDACTED_SLACK_WEBHOOK__"
    }
  }
}
```

### B) Ejecución con incidentes (WARN)

```json
{
  "execution_id": "ks-2026-04-05-002",
  "execution_mode": "manual",
  "execution_status": "error",
  "metrics": {
    "contracts_evaluated": 8,
    "ads_evaluated": 39,
    "paused_success_count": 2,
    "paused_error_count": 1,
    "expired_unpaused_count": 0,
    "preventive_48h_count": 1,
    "duration_ms": 29700
  },
  "incidents": [
    {
      "code": "META_500",
      "message": "Error temporal en endpoint de pause"
    }
  ],
  "notification": {
    "channel": "telegram",
    "telegram": {
      "bot_token": "123456:ABCDEF",
      "chat_id": "-1001234567890"
    }
  }
}
```

### C) Alerta crítica (CRITICAL)

```json
{
  "execution_id": "ks-2026-04-05-003",
  "execution_mode": "scheduled",
  "execution_status": "success",
  "metrics": {
    "contracts_evaluated": 30,
    "ads_evaluated": 211,
    "paused_success_count": 9,
    "paused_error_count": 0,
    "expired_unpaused_count": 2,
    "preventive_48h_count": 5,
    "duration_ms": 40320
  },
  "incidents": [
    {
      "code": "EXPIRED_UNPAUSED",
      "message": "Persisten 2 anuncios vencidos activos"
    }
  ],
  "notification": {
    "channel": "slack",
    "slack": {
      "webhook_url": "__REDACTED_SLACK_WEBHOOK__"
    }
  }
}
```

---

## Limitaciones MVP

- No existe fallback automático Slack ↔ Telegram.
- El workflow asume que credenciales/secretos de canal llegan válidos en payload o resolución previa externa.
- No persiste estado histórico (solo enruta y loguea ejecución actual).

---

## Observación de consistencia SDD/spec

En esta rama no se encontraron artefactos SDD formales (`openspec/`, `spec.md`, `design.md`, `tasks.md`) para este cambio.

Se implementó alineado al baseline funcional de `AGENTS.md` (alerta crítica ante vencidos sin pausar, timezone fija, y reporte por ejecución), dejando esta observación explícita para trazabilidad.
