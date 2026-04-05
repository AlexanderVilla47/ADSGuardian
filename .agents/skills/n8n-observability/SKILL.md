---
name: n8n-observability
description: Estándar de observabilidad para workflows n8n con correlation IDs, trazabilidad end-to-end, métricas operativas, SLO y alerting accionable. Trigger: usar cuando se diseña, opera o depura workflows n8n en entornos productivos.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# n8n Observability

## Propósito

Hacer que cada workflow n8n sea **observable y operable**: que puedas responder rápido qué pasó, por qué pasó, cuánto impacta y qué acción tomar.

Pilares:
- **Logs estructurados** con contexto útil.
- **Tracing lógico** por ejecución y por integración.
- **Métricas** de salud (éxito/error/latencia/colas/reintentos).
- **Alertas** con señal alta (sin spam).

## Cuándo usar

Usá esta skill cuando:
- Un flujo es crítico para negocio y requiere SLA/SLO.
- Hay múltiples sistemas (API, DB, ERP, mensajería) y trazabilidad compleja.
- Necesitás detectar degradación antes de que escale.
- Querés reducir MTTR (tiempo de resolución de incidentes).

## Qué NO hacer

- NO loguear secretos, tokens ni payloads sensibles en claro.
- NO generar logs sin contexto (`workflow`, `node`, `execution`, `correlation_id`).
- NO crear alertas por cada error aislado (genera fatiga).
- NO depender solo de “ver ejecuciones manualmente” como estrategia operativa.
- NO mezclar errores de negocio con errores técnicos sin clasificación.

## Pasos operativos

### 1) Estándar de correlación y contexto

1. Generar o propagar `correlation_id` desde el trigger.
2. Mantenerlo en todo el flujo (headers, payload interno, metadata).
3. Adjuntar contexto mínimo en logs/eventos:
   - `workflow_name`, `workflow_id`
   - `execution_id`
   - `node_name`
   - `integration_target`
   - `correlation_id`

### 2) Logging estructurado

1. Definir formato JSON consistente para eventos operativos.
2. Niveles recomendados:
   - `INFO`: hitos relevantes (inicio/fin, reintento, fallback).
   - `WARN`: degradación controlada (retry, timeouts recuperados).
   - `ERROR`: fallo no recuperable o impacto de negocio.
3. Redactar mensajes con acción sugerida (no solo síntoma).

### 3) Métricas base por workflow

Métricas mínimas:
- `execution_success_total`
- `execution_error_total`
- `execution_duration_ms`
- `retry_count_total`
- `external_api_latency_ms`
- `external_api_429_total`

Segmentación recomendada:
- por entorno (`dev/staging/prod`),
- por integración,
- por tipo de error (transitorio/permanente/contrato).

### 4) SLO y umbrales

1. Definir SLO por flujo crítico (ej. éxito >= 99.5%, p95 latencia <= X).
2. Configurar umbrales con ventana temporal (evitar alertas por ruido).
3. Diseñar runbook mínimo por alerta: causa probable + pasos de mitigación.

### 5) Alerting accionable

1. Alertar por condiciones compuestas:
   - error rate sostenido,
   - latencia p95 degradada,
   - aumento de retries/429,
   - backlog fuera de umbral.
2. Incluir en alerta:
   - workflow,
   - severidad,
   - `correlation_id` ejemplo,
   - enlace a ejecución/runbook.

## Criterios de salida

La observabilidad está bien implementada cuando:
- Todo flujo crítico propaga `correlation_id` end-to-end.
- Logs estructurados permiten reconstruir una ejecución completa.
- Métricas base están disponibles y segmentadas por entorno.
- Existe al menos un SLO por flujo crítico con alertas calibradas.
- Alertas entregan contexto y acción concreta (runbook).

## Ejemplos prácticos para n8n

### Ejemplo A — Correlation ID en webhook + llamadas HTTP

1. `Webhook`: tomar header `x-correlation-id` o generar UUID.
2. `Set/Code`: guardar `correlation_id` en `$json.meta`.
3. `HTTP Request`: enviar header `x-correlation-id` en cada integración.
4. `Code`: log estructurado de éxito/fallo por nodo crítico.

### Ejemplo B — Métricas de latencia y error por integración

En cada llamada externa crítica:
- medir duración,
- incrementar contador de éxito/error,
- etiquetar por endpoint/integración.

Esto permite ver rápido si el problema es del flujo o del proveedor.

### Ejemplo C — Alerta útil (no ruido)

Regla sugerida:
- alertar si `error_rate > 5%` durante 10 minutos **y** `retry_count` en aumento.

Acción sugerida en runbook:
1. verificar `429/5xx`,
2. revisar cuota y `Retry-After`,
3. activar degradación/fallback temporal.

## Integración con otras skills

- `n8n-api-http-robusta`: usa señales de rate-limit/retries para operación.
- `n8n-workflow-testing`: valida cobertura de observabilidad en tests.
- `n8n-validation-expert`: asegura configuraciones válidas antes de producción.
