---
name: n8n-api-http-robusta
description: Guía de producción para integraciones API/HTTP en n8n con contratos, versionado, idempotencia, retries con jitter, límites/rate-limit y manejo robusto de errores. Trigger: usar al diseñar o mantener workflows n8n que consumen o exponen APIs HTTP.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# n8n API/HTTP Robusta

## Propósito

Definir un estándar práctico para que integraciones HTTP en n8n sean **seguras, estables y operables en producción**.

Objetivos clave:
- Evitar duplicados con idempotencia real.
- Reducir fallas transitorias con retries con backoff + jitter.
- Respetar límites de terceros (rate-limit, cuotas, burst).
- Hacer errores diagnósticables y accionables.
- Mantener contratos API versionados y verificables.

## Cuándo usar

Usá esta skill cuando:
- Consumís APIs REST desde `HTTP Request` (polling, sync, ingest).
- Exponés endpoints vía `Webhook` para recibir eventos.
- Tenés integraciones críticas con riesgo de duplicados o pérdidas.
- Necesitás paginación, reintentos y control de tasa.
- Debés operar con SLAs/SLOs y troubleshooting rápido.

## Qué NO hacer

- NO asumir que un `200` siempre significa éxito funcional (validar payload/estado de negocio).
- NO disparar retries ciegos sobre `4xx` no recuperables (ej. `400`, `401`, `403`).
- NO hardcodear tokens/API keys en nodos o expresiones.
- NO procesar webhooks sin verificar firma/autenticidad cuando aplique.
- NO escribir sin clave de idempotencia cuando el endpoint sea sensible a duplicados.
- NO ignorar headers de rate-limit (`Retry-After`, `X-RateLimit-*`).

## Pasos operativos

### 1) Contrato y versionado

1. Documentar endpoint, método, esquema de request/response y códigos esperados.
2. Fijar versión explícita (`/v1`, header de versionado o vendor media type).
3. Definir estrategia de compatibilidad:
   - backward compatible por defecto,
   - migración gradual para breaking changes.
4. En n8n, centralizar parámetros de versión en variables/referencias reutilizables.

### 2) Idempotencia (obligatoria en operaciones críticas)

1. Definir `idempotency_key` estable por operación de negocio (no por intento técnico).
2. Incluirla en header (`Idempotency-Key`) o campo del body según API.
3. Persistir clave + resultado mínimo (si aplica) para evitar reprocesos.
4. Al recibir webhook, deduplicar por `event_id`/`message_id` antes de ejecutar efectos.

### 3) Timeouts y retries con jitter

1. Configurar timeout explícito por request.
2. Clasificar errores:
   - **Retryable**: `408`, `429`, `5xx`, timeouts de red.
   - **No retry**: `400`, `401`, `403`, `404` (salvo caso específico documentado).
3. Usar backoff exponencial con jitter (evita thundering herd).
4. Limitar intentos (ej. 3-5) y enrutar fallo final a cola de revisión/DLQ lógica.

### 4) Rate-limit y control de concurrencia

1. Leer headers de cuota y ajustar ritmo dinámicamente.
2. Respetar `Retry-After` para `429`.
3. Limitar concurrencia por integración crítica (serializar si hace falta).
4. En lotes grandes, usar ventanas/chunks y checkpoints.

### 5) Manejo de errores y observabilidad mínima

1. Normalizar errores técnicos y de negocio en un objeto común.
2. Adjuntar `correlation_id`, endpoint, status, intento, latencia.
3. Diferenciar claramente:
   - error transitorio,
   - error permanente,
   - error de contrato de datos.
4. Emitir eventos/alertas solo para severidad relevante (evitar ruido).

## Criterios de salida

La implementación queda lista cuando:
- Existe contrato/versionado explícito por endpoint crítico.
- Idempotencia implementada y probada en duplicados/reintentos.
- Política de retries con jitter definida por tipo de error.
- Rate-limit respetado con comportamiento ante `429` verificado.
- Errores normalizados con `correlation_id` y contexto operativo.
- Quedan documentados límites, supuestos y fallback.

## Ejemplos prácticos para n8n

### Ejemplo A — Ingesta paginada con protección de cuota

**Caso**: sincronizar pedidos desde API externa cada 5 min.

Patrón sugerido:
1. `Schedule Trigger`
2. `HTTP Request` (página 1)
3. `IF` (si hay `next_page`)
4. `Wait` (si cuota baja o `Retry-After`)
5. `Code/Set` (normalizar)
6. Persistencia + checkpoint de última página

Buenas prácticas:
- Guardar cursor/página procesada.
- Retry solo en `429/5xx` con jitter.
- Cortar ejecución si contrato de respuesta cambió.

### Ejemplo B — Webhook de pagos con deduplicación

**Caso**: recibir `payment.succeeded` y actualizar ERP.

Patrón sugerido:
1. `Webhook`
2. `Code` (verificar firma/HMAC)
3. `IF` (evento ya procesado por `event_id`)
4. `HTTP Request` al ERP con `Idempotency-Key`
5. `Respond to Webhook`

Buenas prácticas:
- Responder rápido y procesar asincrónico si hay latencia alta.
- Registrar `event_id`, `correlation_id`, resultado y timestamp.

### Ejemplo C — Retry con jitter desde Code Node

Pseudo-lógica reusable:

```javascript
const baseMs = 500;
const maxRetries = 4;

function nextDelay(attempt) {
  const exp = baseMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 300);
  return exp + jitter;
}
```

Usar junto con clasificación de status para decidir retry/no-retry.

## Integración con otras skills

- `n8n-workflow-patterns`: define arquitectura base del flujo.
- `n8n-node-configuration`: detalle fino de propiedades de nodos.
- `n8n-expression-syntax`: expresiones para headers/correlation/idempotency.
- `n8n-observability`: trazabilidad, métricas y alertas operativas.
- `n8n-workflow-testing`: validación de happy path/error path/regresión.
