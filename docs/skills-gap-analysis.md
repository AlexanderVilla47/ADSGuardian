# Skills Gap Analysis — AdsKiller (n8n)

## Skills detectadas por alcance

### Locales (proyecto)
- `n8n-mcp-tools-expert`
- `n8n-workflow-patterns`
- `n8n-api-http-robusta`
- `n8n-observability`
- `n8n-workflow-testing`

### Globales
- n8n: `n8n-code-javascript`, `n8n-code-python`, `n8n-expression-syntax`, `n8n-node-configuration`, `n8n-validation-expert`
- proceso/gobierno: `find-skills`, `skill-creator`, `skill-registry`, `sdd-init`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `sdd-apply`, `sdd-verify`, `sdd-archive`
- otras no-n8n: `audit-website`, `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`, `go-testing`

---

## Matriz de cobertura

| Skill disponible | Uso en este proyecto n8n | Cobertura | ¿Falta algo? | Recomendación |
|---|---|---|---|---|
| `n8n-workflow-patterns` (local) | Selección de patrones base (webhook, API, DB, AI, schedules). | Alta | Parcial | Complementar con playbooks de resiliencia, observabilidad y promotion entre entornos. |
| `n8n-mcp-tools-expert` (local) | Descubrimiento/validación de nodos, templates, credenciales y auditoría n8n-mcp. | Alta | Parcial | Agregar lineamientos de operación segura por entorno (dev/staging/prod). |
| `n8n-api-http-robusta` (local) | Integraciones API/HTTP robustas (contratos, versionado, idempotencia, retries con jitter, rate-limit). | Alta | Parcial | Profundizar en estrategias de recuperación avanzada (DLQ/circuit breaking/replay). |
| `n8n-observability` (local) | Correlation IDs, trazabilidad por ejecución, métricas, SLO y alerting accionable. | Alta | Parcial | Extender con runbooks por dominio y ownership operacional por flujo. |
| `n8n-workflow-testing` (local) | Testing funcional/no funcional: happy path, error path, mocks, regresión. | Alta | Parcial | Formalizar gating dev→staging→prod con criterios de promoción por criticidad. |
| `n8n-node-configuration` | Configuración por operación y dependencias de propiedades. | Alta | Parcial | Extender hacia contratos API/versionado y estrategias de idempotencia. |
| `n8n-expression-syntax` | Correcta escritura/depuración de expresiones n8n. | Alta | Parcial | Sumar convenciones de trazabilidad y observabilidad en expresiones críticas. |
| `n8n-validation-expert` | Ciclo validar → corregir con interpretación de errores. | Alta | Parcial | Incluir checklist de calidad operativa (latencia, retries, alertas). |
| `n8n-code-javascript` / `n8n-code-python` | Lógica en Code nodes y buenas prácticas de ejecución. | Media-Alta | Sí | Definir estándar de testing y versionado para lógica de Code nodes. |
| `sdd-*` | Gobierno de cambio end-to-end (explore → archive). | Alta | Parcial | Hacer obligatorios criterios n8n no funcionales en spec/design/verify. |
| `skill-registry` + `find-skills` + `skill-creator` | Inventario y evolución de capacidades. | Alta | No | Mantener ciclo periódico de actualización y cierre de gaps. |
| `go-testing` + skills de diseño web | Cobertura tangencial para AdsKiller n8n. | Baja | Sí | Mantener como soporte; no cierran gaps núcleo n8n. |

## Principales gaps detectados (n8n)

✅ Cerrados en esta iteración:
1. Integración API/HTTP robusta para n8n (`n8n-api-http-robusta`).
2. Observabilidad de workflows n8n (`n8n-observability`).
3. Testing de workflows n8n (`n8n-workflow-testing`).

Gaps remanentes:
1. Skill de **seguridad y secretos n8n** (rotación, mínimo privilegio, segregación por entorno, anti-leak).
2. Skill de **resiliencia y recuperación avanzada** (circuit breaking, DLQ/replay, compensaciones, runbooks de recuperación).
3. Skill de **governance de cambios de workflows** (promotion dev→staging→prod, rollback y versionado operativo).

## Conclusión de cobertura actual

La cobertura para **diseñar, operar y verificar workflows n8n** pasa a ser alta con la incorporación de skills locales de API robusta, observabilidad y testing.  
Los gaps abiertos se concentran en **seguridad avanzada de secretos**, **recuperación/resiliencia avanzada** y **governance de promoción multi-entorno**.
