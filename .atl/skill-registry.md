# Skill Registry

**Delegator use only.** Any agent that launches sub-agents should resolve skill paths and inject compact rules directly into prompts.

## User Skills

| Trigger | Skill | Path |
|---|---|---|
| usar antes de correr o validar cualquier test de workflow en AdsKiller | adskiller-test-deterministic-workflow | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/.agents/skills/adskiller-test-deterministic-workflow/SKILL.md |
| usar cuando un agente deba modificar/publicar workflows por API directa de n8n | n8n-api-direct-ops | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/.agents/skills/n8n-api-direct-ops/SKILL.md |
| usar al diseñar o mantener workflows n8n que consumen o exponen APIs HTTP | n8n-api-http-robusta | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/.agents/skills/n8n-api-http-robusta/SKILL.md |
| usar cuando se diseña, opera o depura workflows n8n en entornos productivos | n8n-observability | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/.agents/skills/n8n-observability/SKILL.md |
| usar cuando se diseña, modifica o verifica un workflow n8n en entorno de equipo | n8n-workflow-testing | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/.agents/skills/n8n-workflow-testing/SKILL.md |
| building or refactoring n8n workflow architecture | n8n-workflow-patterns | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/.agents/skills/n8n-workflow-patterns/SKILL.md |
| using n8n-mcp tools for node search, validation, templates, or workflow ops | n8n-mcp-tools-expert | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/.agents/skills/n8n-mcp-tools-expert/SKILL.md |
| looking for installable capabilities/skills | find-skills | C:/Users/Usuario/.agents/skills/find-skills/SKILL.md |
| writing JavaScript in n8n Code nodes | n8n-code-javascript | C:/Users/Usuario/.agents/skills/n8n-code-javascript/SKILL.md |
| writing Python in n8n Code nodes | n8n-code-python | C:/Users/Usuario/.agents/skills/n8n-code-python/SKILL.md |
| fixing or validating n8n expressions | n8n-expression-syntax | C:/Users/Usuario/.agents/skills/n8n-expression-syntax/SKILL.md |
| configuring n8n nodes with property dependencies | n8n-node-configuration | C:/Users/Usuario/.agents/skills/n8n-node-configuration/SKILL.md |
| interpreting n8n validation errors and warnings | n8n-validation-expert | C:/Users/Usuario/.agents/skills/n8n-validation-expert/SKILL.md |
| implementing any feature/bugfix with TDD-first workflow | test-driven-development | C:/Users/Usuario/.agents/skills/test-driven-development/SKILL.md |
| website SEO/perf/security technical audit | audit-website | C:/Users/Usuario/.agents/skills/audit-website/SKILL.md |
| frontend interfaces/components/pages with production design | frontend-design | C:/Users/Usuario/.agents/skills/frontend-design/SKILL.md |
| web/mobile UI-UX plan/build/review/refactor | ui-ux-pro-max | C:/Users/Usuario/.agents/skills/ui-ux-pro-max/SKILL.md |
| review UI against web interface guidelines/accessibility | web-design-guidelines | C:/Users/Usuario/.agents/skills/web-design-guidelines/SKILL.md |
| writing go tests or Bubbletea teatest coverage | go-testing | C:/Users/Usuario/.config/opencode/skills/go-testing/SKILL.md |
| creating a GitHub issue with issue-first policy | issue-creation | C:/Users/Usuario/.config/opencode/skills/issue-creation/SKILL.md |
| opening a PR with issue-first policy | branch-pr | C:/Users/Usuario/.config/opencode/skills/branch-pr/SKILL.md |
| dual adversarial review protocol | judgment-day | C:/Users/Usuario/.config/opencode/skills/judgment-day/SKILL.md |
| creating new AI agent skills | skill-creator | C:/Users/Usuario/.config/opencode/skills/skill-creator/SKILL.md |

## Compact Rules

### adskiller-test-deterministic-workflow
- Seguir protocolo determinístico fijo: DoR, preflight, ejecución por pasos cortos.
- Veredicto PASS/FAIL solo con la ÚLTIMA execution_id posterior al último fix.
- Si la ejecución no alcanza el nodo objetivo: estado obligatorio `NO EJERCITADO`.
- No mezclar evidencia de ejecuciones históricas para decidir estado actual.
- Ciclo obligatorio RED → FIX → GREEN con evidencia mínima trazable.

### n8n-api-direct-ops
- Operar por REST directa con `X-N8N-API-KEY` (sin MCP como ruta principal).
- Ejecutar preflight, backup del workflow y PUT mínimo antes de publicar.
- Verificar post-deploy en API y ejecución real; no asumir éxito por 200 simple.
- Mantener cambios acotados, reversibles y con evidencia operativa.
- Priorizar seguridad de credenciales y no exponer secretos en logs.

### n8n-api-http-robusta
- Definir contratos de entrada/salida explícitos y versionados.
- Aplicar idempotencia en operaciones mutantes y deduplicación por key.
- Implementar retries con backoff+jitter y límites por tipo de error.
- Manejar 429/5xx con estrategias de resiliencia y observabilidad.
- Modelar errores de negocio vs técnicos con rutas separadas.

### n8n-observability
- Incluir correlation_id end-to-end en nodos y eventos.
- Emitir métricas operativas (latencia, éxito/error, throughput) por flujo.
- Definir SLOs y alertas accionables, evitando ruido no operativo.
- Trazar ejecuciones programadas y manuales con contexto de decisión.
- Diseñar logs para diagnóstico rápido sin filtrar datos sensibles.

### n8n-workflow-testing
- Cubrir happy path y error path con casos explícitos por contrato.
- Mockear APIs externas y validar payloads de request/response.
- Mantener regresión de flujos críticos como smoke mínimo repetible.
- Definir criterios de aceptación verificables por nodo/resultado.
- Registrar evidencia compacta para auditoría técnica y operativa.

### n8n-workflow-patterns
- Diseñar flujos por patrones probados (webhook, scheduler, fan-out, compensación).
- Separar ingestión, validación, negocio y salida en nodos claros.
- Minimizar acoplamiento entre ramas y centralizar manejo de errores.
- Preferir transformaciones explícitas antes que lógica implícita dispersa.
- Documentar decisiones de arquitectura dentro del cambio SDD.

### n8n-mcp-tools-expert
- Elegir herramienta MCP por objetivo (search, validate, template, credentials).
- Respetar formatos de parámetros exactos para evitar falsos errores.
- Validar configuración de nodos antes de ejecutar flujos en remoto.
- Usar patrones estándar para inspección, edición y verificación.
- No asumir defaults de credenciales ni de entorno.

### find-skills
- Buscar primero skills existentes antes de inventar solución ad-hoc.
- Priorizar skills locales/proyecto sobre globales cuando haya solapamiento.
- Evaluar trigger, alcance y límites antes de sugerir instalación.
- Proponer alternativa de creación de skill si hay gap real.
- Mantener trazabilidad de la recomendación en registro de skills.

### n8n-code-javascript
- Usar sintaxis nativa de Code node (`$input`, `$json`, `$node`) correctamente.
- Elegir modo `Run Once for All Items` vs `Each Item` según necesidad real.
- Manejar fechas y zonas horarias de forma explícita y determinística.
- Evitar side effects ocultos; devolver estructura de ítems válida de n8n.
- Resolver errores por contexto de ejecución, no por suposiciones de JS puro.

### n8n-code-python
- Usar `_input`, `_json`, `_node` según runtime Python de n8n.
- Respetar limitaciones del entorno (sin dependencias no disponibles).
- Mantener salidas serializables compatibles con ítems de n8n.
- Evitar estado global; procesar datos por ítem o lote explícito.
- Diagnosticar errores distinguiendo runtime n8n vs sintaxis Python.

### n8n-expression-syntax
- Encapsular expresiones con `{{ }}` y rutas de datos correctas.
- Referenciar `$json`, `$node`, `$item()` con contexto exacto de nodo.
- Validar nulos/undefined para prevenir fallas en runtime.
- Separar transformación compleja en Code node si la expresión se vuelve opaca.
- Corregir errores de sintaxis antes de culpar datos de entrada.

### n8n-node-configuration
- Configurar nodos según operación seleccionada y dependencias requeridas.
- Verificar campos obligatorios y tipos antes de ejecutar.
- Usar detalle de nodo adecuado para entender propiedades anidadas.
- Preferir configuraciones explícitas sobre defaults implícitos.
- Documentar decisiones de configuración no obvias.

### n8n-validation-expert
- Interpretar severidad (error/warning) y priorizar bloqueantes primero.
- Corregir estructura de operadores y schemas antes de retestar.
- Distinguir falso positivo de validación real con evidencia.
- Ejecutar bucle validar → corregir → validar hasta converger.
- Registrar causa raíz de cada corrección relevante.

### test-driven-development
- Redactar tests primero (RED), luego implementación mínima (GREEN).
- Refactorizar solo con tests en verde y sin romper comportamiento.
- Mantener tests pequeños, determinísticos y orientados al contrato.
- No implementar funcionalidades no pedidas por test activo.
- Usar ciclos cortos con feedback rápido.

### audit-website
- Ejecutar auditoría integral multi-categoría antes de proponer fixes.
- Priorizar findings por impacto en SEO/performance/security.
- Entregar reporte accionable con severidad y quick wins.
- Validar links rotos/meta/headers con evidencia objetiva.
- Evitar recomendaciones genéricas sin contexto del sitio.

### frontend-design
- Diseñar UI de calidad producción, evitando estética genérica.
- Mantener jerarquía visual, estados y consistencia de componentes.
- Priorizar accesibilidad, responsive y legibilidad real.
- Entregar código usable, no solo mock visual.
- Alinear estilo con el producto y su contexto operativo.

### ui-ux-pro-max
- Definir sistema visual coherente (paleta, tipografía, spacing, estados).
- Seleccionar patrones UX según tipo de producto/pantalla.
- Incluir accesibilidad (contraste, foco, navegación) desde el inicio.
- Diseñar interacciones/animaciones con propósito, no adorno.
- Validar decisiones con heurísticas UX y maintainability.

### web-design-guidelines
- Auditar interfaz contra guías web y WCAG aplicables.
- Reportar incumplimientos con evidencia y solución concreta.
- Revisar semántica, navegación por teclado y feedback de estado.
- Verificar consistencia visual y claridad de contenido.
- Priorizar fixes por riesgo de usabilidad/accesibilidad.

### go-testing
- Usar patrones idiomáticos de testing en Go (`table-driven`, subtests).
- En Bubbletea, emplear `teatest` para interacción determinística.
- Evitar flaky tests controlando timeouts y estado asíncrono.
- Aislar dependencias con doubles/mocks cuando corresponda.
- Medir cobertura como señal, no reemplazo de diseño de casos.

### issue-creation
- Cumplir política issue-first antes de tareas de implementación.
- Especificar problema, alcance, criterios de aceptación y contexto.
- Evitar issues ambiguas sin impacto técnico/negocio definido.
- Mantener trazabilidad entre issue, cambios y verificación.
- Redactar tickets accionables para ejecución por fases.

### branch-pr
- Crear PR con narrativa de por qué, no solo lista de cambios.
- Revisar diff completo desde base branch, no solo último commit.
- Confirmar estado de branch remoto y push con `-u` si corresponde.
- Incluir resumen, riesgos y evidencia de validación.
- Seguir convenciones del repo para título y descripción.

### judgment-day
- Lanzar revisión adversarial dual e independiente sobre el mismo objetivo.
- Sintetizar hallazgos y aplicar fixes antes de re-juzgar.
- Máximo 2 iteraciones; si no converge, escalar explícitamente.
- Mantener sesgo cero entre jueces (blind review real).
- Registrar veredicto final con riesgos residuales.

### skill-creator
- Definir `name`, `description`, triggers y límites de alcance claros.
- Documentar propósito, cuándo usar, qué NO hacer y criterios de salida.
- Incluir pasos operativos reproducibles y ejemplos mínimos útiles.
- Mantener skill enfocada en un problema concreto.
- Actualizar registro de skills tras crear/modificar una skill.

## Project Conventions

| File | Path | Notes |
|---|---|---|
| AGENTS.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/AGENTS.md | Index — reglas del repo + paths operativos referenciados |
| docs/runbook-n8n-acceso-y-testing-flujo3.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/runbook-n8n-acceso-y-testing-flujo3.md | Referenciado por AGENTS.md |
| docs/runbook-n8n-api-directa-agentes.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/runbook-n8n-api-directa-agentes.md | Referenciado por AGENTS.md |
| docs/flow3-smoke-regression.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/flow3-smoke-regression.md | Referenciado por AGENTS.md |
| docs/ops-alerting-flow3.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/ops-alerting-flow3.md | Referenciado por AGENTS.md |
| docs/release-criteria-flow3.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/release-criteria-flow3.md | Referenciado por AGENTS.md |
| docs/flow3-input-contract.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/flow3-input-contract.md | Referenciado por AGENTS.md |
| docs/flow3-hypercare-3d.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/flow3-hypercare-3d.md | Referenciado por AGENTS.md |
| docs/release-evidence-flow3-20260412.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/docs/release-evidence-flow3-20260412.md | Referenciado por AGENTS.md |
| workflows/baselines/README.md | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/workflows/baselines/README.md | Referenciado por AGENTS.md |
| workflows/baselines/flow3-notifications-v1.0-green.json | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/workflows/baselines/flow3-notifications-v1.0-green.json | Referenciado por AGENTS.md |
| scripts/flow3-smoke-regression.ps1 | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/scripts/flow3-smoke-regression.ps1 | Referenciado por AGENTS.md |
| scripts/flow3-hypercare-daily.ps1 | C:/Users/Usuario/Desktop/Proyectos/Automatizaciones/AdsKiller/scripts/flow3-hypercare-daily.ps1 | Referenciado por AGENTS.md |

Read these files for project-specific patterns; AGENTS.md already expands referenced paths.
