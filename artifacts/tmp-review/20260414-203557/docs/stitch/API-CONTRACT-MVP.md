# AdsKiller Front API Contract MVP (A2)

Fecha: 2026-04-13 (post bloque A2)

## 1. Alcance y supuestos

- Este contrato define la API Front MVP para la UI operativa de AdsKiller.
- Fuente de verdad actual: Google Sheets (sin base de datos dedicada en A2).
- Flujos canónicos de referencia:
  - F1 `cFBr6GavlSWDsUFz` (`workflows/contract-ui-management-v2.json`)
  - F2 `8mlwAxLtJVrwpLhi` (`workflows/contract-guard-daily-killswitch.json`)
  - F3 `BFHHQwYFfmcpqshb` (`workflows/ops-reporting-alerts.json`)
- Timezone operativa obligatoria: `America/Argentina/Buenos_Aires`.

## 2. Convenciones globales

### 2.1 Base path y version

- Base path: `/api/v1`
- Content type: `application/json`

### 2.2 Envelope estandar

Respuesta exitosa:

```json
{
  "ok": true,
  "data": {},
  "meta": {
    "correlation_id": "ak-ui-1744522000-abc123",
    "execution_id": "n8n-12345",
    "timestamp": "2026-04-13T12:00:00.000Z",
    "source": "f1|f2|f3|api"
  }
}
```

Respuesta con error:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Fecha invalida. Usar YYYY-MM-DD",
    "details": {
      "field": "end_date"
    },
    "retryable": false
  },
  "meta": {
    "correlation_id": "ak-ui-1744522000-abc123",
    "timestamp": "2026-04-13T12:00:00.000Z"
  }
}
```

### 2.3 Codigos de error estandar

- `VALIDATION_ERROR` -> `400`
- `NOT_FOUND` -> `404`
- `CONFLICT` -> `409`
- `UNSUPPORTED_ACTION` -> `422`
- `PRECONDITION_FAILED` -> `412`
- `RATE_LIMITED` -> `429`
- `UPSTREAM_ERROR` -> `502`
- `INTERNAL_ERROR` -> `500`

### 2.4 Campos canonicos (API)

Campos canonicos para la API (fijos para frontend/backend):

- `contract_id` (string)
- `influencer_name` (string)
- `ad_match_pattern` (string)
- `ad_id` (string)
- `ad_name` (string)
- `start_date` (YYYY-MM-DD)
- `end_date` (YYYY-MM-DD)
- `new_end_date` (YYYY-MM-DD)
- `contract_status` (`Activo` | `Finalizado`)
- `notified_preventive` (boolean)
- `notification_channel` (`slack` | `telegram` | `both`)
- `run_mode` (`manual` | `scheduled`)
- `execution_status` (`success` | `partial_failure` | `failed`)

Mapeo con columnas actuales de Sheets:

- `contract_id` <-> `Contrato_ID`
- `influencer_name` <-> `Cliente`
- `ad_match_pattern` <-> `Regex_Anuncio`
- `start_date` <-> `Fecha_Alta`
- `end_date` <-> `Fecha_Fin`
- `contract_status` <-> `Status_Contrato`
- `notified_preventive` <-> `Notificado_Previo`

## 3. Reglas de validacion de negocio

- Fechas siempre en formato `YYYY-MM-DD`.
- `end_date` debe ser mayor a `start_date`.
- `new_end_date` debe ser mayor a la `end_date` actual del contrato.
- `contract_id` es unico al crear contrato.
- `ad_match_pattern` no puede ser vacio.
- Si se ejecuta pausa manual por ad, primero debe pasar pre-check de estado `ACTIVE`.
- Al pausar exitosamente un ad vencido, `contract_status` pasa a `Finalizado`.
- Retry para Meta ante `429` y `500`: 3 intentos.
- Timezone operativa fija: `America/Argentina/Buenos_Aires`.
- Canales permitidos para notificacion: `slack`, `telegram`, `both`.

## 4. Estado operativo real A2 (repo + runtime)

`LISTO` = implementado y verificable en el workflow versionado.
`PARCIAL` = implementado en repo, pero sin validacion end-to-end GREEN en runtime actual.
`NO` = no implementado.

| Endpoint | Estado A2 | Nota operativa |
|---|---|---|
| `POST /api/v1/contracts` | LISTO | Alta existente en F1. |
| `GET /api/v1/contracts` | PARCIAL | Sigue orientado a ventana `dias_proximos`; sin consulta global completa. |
| `PATCH /api/v1/contracts/{contract_id}/extend` | LISTO | Extension existente en F1 con reset preventiva. |
| `PATCH /api/v1/contracts/{contract_id}/finalize` | PARCIAL | `baja_manual` implementada en F1 repo; no validacion GREEN en runtime remoto. |
| `GET /api/v1/influencers/search?q=` | PARCIAL | Implementado en F1; validación local estática OK. |
| `GET /api/v1/contracts/{contract_id}/ads` | PARCIAL | `listar_ads` implementada en F1 repo; pendiente validacion runtime GREEN. |
| `POST /api/v1/ads/{ad_id}/pause` | PARCIAL | A2-P3: webhook acepta `pause_ad` (`execution_id` F1=919) y dispara F2 (`execution_id`=920) con precheck/pause ejecutados; falta GREEN manual por `Ad_ID` solicitado (el run actual proceso contrato vencido de scheduler). |
| `POST /api/v1/ads/pause-active` | PARCIAL | A2-P3: definido blueprint operativo batch (`dry_run` + `confirm_token` + `max_batch_size`); implementacion runtime pendiente. |
| `POST /api/v1/operations/run-now` | PARCIAL | Tracking/logica implementada en F1 repo; runtime remoto sigue devolviendo 400. |
| `GET /api/v1/operations/history` | PARCIAL | Consulta de `Operations_Log` implementada en F1 repo; pendiente validacion runtime GREEN. |

## 5. Endpoints MVP

### 4.1 Alta de contrato

- `POST /api/v1/contracts`

Request:

```json
{
  "contract_id": "C-1001",
  "influencer_name": "Farid Dieck",
  "ad_match_pattern": "farid.*promo",
  "start_date": "2026-04-13",
  "end_date": "2026-05-13",
  "ad_id": "1234567890",
  "ad_name": "Farid Promo Abril"
}
```

Response `201`:

```json
{
  "ok": true,
  "data": {
    "contract_id": "C-1001",
    "contract_status": "Activo"
  }
}
```

### 4.2 Consulta de contratos

- `GET /api/v1/contracts`
- Query params MVP: `days_ahead`, `contract_id`, `influencer_name`, `status`, `page`, `page_size`

Response `200`:

```json
{
  "ok": true,
  "data": {
    "total": 1,
    "items": [
      {
        "contract_id": "C-1001",
        "influencer_name": "Farid Dieck",
        "end_date": "2026-05-13",
        "contract_status": "Activo"
      }
    ]
  }
}
```

### 4.3 Extension de contrato

- `PATCH /api/v1/contracts/{contract_id}/extend`

Request:

```json
{
  "new_end_date": "2026-06-13",
  "reason": "Renovacion comercial"
}
```

Response `200`:

```json
{
  "ok": true,
  "data": {
    "contract_id": "C-1001",
    "end_date": "2026-06-13",
    "notified_preventive": false
  }
}
```

### 4.4 Baja manual de contrato

- `PATCH /api/v1/contracts/{contract_id}/finalize`

Request:

```json
{
  "reason": "Cierre manual por operacion",
  "requested_by": "ops@adskiller"
}
```

Response `200`:

```json
{
  "ok": true,
  "data": {
    "contract_id": "C-1001",
    "contract_status": "Finalizado"
  }
}
```

### 4.5 Busqueda de influencer con typo

- `GET /api/v1/influencers/search`
- Query params: `q` obligatorio, `limit` opcional (default `10`, max `20`)

Response `200`:

```json
{
  "ok": true,
  "action": "influencers_search",
  "query": "farit",
  "limit": 10,
  "total": 1,
  "items": [
    {
      "name": "Farid Dieck",
      "channel": "instagram",
      "score": 0.91
    }
  ]
}
```

### 4.6 Listar ads de un contrato

- `GET /api/v1/contracts/{contract_id}/ads`

Response `200`:

```json
{
  "ok": true,
  "data": {
    "contract_id": "C-1001",
    "items": [
      {
        "ad_id": "1234567890",
        "ad_name": "Farid Promo Abril",
        "ad_status": "ACTIVE"
      }
    ]
  }
}
```

### 4.7 Pausar ad individual (manual)

- `POST /api/v1/ads/{ad_id}/pause`

Request:

```json
{
  "contract_id": "C-1001",
  "reason": "Riesgo detectado",
  "requested_by": "ops@adskiller"
}
```

Response `200`:

```json
{
  "ok": true,
  "data": {
    "ad_id": "1234567890",
    "result": "paused",
    "precheck_status": "ACTIVE"
  }
}
```

### 4.8 Pausar todos los ads activos (batch)

- `POST /api/v1/ads/pause-active`

Request:

```json
{
  "contract_id": "C-1001",
  "dry_run": true,
  "max_batch_size": 25,
  "confirm_token": "",
  "requested_by": "ops@adskiller"
}
```

Response `200`:

```json
{
  "ok": true,
  "data": {
    "dry_run": true,
    "confirm_token": "pause-active:C-1001:2026-04-13T23:45:00Z",
    "max_batch_size": 25,
    "total_candidates": 15,
    "would_pause": 12,
    "next_step": "reenviar con dry_run=false + confirm_token"
  }
}
```

### 4.9 Run manual del kill-switch

- `POST /api/v1/operations/run-now`

Request:

```json
{
  "run_mode": "manual",
  "requested_by": "ops@adskiller"
}
```

Response `202`:

```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "tracking_id": "run-20260413-001"
  }
}
```

### 4.10 Historial operativo

- `GET /api/v1/operations/history`
- Query params MVP: `from`, `to`, `result`, `run_mode`, `execution_id`, `page`, `page_size`

Response `200`:

```json
{
  "ok": true,
  "data": {
    "total": 1,
    "items": [
      {
        "execution_id": "681",
        "correlation_id": "corr-flow3-cutover-001",
        "run_mode": "manual",
        "result": "SUCCESS",
        "contracts_evaluated": 120,
        "ads_paused": 8,
        "expired_found": 9,
        "errors": 1,
        "executed_at": "2026-04-12T23:00:00Z"
      }
    ]
  }
}
```

## 6. Criterio de versionado del contrato

- Version sugerida: `1.0.0` para este MVP A1.
- Cambios breaking (nombres de campos, payload obligatorio, codigos): subir major.
- Cambios compatibles (campos opcionales, nuevos filtros): subir minor.
