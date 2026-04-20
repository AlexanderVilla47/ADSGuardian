# Plan integral de robustecimiento AdsKiller backend-first + migración gradual a Supabase

Fecha base: 2026-04-19  
Estado: plan aprobado para futura implementación  
Fuente complementaria persistida: Engram (`architecture/backend-first-supabase-migration-plan`)

---

## 1) Resumen ejecutivo

AdsKiller debe evolucionar desde un MVP apoyado en Google Sheets hacia un backend más robusto, integrable dentro de un sistema corporativo mayor, sin romper el contrato actual de F1 y sin perder la capacidad de testeo determinístico.

### Decisiones cerradas

- **Superficie externa**: mantener **F1 v1** como contrato estable.
- **Estrategia de migración**: **shadow + dual-write**.
- **Seguridad inicial**: despliegue por **red interna + seam de auth** para agregar política corporativa después sin rediseñar F1.
- **Orden de migración**: primero observabilidad/tracking en Supabase, después contratos.

### Objetivo final

Llegar a una arquitectura donde:

- **F1** sea la façade/API estable consumida por el sistema corporativo.
- **F2** sea el worker de negocio / kill-switch.
- **F3** sea la capa de alerting y auditoría.
- **Supabase** sea el system of record.
- **Sheets** salga del camino crítico.
- El protocolo de testeo determinístico de AdsKiller siga siendo la fuente oficial de veredicto.

---

## 2) Hallazgos de exploración que fundamentan el plan

- El front standalone **no será** la superficie productiva; la integración real será contra los endpoints actuales de **F1**.
- Los workflows canónicos actuales son:
  - **F1** `contract-ui-management-v2`
  - **F2** `contract-guard-daily-killswitch`
  - **F3** `ops-reporting-alerts`
- La mayor fragilidad actual está en **persistencia/configuración**:
  - dependencia fuerte en Google Sheets,
  - credenciales runtime frágiles,
  - historial / tracking / alerts acoplados al store actual,
  - evidencia en `test.json` de errores por auth, env vars, hojas faltantes y drift operativo.
- No hay implementación real previa de Supabase en el repo; la migración debe tratarse como **nuevo diseño controlado**, no como simple reemplazo mecánico.
- El proyecto ya tiene una disciplina fuerte de:
  - release gates,
  - rollback,
  - smoke tests,
  - testing determinístico por `execution_id`.

---

## 3) Arquitectura objetivo

### 3.1 Componentes

#### F1 — API façade

Responsabilidades:

- recibir requests del sistema corporativo,
- validar contrato,
- normalizar payload,
- generar `correlation_id` y `tracking_id`,
- persistir intención/estado mínimo,
- disparar F2 cuando corresponda,
- responder con semántica estable y trazable.

#### F2 — Worker de negocio

Responsabilidades:

- evaluar contratos,
- ejecutar lógica de pre-check / pause / retries,
- leer y actualizar estado de negocio,
- emitir resultados normalizados.

#### F3 — Alerting / auditoría

Responsabilidades:

- consumir resultados/eventos,
- emitir notificaciones,
- registrar alertas y eventos operativos.

#### Supabase — Source of truth futuro

Uso final:

- contratos,
- tracking de operaciones,
- historial,
- alertas,
- auditoría,
- idempotencia.

#### Google Sheets — Infraestructura transicional

Uso durante migración:

- store legacy,
- comparación de paridad,
- fallback temporal,
- eventual retiro del camino crítico.

---

## 4) Contrato externo F1 v1

### 4.1 Regla principal

El contrato actual de F1 se trata como **API pública estable** para integración corporativa.

No se debe romper sin estrategia explícita de compatibilidad.

### 4.2 Acciones incluidas

- `alta`
- `consulta`
- `extension`
- `baja_manual`
- `listar_ads`
- `pause_ad`
- `run_now`
- `history`
- `history_alerts`
- `status_by_tracking`
- `pause_active` / preview-confirm si sigue vigente

### 4.3 Invariantes del contrato

- Toda respuesta debe incluir trazabilidad mínima:
  - `meta.correlation_id`
  - `meta.execution_id` cuando aplique
- Se congela una semántica única de estados:
  - `accepted`
  - `queued`
  - `processing`
  - `success`
  - `failed`
  - `not_found`
- Los cambios internos de F1/F2/F3 no deben cambiar la semántica visible de request/response.

### 4.4 Seam de auth futura

Aunque al inicio no se aplique auth corporativa fuerte:

- F1 debe quedar preparado para headers reservados, por ejemplo:
  - `X-AK-Client`
  - `X-AK-Timestamp`
  - `X-AK-Signature`
- La validación puede comenzar en modo `warn/no-enforce`.
- El diseño debe permitir agregar luego:
  - API key,
  - firma HMAC,
  - o el esquema que defina la empresa,
  sin rediseñar el contrato v1.

### 4.5 Idempotencia

Las acciones mutantes deben quedar diseñadas para soportar `idempotency_key` estable:

- `alta`
- `extension`
- `baja_manual`
- `pause_ad`
- `run_now`
- `pause_active`

La clave debe representar la **operación de negocio**, no el intento técnico.

---

## 5) Diseño de persistencia en Supabase

## 5.1 Tablas mínimas

### `contracts`

Debe contener:

- `contract_id` único
- datos del contrato
- fechas de negocio
- estado del contrato
- flags operativos (`notificado_previo`, etc.)
- timestamps consistentes

### `operation_tracking`

Debe contener:

- `tracking_id` único
- `correlation_id`
- `action`
- `status`
- `result`
- `source_workflow`
- resumen de estado
- timestamps de transición

### `operations_log`

Debe contener:

- `execution_id`
- `tracking_id`
- `correlation_id`
- `action`
- `status`
- `severity`
- `source_workflow`
- `timestamp`

### `alerts`

Debe contener:

- `alert_id`
- `severity`
- `event_type`
- `contract_id`
- `ad_id`
- `correlation_id`
- `execution_id`
- `status`
- `created_at`

### `idempotency_keys`

Debe contener:

- `idempotency_key`
- `action`
- `request_fingerprint`
- `result_reference`
- `created_at`
- política de expiración / TTL

## 5.2 Reglas de diseño

- `contract_id`, `tracking_id`, `alert_id` e `idempotency_key` con constraints reales.
- `correlation_id` indexado en tablas operativas.
- Escrituras desde n8n con service role acotado.
- No depender de secretos hardcodeados ni configuración difusa.
- Diseñar desde el inicio compatibilidad con RLS, aunque su enforcement pueda activarse después.

---

## 6) Plan por fases

## Fase 0 — Exploración profunda, baseline y congelamiento del contrato

### Objetivo

Definir exactamente qué no se puede romper.

### Trabajo

- inventariar request/response reales de F1 por acción;
- congelar DTOs, códigos HTTP y estados visibles;
- identificar qué es contrato público y qué es detalle interno;
- versionar fixtures y payloads canónicos de prueba;
- baselinear:
  - historial,
  - tracking,
  - alerts,
  - operaciones manuales,
  - smoke actual.

### Entregables

- documento de contrato v1;
- matriz de acciones F1 con ejemplos válidos/inválidos;
- baseline de evidencia en `test.json` y artefactos asociados.

### Gate de salida

- cada acción tiene payload válido, inválido y respuesta esperada;
- smoke actual documentada como baseline.

### Rollback

No aplica funcionalmente; es fase de preparación.

---

## Fase 1 — Endurecer F1 como backend estable

### Objetivo

Volver F1 una façade mantenible y estable para integración.

### Trabajo

- separar conceptualmente:
  - validación,
  - normalización,
  - lógica de dispatch,
  - tracking;
- normalizar semántica de estados;
- preparar seam de auth;
- diseñar e introducir idempotencia;
- asegurar propagación consistente de:
  - `correlation_id`,
  - `tracking_id`,
  - `execution_id`;
- eliminar hardcodeos sensibles en superficie productiva.

### Gate de salida

- contrato v1 intacto;
- estados/meta normalizados;
- auth futura enchufable;
- sin secretos hardcodeados.

### Rollback

- restaurar baseline anterior de F1;
- revalidar smoke de F1 y tracking.

---

## Fase 2 — Introducir Supabase primero en observabilidad y tracking

### Objetivo

Meter Supabase donde menos riesgo funcional agrega y más valor devuelve.

### Trabajo

- crear tablas:
  - `operations_log`
  - `alerts`
  - `operation_tracking`
- hacer que F3 persista alertas/eventos en Supabase;
- hacer que F1/F2/F3 produzcan eventos operativos consistentes hacia Supabase;
- migrar:
  - `history`
  - `history_alerts`
  - `status_by_tracking`
  para leer desde Supabase;
- mantener Sheets como source of truth de contratos.

### Gate de salida

- historial/tracking/alertas funcionando contra Supabase;
- equivalencia funcional con el baseline;
- trazabilidad reforzada.

### Rollback

- volver lecturas de historial/tracking a Sheets;
- dejar Supabase como sink shadow si es necesario.

---

## Fase 3 — Dual-write de contratos

### Objetivo

Poblar Supabase como futura fuente de verdad sin cortar operación.

### Trabajo

- `alta`: escribir en Sheets + Supabase;
- `extension`: actualizar en Sheets + Supabase;
- `baja_manual`: actualizar en Sheets + Supabase;
- si aplica, persistir metadata contractual de operaciones manuales en Supabase;
- introducir reconciliación:
  - existencia,
  - estado,
  - fechas,
  - flags críticos,
  - timestamps.

### Gate de salida

- paridad 100% en campos críticos para casos testeados;
- sin divergencias silenciosas;
- dual-write validada con evidencia determinística.

### Rollback

- apagar escritura a Supabase;
- seguir solo con Sheets;
- conservar Supabase como shadow data no operativa.

---

## Fase 4 — Mover lecturas operativas a Supabase

### Objetivo

Hacer de Supabase el motor real de lectura.

### Trabajo

- mover lecturas de contratos en F1:
  - `consulta`
  - `listar_ads` si corresponde
  - lookups contractuales;
- luego mover lecturas de F2:
  - contratos activos,
  - flags operativos,
  - inputs del kill-switch;
- usar feature flags de lectura.

### Gate de salida

- mismos resultados funcionales;
- sin cambio de contrato externo;
- latencia y consistencia aceptables.

### Rollback

- apagar flags de lectura Supabase;
- volver lecturas a Sheets.

---

## Fase 5 — Idempotencia efectiva + seguridad corporativa enchufable

### Objetivo

Cerrar huecos importantes antes del cutover final.

### Trabajo

- activar tabla y enforcement de `idempotency_keys`;
- definir respuesta ante duplicados;
- dejar auth corporativa enchufable;
- mantener `network-only` como fallback operativo si la política corporativa final aún no está definida.

### Gate de salida

- duplicados sin doble efecto;
- soporte de headers de auth probado;
- contrato v1 sin cambios.

### Rollback

- desactivar enforcement de idempotencia/auth;
- mantener estructura lista para reactivar.

---

## Fase 6 — Cutover final a Supabase

### Objetivo

Volver Supabase el source of truth definitivo.

### Trabajo

- F1 escribe contratos solo en Supabase;
- F2 lee estado/contratos solo desde Supabase;
- F3 registra eventos/alerts solo en Supabase;
- Sheets sale del camino crítico;
- definir política final de retiro o uso residual de Sheets.

### Gate de salida

- smoke end-to-end GREEN;
- regresión crítica GREEN;
- sin dependencias runtime críticas de Sheets.

### Rollback

- volver al último punto verde:
  - dual-write,
  - o lectura Sheets,
  según fase previa aprobada.

---

## 7) Estrategia de testing y validación

## 7.1 Principios

- Mantener el protocolo determinístico AdsKiller:
  - `Prepare`
  - `Run One`
  - `Read Evidence`
  - `Cleanup`
- No mezclar evidencia histórica.
- El veredicto siempre se toma con la **última `execution_id` post-cambio**.

## 7.2 Capas de test

### A. Contract tests de F1

Por acción:

- payload válido;
- payload inválido;
- shape esperada;
- código HTTP esperado;
- presencia de `correlation_id` y `execution_id` cuando corresponda.

### B. Functional tests de negocio

- `alta`
- `consulta`
- `extension`
- `baja_manual`
- `listar_ads`
- `pause_ad`
- `run_now`
- `status_by_tracking`
- `history`
- `history_alerts`

### C. Parity tests Sheets vs Supabase

Mientras convivan ambos stores:

- comparar writes;
- comparar reads;
- comparar campos críticos;
- bloquear promoción si no hay paridad.

### D. Non-functional tests

- retries `429/500`;
- no retry ciego en `400/401/403`;
- latencia razonable;
- preservación de `correlation_id`;
- preservación de `tracking_id`;
- consistencia de estados transitorios/finales.

### E. Regression suite por fase

Antes de cerrar cada fase:

- smoke mínima;
- casos críticos;
- rollback test de la fase.

---

## 8) Matriz mínima de escenarios a conservar

## 8.1 F1

- `alta` happy path
- `alta` duplicada / idempotente
- `consulta` con resultados
- `consulta` sin resultados
- `extension` válida
- `extension` inexistente
- `baja_manual` válida
- `listar_ads`
- `pause_ad` válido
- `pause_ad` inválido
- `run_now`
- `history`
- `status_by_tracking`
- request inválida -> `ValidationError`

## 8.2 F2

- contrato activo no vencido -> no acción
- preventiva 48h única
- vencido + ACTIVE -> pausa
- `429` recuperado
- `500` recuperado
- `429/500` agotado -> alerta crítica
- `401/403` -> no retry ciego
- regex mismatch
- postcheck no `PAUSED`

## 8.3 F3

- INFO
- WARN
- CRITICAL
- canal no soportado
- falla de envío
- persistencia de alerta/evento
- ausencia de secretos hardcodeados

## 8.4 Migración

- dual-write consistente
- lecturas Supabase equivalentes
- rollback de fase recupera el comportamiento anterior

---

## 9) Rollout operativo

### Feature flags sugeridos

- lectura Supabase on/off
- dual-write on/off
- idempotency enforcement on/off
- auth enforcement on/off

### Regla de promoción

No avanzar de fase sin:

- evidencia determinística;
- rollback probado;
- smoke verde;
- paridad verde si aplica.

### Observabilidad mínima obligatoria

Todo evento operativo debe conservar:

- `correlation_id`
- `tracking_id` si existe
- `execution_id`
- `source_workflow`
- `status`
- `timestamp`

---

## 10) Supuestos y defaults elegidos

- El sistema corporativo consumirá **los endpoints actuales de F1**.
- La auth corporativa final **no** se implementa todavía, pero F1 debe quedar preparado.
- La migración será **gradual**, con **shadow + dual-write**.
- Supabase entra **primero** para observabilidad/tracking y **después** para contratos.
- El protocolo de testeo determinístico actual sigue siendo el mecanismo oficial de validación.
- Sheets no se retira hasta pasar:
  - dual-write,
  - parity,
  - reads,
  - smoke end-to-end,
  - rollback probado.

---

## 11) Próximo uso esperado de este documento

Cuando se pida implementar este plan, usar este documento como fuente de verdad para:

1. abrir un roadmap por fases;
2. convertir cada fase en tickets ejecutables;
3. implementar y validar con evidencia determinística;
4. no romper el contrato F1 v1 durante la transición.
