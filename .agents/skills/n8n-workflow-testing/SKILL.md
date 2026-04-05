---
name: n8n-workflow-testing
description: Estrategia de testing para workflows n8n: happy paths, error paths, mocks de APIs, validaciones de contrato e implementación de regresión para flujos críticos. Trigger: usar cuando se diseña, modifica o verifica un workflow n8n en entorno de equipo.
license: Apache-2.0
metadata:
  author: gentleman-programming
  version: "1.0.0"
---

# n8n Workflow Testing

## Propósito

Establecer un marco de testing para n8n que reduzca regresiones y mejore confianza antes de promover cambios a staging/prod.

Cobertura objetivo:
- caminos felices (happy path),
- caminos de error (error path),
- contratos de integración,
- resiliencia (timeouts, retries, rate-limit),
- regresión en workflows críticos.

## Cuándo usar

Usá esta skill cuando:
- creás un workflow nuevo,
- modificás uno existente,
- cambiás contratos API o transformaciones de datos,
- preparás un release entre entornos,
- investigás incidentes recurrentes.

## Qué NO hacer

- NO testear solo manualmente un caso feliz.
- NO validar transformaciones con un único payload ideal.
- NO depender de APIs reales para todos los escenarios (usar mocks).
- NO promover cambios sin baseline de regresión.
- NO mezclar datos sensibles reales en fixtures.

## Pasos operativos

### 1) Definir estrategia de pruebas por riesgo

1. Clasificar workflows por criticidad (alta/media/baja).
2. Para alta criticidad, exigir:
   - suite happy + error,
   - validación de contrato,
   - prueba de regresión mínima.
3. Establecer criterios de aprobación por entorno.

### 2) Diseñar casos de prueba

Mínimo por workflow crítico:
- **Happy path**: entrada válida, salida esperada, latencia razonable.
- **Errores transitorios**: `429`, `5xx`, timeout (con retry esperado).
- **Errores permanentes**: `400/401/403` (sin retry ciego).
- **Datos borde**: vacíos, campos faltantes, tipos inesperados.
- **Duplicados**: misma clave idempotente/evento repetido.

### 3) Usar mocks y fixtures controladas

1. Mockear APIs externas para escenarios determinísticos.
2. Versionar fixtures representativas (incluyendo edge cases).
3. Mantener separación clara entre:
   - tests offline con mocks,
   - smoke/integración controlada contra entorno real.

### 4) Verificar no-funcionales

1. Confirmar que retries respeten política (intentos + jitter + cutoff).
2. Verificar comportamiento ante rate-limit (`429` + `Retry-After`).
3. Comprobar observabilidad:
   - `correlation_id` presente,
   - métricas/logs emitidos en éxito y fallo.

### 5) Regresión y promoción

1. Congelar baseline de casos críticos antes de cambios grandes.
2. Ejecutar regresión en cada modificación relevante.
3. Solo promover a siguiente entorno cuando la suite mínima está verde.

## Criterios de salida

La validación está lista cuando:
- Hay casos documentados de happy path + error path.
- Mocks/fixtures cubren escenarios críticos y edge cases.
- Idempotencia y retries quedan verificados en pruebas.
- Existe suite de regresión para workflows de alta criticidad.
- Se documenta resultado y decisión de promoción.

## Ejemplos prácticos para n8n

### Ejemplo A — Flujo API → Transform → DB

Casos mínimos:
1. API responde 200 con datos válidos → escribe registros esperados.
2. API responde 500 intermitente → retry exitoso dentro de límite.
3. API responde 400 → no retry, error clasificado correctamente.
4. Payload con campo faltante → deriva a ruta de error controlado.

### Ejemplo B — Webhook con idempotencia

1. Evento nuevo `event_id=abc` → procesa una vez.
2. Reenvío del mismo evento → deduplica, sin efectos duplicados.
3. Firma inválida → rechaza y registra evento de seguridad.

### Ejemplo C — Regresión de transformación

Fixture v1/v2 del proveedor:
- verificar que mapper no rompa campos legacy,
- detectar cambio de contrato temprano,
- bloquear promoción si hay incompatibilidad.

## Checklist rápido de aceptación

- [ ] Happy path validado
- [ ] Error paths críticos validados
- [ ] Mocks y fixtures versionadas
- [ ] Idempotencia y retries verificados
- [ ] Señales de observabilidad presentes
- [ ] Regresión ejecutada (si aplica)

## Integración con otras skills

- `n8n-api-http-robusta`: define escenarios de retry/rate-limit/idempotencia.
- `n8n-observability`: define assertions de logs/métricas/tracing.
- `n8n-workflow-patterns`: aporta estructura base del workflow.
