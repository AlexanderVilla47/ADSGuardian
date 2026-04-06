# QA Test Data — Integración E2E AdsKiller

## 1) Objetivo

Proveer dataset de prueba listo para validar de punta a punta la integración entre:

- UI management,
- daily kill-switch,
- ops reporting.

Todos los escenarios respetan timezone `America/Argentina/Buenos_Aires` y fechas estrictas `YYYY-MM-DD`.

---

## 2) Contratos de prueba (base)

> Fecha de referencia sugerida para ejecución QA: `2026-04-05`.

| contract_id | cliente | ad_account_id | Regex_Anuncio | fecha_inicio | fecha_fin | status_inicial | preventiva_48h | escenario objetivo |
|---|---|---|---|---|---|---|---|---|
| CTR-0001 | Cliente A | act_123456789 | `(?i).*promo.*abril.*a.*` | 2026-03-01 | 2026-04-04 | Vigente | false | Vencido pausable (happy path) |
| CTR-0002 | Cliente B | act_123456789 | `(?i).*promo.*abril.*b.*` | 2026-03-10 | 2026-04-04 | Vigente | false | Vencido con 500 persistente |
| CTR-0003 | Cliente C | act_456789123 | `(?i).*always\s*on.*` | 2026-03-15 | 2026-04-06 | Vigente | true | Extensión resetea preventiva |
| CTR-0004 | Cliente D | act_456789123 | `(?i).*black\s*friday.*` | 2026-03-12 | 2026-04-04 | Vigente | false | Meta 429 recuperado |
| CTR-0005 | Cliente E | act_456789123 | `(?i).*archived.*ad.*` | 2026-03-20 | 2026-04-04 | Vigente | false | Ad no ACTIVE (skip esperado) |
| CTR-0006 | Cliente F | act_999888777 | `(?i).*no\s*match.*` | 2026-03-21 | 2026-04-04 | Vigente | false | Regex sin match |
| CTR-0007 | Cliente G | act_999888777 | `(?i).*token.*expire.*` | 2026-03-05 | 2026-04-04 | Vigente | false | Token expirado (401/403) |
| CTR-0008 | Cliente H | act_999888777 | `(?i).*canal.*report.*` | 2026-03-18 | 2026-04-04 | Vigente | false | Canal reporting caído |

---

## 3) Inventario de anuncios mock para matching

| ad_id | ad_account_id | ad_name | meta_status_inicial | contrato esperado |
|---|---|---|---|---|
| 120000000001 | act_123456789 | Promo Abril - Producto A | ACTIVE | CTR-0001 |
| 120000000002 | act_123456789 | Promo Abril - Producto B | ACTIVE | CTR-0002 |
| 120000000003 | act_456789123 | Always On Lead Gen | ACTIVE | CTR-0003 |
| 120000000004 | act_456789123 | Black Friday Teaser | ACTIVE | CTR-0004 |
| 120000000005 | act_456789123 | Archived Ad Test | PAUSED | CTR-0005 |
| 120000000006 | act_999888777 | Prospecting Evergreen | ACTIVE | Ninguno (CTR-0006 no matchea) |
| 120000000007 | act_999888777 | Token Expire Campaign | ACTIVE | CTR-0007 |
| 120000000008 | act_999888777 | Canal Report Stress | ACTIVE | CTR-0008 |

---

## 4) Fixtures por escenario E2E

### Escenario A — Happy path completo

- Contrato: `CTR-0001`
- Meta pause response: `200`
- Esperado:
  - ad pasa a `PAUSED`,
  - `Status_Contrato -> Finalizado`,
  - reporting `severity=INFO`.

### Escenario B — Retry 429 recuperado

- Contrato: `CTR-0004`
- Respuestas Meta por intento: `429`, `429`, `200`
- Esperado:
  - pausa exitosa en intento 3,
  - `retry_429_count=2`,
  - `severity=WARN`.

### Escenario C — Retry 500 agotado

- Contrato: `CTR-0002`
- Respuestas Meta por intento: `500`, `500`, `500`
- Esperado:
  - anuncio vencido no pausado,
  - `total_ads_pause_failed>=1`,
  - alerta `CRITICAL`.

### Escenario D — Token expirado

- Contrato: `CTR-0007`
- Respuesta Meta: `401` (o `403`)
- Esperado:
  - error auth clasificado,
  - sin retry ciego de 3x/5m,
  - severidad `ERROR` (o `CRITICAL` si queda vencido sin pausar).

### Escenario E — Canal reporting caído

- Contrato: `CTR-0008`
- Kill-switch finaliza, reporting endpoint devuelve `503`.
- Esperado:
  - payload retenido para reproceso,
  - incidente operativo abierto,
  - ejecución no se pierde (trazabilidad por `execution_id`).

### Escenario F — Ad no ACTIVE

- Contrato: `CTR-0005`
- Estado inicial ad: `PAUSED`
- Esperado:
  - no intenta pausa,
  - resultado `skipped_non_active`,
  - severidad `WARN`.

### Escenario G — Regex sin match

- Contrato: `CTR-0006`
- `Regex_Anuncio`: `(?i).*no\s*match.*`
- Esperado:
  - resultado `no_match`,
  - contrato auditado pero sin acción,
  - severidad `WARN`.

### Escenario H — Extensión resetea preventiva

- Contrato: `CTR-0003`
- Estado inicial: preventiva_48h `true`
- Acción: extensión `fecha_fin` de `2026-04-06` -> `2026-04-20`
- Esperado:
  - preventiva_48h vuelve a `false`,
  - contrato permanece `Vigente`,
  - nueva ventana preventiva habilitada.

---

## 5) Casos de validación de formato de fecha

| input_fecha | válido | motivo |
|---|---|---|
| `2026-04-05` | Sí | Cumple `YYYY-MM-DD` |
| `2026/04/05` | No | Separador inválido |
| `05-04-2026` | No | Orden inválido |
| `2026-4-5` | No | Zero-padding faltante |
| `2026-13-01` | No | Mes inválido |

---

## 6) Payload esperado mínimo para assertions QA

Campos obligatorios a verificar en cada ejecución:

- `correlation_id` (UUID no vacío)
- `execution.execution_id`
- `execution.run_type` (`scheduled` o `manual_forced`)
- `severity`
- `metrics.total_contracts_evaluated`
- `metrics.total_ads_expired`
- `metrics.total_ads_paused_success`
- `metrics.total_ads_pause_failed`
- `metrics.retry_429_count`
- `metrics.retry_500_count`

Referencia de estructura: `workflows/_integration-payload-contract.json`.

---

## 7) Orden recomendado de ejecución QA E2E

1. Alta + consulta (`CTR-0001`, `CTR-0003`).
2. Extensión y reset preventiva (`CTR-0003`).
3. Corrida kill-switch programada (happy + 429 + no ACTIVE + no_match).
4. Corrida manual forzada (validar trazabilidad de run_type).
5. Inyectar errores controlados (500 persistente, token expirado, reporting caído).
6. Confirmar emisión de alerta crítica por vencido no pausado.
