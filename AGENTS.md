# AGENTS.md — AdsKiller

## Propósito del proyecto

Este repo (`AdsKiller`) está orientado a **automatizaciones con n8n**: diseño, implementación, verificación y operación de workflows para integraciones, procesamiento de datos y orquestación de tareas.

## Contexto de negocio AdsKiller

AdsKiller automatiza la detección y pausa de anuncios vencidos en Meta Ads para reducir riesgo operativo, incumplimientos comerciales y pérdida de control en campañas activas.

El flujo se integra con una UI operativa para que el equipo pueda:

- Dar de alta contratos/reglas.
- Consultar estado de anuncios y contratos.
- Extender vigencias de forma controlada.

La operación se rige por timezone **America/Argentina/Buenos_Aires** y por reglas de fecha estrictas para evitar ambigüedades.

## Alcance funcional (MVP y fuera de alcance)

### MVP (incluido)

- Pausa de anuncios **solo a nivel Ad** (no Ad Set / no Campaign).
- UI para **altas, consultas y extensiones**.
- Matching de anuncio por **regex flexible case-insensitive** sobre nombre.
- Pausa preventiva a las **48h** (una sola vez por contrato/anuncio) con reseteo al extender vigencia.
- Pre-check de estado **ACTIVE** en Meta antes de intentar pausar.
- Ejecución forzada manual permitida (run operativo on-demand).

### Fuera de alcance MVP

- Fallback por Slack/Telegram ante fallas de ejecución (no incluido en esta fase).

## Triggers y eventos de operación

- Trigger programado (scheduler) para evaluación periódica de vencimientos.
- Trigger manual para ejecución forzada desde operación.
- Evento de prevención 48h pre-vencimiento (una sola vez).
- Evento de vencimiento efectivo con acción de pausa.
- Evento de extensión de contrato, que resetea el estado preventivo.

## Sistemas involucrados e integraciones

- **n8n** como orquestador principal de workflows.
- **Meta Ads API** para lectura de estado y acción de pausa a nivel Ad.
- **UI de operación** para altas/consultas/extensiones y disparo manual.

## Reglas críticas de dominio

- La acción de pausa se ejecuta **únicamente sobre Ads**.
- Antes de pausar, debe validarse estado **ACTIVE** en Meta.
- Si la pausa en Meta es exitosa, `Status_Contrato` pasa a **Finalizado**.
- Las fechas de entrada/salida deben cumplir formato **YYYY-MM-DD** sin excepción.
- El matching de anuncios se resuelve por regex flexible **case-insensitive** sobre nombre.
- La preventiva 48h se dispara una sola vez y se habilita nuevamente solo con extensión.

## Requisitos no funcionales

- Timezone operativa fija: **America/Argentina/Buenos_Aires**.
- Resiliencia Meta Ads API ante `429`/`500`: **3 intentos** con espera de **5 minutos** entre intentos.
- Trazabilidad de ejecuciones (programadas y forzadas) para auditoría operativa.

## Operación y soporte

- Operación manual habilitada para forzar corrida cuando el equipo lo requiera.
- Monitoreo activo de anuncios vencidos no pausados.
- Gestión de incidentes priorizando corrección de anuncios en riesgo antes que automatizaciones secundarias.
- Runbook operativo de acceso/API y testing determinístico del Flujo 3: `docs/runbook-n8n-acceso-y-testing-flujo3.md`.
- Runbook operativo para fixes/deploys por API REST directa de n8n (sin MCP): `docs/runbook-n8n-api-directa-agentes.md`.
- Baseline versionado de Flow3 notifications: `workflows/baselines/README.md` y `workflows/baselines/flow3-notifications-v1.0-green.json`.
- Regresión smoke operativa de Flow3 (4 casos): `scripts/flow3-smoke-regression.ps1` y guía `docs/flow3-smoke-regression.md`.
- Reglas de alerting operativo para fallos de canal/unsupported: `docs/ops-alerting-flow3.md`.
- Gate formal de release y rollback para Flow3: `docs/release-criteria-flow3.md`.
- Contrato de entrada de Flow3 (canales permitidos + invalidos): `docs/flow3-input-contract.md`.
- Hypercare operativo de Flow3 por 3 dias: `docs/flow3-hypercare-3d.md` con ejecucion diaria `scripts/flow3-hypercare-daily.ps1`.
- Evidencia de release vigente de Flow3: `docs/release-evidence-flow3-20260412.md`.

### Protocolo operativo de evidencia (`test.json`)

- La evidencia extensa de ejecuciones (inputs, outputs, comentarios y trazas operativas) se centraliza en `test.json`.
- Antes de solicitar nuevos datos al usuario, revisar primero `test.json` y los acuerdos/memoria vigentes del proyecto.
- Evitar pedir de nuevo inputs/outputs que ya fueron enviados o documentados en `test.json`.
- Mantener este protocolo en futuras sesiones para continuidad operativa y menor fricción con el usuario.

### Precedencia de validacion deterministica (obligatoria)

- El veredicto de cada caso se emite solo con la ultima `execution_id` posterior al ultimo FIX/cambio.
- Queda prohibido mezclar evidencia de `execution_id` historicas para decidir PASS/FAIL.
- Si esa ultima ejecucion no alcanza el nodo objetivo, el estado obligatorio es `NO EJERCITADO`.
- Toda fase de testing del flujo AdsKiller debe ejecutar la skill local `adskiller-test-deterministic-workflow` como metodologia base.

## Riesgos y mitigaciones

- **Riesgo:** anuncio vencido queda activo por error de integración o rate-limit.
  - **Mitigación:** retries 3x/5m para `429`/`500` y alerta crítica si persiste sin pausa.
- **Riesgo:** reglas de fecha ambiguas o inconsistentes.
  - **Mitigación:** validación estricta de formato `YYYY-MM-DD`.
- **Riesgo:** falsos positivos/negativos por naming inconsistente de anuncios.
  - **Mitigación:** matching por regex flexible case-insensitive con revisión operativa.

## Criterios de éxito

- No quedan anuncios vencidos sin pausar al cierre de cada ciclo operativo.
- Se emite **alerta crítica** cuando cualquier anuncio vencido no puede pausarse.
- El `Status_Contrato` se actualiza a **Finalizado** tras pausa exitosa.
- La UI permite operar de punta a punta: alta, consulta y extensión.
- La ejecución forzada manual funciona y queda trazada.

## Decisiones cerradas (baseline vigente)

- ✅ Pausa solo a nivel Ad.
- ✅ UI para altas/consultas/extensiones.
- ✅ Preventiva 48h una sola vez y reseteo por extensión.
- ✅ Sin fallback Slack/Telegram en MVP.
- ✅ `Status_Contrato` a Finalizado tras pausa exitosa.
- ✅ Fecha estricta `YYYY-MM-DD`.
- ✅ Ejecución forzada manual permitida.
- ✅ Alerta crítica si queda anuncio vencido sin pausar.
- ✅ Pre-check `ACTIVE` en Meta antes de pausar.
- ✅ Matching por regex flexible case-insensitive sobre nombre de anuncio.
- ✅ Retry para Meta `429`/`500`: 3 intentos con 5 min.
- ✅ Timezone `America/Argentina/Buenos_Aires`.

---

## Inventario de skills instaladas

> Estado detectado (actual): skills globales + locales del proyecto.

| Skill | Alcance | Ubicación | Uso principal |
|---|---|---|---|
| `n8n-mcp-tools-expert` | **Local (proyecto)** | `.agents/skills/n8n-mcp-tools-expert/` | Uso experto de herramientas n8n-mcp (descubrir nodos, validar, plantillas, credenciales, auditoría). |
| `n8n-workflow-patterns` | **Local (proyecto)** | `.agents/skills/n8n-workflow-patterns/` | Patrones arquitectónicos de workflows n8n (webhook, API, DB, AI, schedules). |
| `n8n-api-http-robusta` | **Local (proyecto)** | `.agents/skills/n8n-api-http-robusta/` | Integraciones HTTP/APIs en producción (contratos, versionado, idempotencia, retries con jitter, rate-limit). |
| `n8n-api-direct-ops` | **Local (proyecto)** | `.agents/skills/n8n-api-direct-ops/` | Operación de workflows por API REST directa con `X-N8N-API-KEY` (preflight, backup, PUT mínimo y verify). |
| `n8n-observability` | **Local (proyecto)** | `.agents/skills/n8n-observability/` | Observabilidad de workflows n8n (correlation IDs, tracing, métricas, SLO y alerting). |
| `n8n-workflow-testing` | **Local (proyecto)** | `.agents/skills/n8n-workflow-testing/` | Testing de workflows n8n (happy/error paths, mocks, regresión y verificación no funcional). |
| `adskiller-test-deterministic-workflow` | **Local (proyecto)** | `.agents/skills/adskiller-test-deterministic-workflow/` | Protocolo obligatorio de testing determinístico (DoR, preflight, run one, PASS/FAIL, RED->FIX->GREEN, evidencia y commits por test). |
| `find-skills` | Global | `~/.agents/skills/find-skills/` | Descubrir e instalar nuevas skills cuando falta capacidad. |
| `n8n-code-javascript` | Global | `~/.agents/skills/n8n-code-javascript/` | Guía para Code node JavaScript en n8n. |
| `n8n-code-python` | Global | `~/.agents/skills/n8n-code-python/` | Guía para Code node Python en n8n (beta y limitaciones). |
| `n8n-expression-syntax` | Global | `~/.agents/skills/n8n-expression-syntax/` | Sintaxis de expresiones n8n y troubleshooting. |
| `n8n-node-configuration` | Global | `~/.agents/skills/n8n-node-configuration/` | Configuración de nodos por operación/dependencias de propiedades. |
| `n8n-validation-expert` | Global | `~/.agents/skills/n8n-validation-expert/` | Interpretación/corrección de errores de validación en n8n. |
| `audit-website` | Global | `~/.agents/skills/audit-website/` | Auditoría web general. |
| `frontend-design` | Global | `~/.agents/skills/frontend-design/` | Diseño frontend. |
| `ui-ux-pro-max` | Global | `~/.agents/skills/ui-ux-pro-max/` | UX/UI general. |
| `web-design-guidelines` | Global | `~/.agents/skills/web-design-guidelines/` | Guías de diseño web. |
| `go-testing` | Global | `~/.config/opencode/skills/go-testing/` | Patrones de testing en Go/Bubbletea (acotado a contexto Go). |
| `skill-creator` | Global | `~/.config/opencode/skills/skill-creator/` | Crear nuevas skills para cubrir gaps. |
| `skill-registry` | Global | `~/.config/opencode/skills/skill-registry/` | Catalogar skills y convenciones del proyecto. |
| `sdd-init` | Global | `~/.config/opencode/skills/sdd-init/` | Inicializar contexto SDD del proyecto. |
| `sdd-explore` | Global | `~/.config/opencode/skills/sdd-explore/` | Explorar problema, restricciones e hipótesis. |
| `sdd-propose` | Global | `~/.config/opencode/skills/sdd-propose/` | Redactar propuesta de cambio. |
| `sdd-spec` | Global | `~/.config/opencode/skills/sdd-spec/` | Definir requisitos y escenarios. |
| `sdd-design` | Global | `~/.config/opencode/skills/sdd-design/` | Diseñar arquitectura/decisiones técnicas. |
| `sdd-tasks` | Global | `~/.config/opencode/skills/sdd-tasks/` | Desglosar plan en tareas implementables. |
| `sdd-apply` | Global | `~/.config/opencode/skills/sdd-apply/` | Implementar tareas definidas. |
| `sdd-verify` | Global | `~/.config/opencode/skills/sdd-verify/` | Verificar implementación contra spec/tareas. |
| `sdd-archive` | Global | `~/.config/opencode/skills/sdd-archive/` | Cerrar cambio y archivar artefactos. |

---

## Skills listas para usar ahora

### Núcleo n8n (operación diaria AdsKiller)

- `n8n-workflow-patterns` (**local**) — diseño de arquitectura de workflows.
- `n8n-mcp-tools-expert` (**local**) — ejecución avanzada con herramientas n8n-mcp.
- `n8n-api-http-robusta` (**local**) — integración API/HTTP robusta para producción.
- `n8n-api-direct-ops` (**local**) — fixes/deploys por API REST directa con `X-N8N-API-KEY` (sin MCP como ruta principal).
- `n8n-observability` (**local**) — trazabilidad, métricas y alertas operativas.
- `n8n-workflow-testing` (**local**) — estrategia de testing y regresión de flujos n8n.
- `adskiller-test-deterministic-workflow` (**local**) — metodología fija de ejecución determinística por caso (DoR, preflight, ciclo RED->FIX->GREEN y evidencia mínima).
- `n8n-node-configuration` (global) — configuración correcta por operación.
- `n8n-expression-syntax` (global) — expresiones y acceso a datos.
- `n8n-validation-expert` (global) — bucle validar → corregir.
- `n8n-code-javascript` / `n8n-code-python` (global) — lógica en Code nodes.

### Soporte de proceso y gobierno técnico

- `sdd-*` (global) — flujo completo de cambios por fases (explore → archive).
- `skill-registry` (global) — actualización de inventario/rutas.
- `find-skills` (global) — descubrir capacidades faltantes.

---

## Política de uso de skills

### 1) Cuándo se auto-cargan

- **Por contexto técnico explícito**:
  - Diseño/implementación n8n → `n8n-workflow-patterns`, `n8n-api-direct-ops`, `n8n-api-http-robusta`, `n8n-observability`, `n8n-workflow-testing`, `adskiller-test-deterministic-workflow`, `n8n-node-configuration`, `n8n-expression-syntax`, `n8n-validation-expert`, `n8n-code-javascript`/`n8n-code-python`
  - Testing operativo AdsKiller (ejecución determinística por caso) → `adskiller-test-deterministic-workflow` + `n8n-workflow-testing`
  - Testing Go/Bubbletea → `go-testing`
  - Creación de skills → `skill-creator`
- **Por fase SDD explícita**:
  - `/sdd-init`, `/sdd-explore`, `/sdd-propose`, `/sdd-spec`, `/sdd-design`, `/sdd-tasks`, `/sdd-apply`, `/sdd-verify`, `/sdd-archive`

### 2) Cuándo NO se auto-cargan

- Consultas rápidas de estado o coordinación que no requieran ejecución técnica.
- Tareas puramente administrativas sin impacto en código/artefactos.
- Si el contexto no activa un trigger claro.

### 3) Prioridad por contexto

1. **Reglas del repositorio / instrucciones de usuario** (máxima prioridad)
2. **Skill LOCAL del proyecto** (si existe para ese mismo contexto)
3. **Skill de fase SDD activa** (si existe)
4. **Skill GLOBAL técnica por contexto**
5. **Comportamiento base del agente**

Si hay conflicto, prevalece la regla más específica y segura para el objetivo actual.

### 4) Precedencia global vs local (regla explícita)

- Si hay skill local y global con el **mismo objetivo**, se usa **local** (más específica para AdsKiller).
- Si solo existe global, se usa global.
- Si ninguna cubre el caso, usar `find-skills` y/o crear skill nueva con `skill-creator`.

---

## Flujo operativo recomendado (AdsKiller)

1. **Descubrimiento**
   - Usar `sdd-explore` para entender problema de automatización, eventos, APIs, límites, seguridad y operación.
2. **Diseño**
   - `sdd-propose` → `sdd-spec` → `sdd-design` → `sdd-tasks`.
   - Definir triggers, contratos de datos, manejo de errores y observabilidad.
3. **Implementación**
   - `sdd-apply` por lotes de tareas pequeñas.
   - Documentar decisiones y progreso.
4. **Verificación**
   - `sdd-verify` para validar contra specs y criterios operativos.
   - Luego `sdd-archive` para consolidar y cerrar.

---

## Faltantes / Gaps (skills recomendadas para n8n)

Con las nuevas skills locales (`n8n-api-http-robusta`, `n8n-observability`, `n8n-workflow-testing`) quedó cubierta gran parte del roadmap operativo inicial. Gaps remanentes:

1. **Manejo de secretos y credenciales**
   - Falta una skill dedicada de políticas de rotación, mínimo privilegio y segregación por entorno.
2. **Resiliencia avanzada y recuperación**
   - Aún conviene una skill específica para circuit breaking, compensaciones y DLQ/estrategias de replay.
3. **Governance de cambios en workflows**
   - Falta estandarizar promotion dev→staging→prod, rollback operativo y versionado de despliegues.

---

## Convenciones de documentación para nuevos agentes/skills

1. **Cada skill nueva debe incluir**:
   - `name`, `description`, triggers claros y límites de alcance.
2. **Formato mínimo recomendado**:
   - Propósito
   - Cuándo usar
   - Qué NO hacer
   - Pasos operativos
   - Criterios de salida
3. **Ubicación y registro**:
   - Guardar en directorio de skills correspondiente.
   - Actualizar registro con `skill-registry`.
4. **Trazabilidad**:
   - Relacionar skill con necesidades reales de AdsKiller (operación n8n).
5. **Evolución controlada**:
   - Cambios incrementales, ejemplos reales y versionado semántico interno.
