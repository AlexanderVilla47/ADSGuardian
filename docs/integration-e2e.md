# Integración E2E MVP — UI Management + Daily Kill-Switch + Ops Reporting

## 1) Objetivo

Definir la capa de integración end-to-end (E2E) para conectar los 3 workflows MVP de AdsKiller sin merge entre ramas feature, dejando:

- arquitectura operativa integrada,
- contrato técnico de payload compartido,
- secuencia de operación de punta a punta,
- matriz de pruebas E2E ejecutable por QA/Operación,
- checklist de go-live y runbook de incidentes.

---

## 2) Arquitectura de integración entre workflows

### 2.1 Workflows involucrados

1. **UI Management** (`contract-ui-management`)
   - Alta, consulta y extensión de contratos.
   - Valida formato de fecha estricto `YYYY-MM-DD`.
   - Resetea bandera preventiva de 48h cuando hay extensión.

2. **Daily Kill-Switch** (`contract-guard-daily-killswitch`)
   - Trigger schedule (diario) y trigger manual forzado.
   - Evalúa vencimientos con timezone `America/Argentina/Buenos_Aires`.
   - Pre-checkea estado `ACTIVE` antes de pausar en Meta Ads.
   - Aplica retry para `429`/`500`: 3 intentos con 5 minutos.

3. **Ops Reporting** (`ops-reporting-alerts`)
   - Recibe resultados de ejecución del kill-switch.
   - Emite reporte operacional y alerta crítica si quedó vencido sin pausar.
   - Expone trazabilidad por `correlation_id`.

### 2.2 Patrón de integración

Patrón principal: **Schedule → Fetch → Process → Deliver → Log** con integración HTTP/API y observabilidad.

```text
UI Management ──(contratos + extensiones)──> Contratos vigentes
                                                │
                                                ▼
                           Daily Kill-Switch (schedule/manual)
                          ├─ Evalúa vigencia + regex matching
                          ├─ Pre-check ACTIVE
                          ├─ Pause en Meta (retry 3x/5m en 429/500)
                          └─ Genera payload canónico E2E
                                                │
                                                ▼
                            Ops Reporting + Alerting operativo
                          ├─ Reporte por ejecución
                          └─ Alerta CRITICAL si hay vencido no pausado
```

### 2.3 Principios de diseño de integración

- **Contrato único canónico** entre kill-switch y reporting (evita drift entre ramas).
- **Correlación end-to-end** con `correlation_id` estable por ejecución.
- **Idempotencia operacional** por `execution_id` + `run_type` + `contract_id`.
- **Clasificación de severidad** para operación: `INFO | WARN | ERROR | CRITICAL`.
- **Métricas mínimas obligatorias** en cada ejecución para monitoreo y auditoría.

### 2.4 Cadena interna `Execute Workflow` (producción)

Se establece como ruta interna primaria para producción:

```text
F1 contract-ui-management-v2 (cFBr6GavlSWDsUFz)
  -> Execute Workflow interno
F2 contract-guard-daily-killswitch (8mlwAxLtJVrwpLhi)
  -> Execute Workflow interno
F3 ops-reporting-alerts (BFHHQwYFfmcpqshb)
```

Reglas operativas de esta cadena:

- F1 construye payload canónico y propaga `correlation_id` + `logical_execution_id` para idempotencia básica.
- F2 normaliza resumen canónico de resultado antes de disparar F3.
- F2 y F3 mantienen triggers actuales (manual/scheduler/webhook) como fallback operativo.
- Errores de encadenamiento interno se registran en logs estructurados con `correlation_id`, `logical_execution_id`, `source_workflow`, `target_workflow_id`, `status` y `timestamp`.

---

## 3) Contrato de payload compartido (kill-switch -> reporting)

### Esquema canónico vigente

Nombres canónicos obligatorios para contratos en MVP (hard cut, sin aliases):

- `Contrato_ID`
- `Fecha_Fin`
- `Regex_Anuncio`

Campos que se mantienen vigentes:

- `Influencer_Name`
- `Canal_Notificacion`
- `Status_Contrato`
- `Notificado_Previo`

### 3.1 Estructura top-level

```json
{
  "schema_version": "1.0.0",
  "event_type": "killswitch.execution.summary",
  "event_timestamp": "2026-04-05T09:15:30-03:00",
  "timezone": "America/Argentina/Buenos_Aires",
  "environment": "dev|staging|prod",
  "correlation_id": "uuid-v4",
  "execution": {},
  "severity": "INFO|WARN|ERROR|CRITICAL",
  "metrics": {},
  "results": [],
  "errors": []
}
```

### 3.2 Campos obligatorios

| Campo | Tipo | Requerido | Regla |
|---|---|---:|---|
| `schema_version` | string | Sí | Versionado del contrato (`semver`). |
| `event_type` | string | Sí | `killswitch.execution.summary`. |
| `event_timestamp` | string (ISO-8601) | Sí | Timestamp con offset horario `-03:00`. |
| `timezone` | string | Sí | Debe ser `America/Argentina/Buenos_Aires`. |
| `correlation_id` | string | Sí | UUID por ejecución, propagado en toda integración. |
| `execution.execution_id` | string | Sí | ID único de corrida (schedule/manual). |
| `execution.run_type` | string | Sí | `scheduled` o `manual_forced`. |
| `execution.status` | string | Sí | `success`, `partial_failure`, `failed`. |
| `severity` | string | Sí | Derivada de impacto operativo. |
| `metrics.total_contracts_evaluated` | number | Sí | Total evaluados en corrida. |
| `metrics.total_ads_expired` | number | Sí | Ads vencidos detectados. |
| `metrics.total_ads_paused_success` | number | Sí | Ads pausados OK. |
| `metrics.total_ads_pause_failed` | number | Sí | Ads no pausados por error. |
| `metrics.retry_429_count` | number | Sí | Reintentos por rate-limit. |
| `metrics.retry_500_count` | number | Sí | Reintentos por error servidor. |
| `results[]` | array | Sí | Resultado por contrato/ad objetivo. |

### 3.3 Reglas de severidad

- `INFO`: corrida exitosa sin fallos.
- `WARN`: hubo retries recuperados sin impacto final.
- `ERROR`: fallos parciales (quedaron items sin resolver en ejecución).
- `CRITICAL`: al menos un anuncio vencido quedó sin pausar.

### 3.4 Reglas de métricas mínimas

Reporting debe poder calcular sin ambigüedad:

- tasa de éxito de pausa,
- cantidad de retries por tipo (`429` vs `500`),
- latencia de ejecución (`duration_ms`),
- backlog de vencidos no pausados.

---

## 4) Secuencia operacional E2E

1. **Alta de contrato (UI Management)**
   - Operación carga contrato con fechas `YYYY-MM-DD` y `Regex_Anuncio`.
   - Se persiste estado inicial (`Vigente`, preventiva `false`).

2. **Consulta de contrato (UI Management)**
   - Operación verifica que contrato quedó consistente y rastreable.

3. **Extensión de contrato (UI Management)**
   - Se actualiza nueva vigencia.
   - Se resetea bandera preventiva de 48h para permitir nuevo ciclo preventivo.

4. **Corrida kill-switch (schedule/manual)**
   - Evalúa contratos por fecha en timezone `America/Argentina/Buenos_Aires`.
   - Resuelve matching por regex case-insensitive sobre nombre de Ad.
   - Pre-check: solo intenta pausar si Meta reporta `ACTIVE`.
   - Si Meta responde `429/500`, aplica política 3 intentos con 5 minutos.
   - Si pausa exitosa: `Status_Contrato -> Finalizado`.

5. **Reporte operacional (Ops Reporting)**
   - Consume payload canónico del kill-switch.
   - Publica resumen (éxito/parcial/error), métricas y alertas.
   - Si queda vencido no pausado: emite alerta `CRITICAL` + runbook.

---

## 5) Matriz de pruebas E2E (mínimo 12 casos)

| ID | Escenario | Entrada clave | Resultado esperado | Severidad esperada |
|---|---|---|---|---|
| E2E-01 | Happy path completo | Contrato vencido + Ad ACTIVE + pausa 200 | Ad pausado, contrato `Finalizado`, reporte exitoso | INFO |
| E2E-02 | Alta + consulta consistentes | Alta válida + consulta inmediata | Datos consistentes entre UI y fuente de kill-switch | INFO |
| E2E-03 | Extensión resetea preventiva | Contrato con preventiva disparada + extensión | Preventiva vuelve a `false` y puede disparar nuevo ciclo 48h | INFO |
| E2E-04 | Ad no ACTIVE | Contrato vencido + Ad PAUSED/ARCHIVED | No intenta pausa, resultado marcado como `skipped_non_active` | WARN |
| E2E-05 | Regex no matchea | `Regex_Anuncio` sin coincidencia | Contrato evaluado sin objetivo; se registra `no_match` | WARN |
| E2E-06 | Meta 429 recuperado | Respuesta 429 en intento 1/2 y 200 en 3 | Retry aplicado, pausa exitosa, métrica `retry_429_count` > 0 | WARN |
| E2E-07 | Meta 500 recuperado | Respuesta 500 en intento 1 y 200 en 2 | Retry aplicado, pausa exitosa, `retry_500_count` > 0 | WARN |
| E2E-08 | Meta 429/500 no recuperado | 3 intentos fallidos | Ad vencido no pausado, contrato no finaliza, alerta crítica | CRITICAL |
| E2E-09 | Token expirado Meta | 401/403 por credencial vencida | Sin retry ciego, error clasificado auth, alerta operativa | ERROR/CRITICAL* |
| E2E-10 | Canal reporting caído | Kill-switch OK + endpoint reporting no disponible | Se conserva resultado para reproceso; incidente abierto | ERROR |
| E2E-11 | Fecha inválida en UI | `2026/04/05` o `05-04-2026` | Rechazo en alta/extensión por contrato inválido | ERROR |
| E2E-12 | Trigger manual forzado | Ejecución manual con contratos activos | Corrida registrada con `run_type=manual_forced` y trazabilidad completa | INFO |
| E2E-13 | Vencido no pausado explícito | Simular error permanente de pausa | Alerta `CRITICAL` con `correlation_id` y runbook | CRITICAL |
| E2E-14 | Duplicado de ejecución | Reenvío mismo `execution_id` | Reporting deduplica/ignora duplicado sin inflar métricas | WARN |

\* Si hay anuncios vencidos sin pausar por token expirado, la severidad final debe escalar a `CRITICAL`.

---

## 6) Checklist de go-live E2E

### 6.1 Integración y contrato

- [ ] Contrato canónico validado contra `workflows/_integration-payload-contract.json`.
- [ ] `correlation_id` propagado en UI -> kill-switch -> reporting.
- [ ] `schema_version` y `event_type` versionados y documentados.

### 6.2 Calidad operativa

- [ ] Matriz E2E ejecutada (mínimo 12 casos) con evidencias.
- [ ] Casos de resiliencia `429/500` verificados con política 3x/5m.
- [ ] Caso de token expirado validado (sin retry ciego en 401/403).
- [ ] Caso de canal reporting caído validado con procedimiento de reproceso.

### 6.3 Observabilidad

- [ ] Logs estructurados con `workflow`, `execution_id`, `correlation_id`, `severity`.
- [ ] Métricas mínimas publicadas: éxito/error/latencia/retries/backlog vencidos.
- [ ] Alerta CRITICAL configurada para “vencido no pausado”.

### 6.4 Operación

- [ ] Runbook de incidentes distribuido al equipo de guardia.
- [ ] Trigger manual probado y trazado.
- [ ] Responsables on-call y escalamiento definidos.

---

## 7) Runbook de incidentes E2E

### Incidente A — `429` sostenido en Meta

1. Confirmar incremento de `retry_429_count`.
2. Verificar límites de cuota y ventana horaria.
3. Reintentar corrida manual fuera de pico.
4. Si persiste y hay vencidos sin pausar: escalar `CRITICAL`.

### Incidente B — `500` sostenido en Meta

1. Confirmar falla proveedor (`retry_500_count`, latencia anómala).
2. Ejecutar nueva corrida manual.
3. Mantener monitoreo de backlog de vencidos.
4. Escalar si no se recupera dentro de la ventana operativa.

### Incidente C — Token expirado / auth inválida

1. Identificar `401/403` en ejecución correlacionada.
2. Renovar/rotar credencial según política interna.
3. Re-ejecutar kill-switch manual.
4. Verificar normalización de métricas y cierre de incidente.

### Incidente D — Canal reporting caído

1. Confirmar indisponibilidad de endpoint/canal.
2. Guardar payload de salida para reproceso diferido.
3. Restablecer canal y reprocesar backlog por `execution_id`.
4. Validar deduplicación para evitar doble reporte.

### Incidente E — Vencido no pausado

1. Priorizar resolución del ad afectado (impacto negocio).
2. Revisar causa raíz: estado no ACTIVE, auth, rate-limit, error permanente.
3. Ejecutar mitigación manual inmediata.
4. Documentar RCA y acción preventiva para evitar recurrencia.

---

## 8) Criterio de salida de esta fase de integración

La capa E2E queda lista para integración de ramas cuando:

- contrato canónico está adoptado por kill-switch y reporting,
- secuencia operacional completa fue validada con evidencia,
- alerta crítica por vencido no pausado está activa,
- runbook y checklist de go-live están aprobados por operación.
