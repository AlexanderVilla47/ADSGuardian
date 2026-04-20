# Backlog: Funcionalidades Faltantes post-Front MVP

**Fecha de captura**: 2026-04-14  
**Proyecto**: AdsKiller  
**Estado**: MVP en desarrollo

---

## Historial de cambios

| Fecha | Qué cambió |
|-------|------------|
| 2026-04-14 | Captura inicial post-revisión de pestaña Alertas |

---

## 1. Funcionalidades Implementadas ✅

| Funcionalidad | Workflow | Estado | Evidencia |
|--------------|----------|--------|------------|
| Alta contrato | F1 | ✅ Done | execution_id múltiples |
| Extensión contrato | F1 | ✅ Done | Reset preventiva 48h |
| Consulta contratos (dias_proximos) | F1 | ✅ Done | - |
| Listar ads por contrato | F1 | ✅ Done | execution 936 |
| Baja manual | F1 | ✅ Done | execution 933 |
| Pause ad manual (con precheck ACTIVE) | F1 → F2 | ✅ Done | execution 919→920 |
| Run now | F1 → F2 | ✅ Done | execution 934→935 |
| History paginado | F1 | ✅ Done | execution 1007+ |
| Persistencia F1 → Operations_Log | F1 | ✅ Done | CHUNK 3.1a |
| Persistencia F2 → Operations_Log | F2 | ✅ Done | CHUNK 3.1a-FIX |
| Persistencia F3 → Operations_Log | F3 | ✅ Done | CHUNK 3.1b |

---

## 2. Funcionalidades Pendientes (Backlog)

### 2.1 Normalización de Resultados (Phase 3.3)

| Item | Descripción | Workflow | Prioridad |
|------|-------------|----------|-----------|
| normalized_result en history | Agregar campo que mapee status actual (`accepted`, `queued`, `error`, `success`) → taxonomy (`SUCCESS`, `PARTIAL`, `FAILED`, `NOT EXECUTED`) | F1 | **HIGH** |

**Estado en tasks.md**: `3.3 Normalizar resultado operativo` - PENDIENTE

---

### 2.2 Pestaña Alertas (spec-mvp.md line 114)

| Item | Descripción | Workflow | Prioridad |
|------|-------------|----------|-----------|
| Wiring Alertas tab | F3 debe escribir en pestaña "Alertas" además de Operations_Log cuando hay evento CRITICAL | F3 | **HIGH** |

**Detalle técnico** (spec line 186):
- Crear alerta `CRITICAL` cuando agotados 3 retries y sin pausa exitosa
- Campos: `Alerta_ID`, `Severidad`, `Contrato_ID`, `Ad_ID`, `Motivo`, `Correlation_ID`, `Creada_At`, `Estado`

**Estado**: NO implementado (ninguna referencia en workflows)

---

### 2.3 Endpoint Influencers Search (FRONT-VS-FLOWS-GAP)

| Item | Descripción | Workflow | Prioridad |
|------|-------------|----------|-----------|
| GET /api/v1/influencers/search?q= | Búsqueda fuzzy de influencers con typo tolerance, score y top N | F1 | **MEDIUM** |

**Estado en gap analysis**: `PARCIAL` (implementado en F1; validación local estática)

---

### 2.4 Smoke Testing Determinístico (Phase 4.1)

| Item | Descripción | Workflow | Prioridad |
|------|-------------|----------|-----------|
| Suite smoke actions | Ejecutar smoke de acciones críticas (alta, extension, run_now, pause_ad, history) con evidencia de execution_id | F1/F2/F3 | **HIGH** |

**Estado en tasks.md**: `4.1 Ejecutar smoke de acciones criticas` - PENDIENTE

---

### 2.5 Retry Policy Verification (Phase 4.2)

| Item | Descripción | Workflow | Prioridad |
|------|-------------|----------|-----------|
| Verificar retries 3x/5m | Validar que rutas Meta 429/500 tienen retry con espera de 5 minutos | F2 | **MEDIUM** |

**Estado en tasks.md**: `4.2 Verificar regla de retries 3x/5m` - PENDIENTE

---

### 2.7 Profundizar skill n8n-api-direct-ops (NUEVO)

| Item | Descripción | Prioridad |
|------|-------------|-----------|
| Documentar limitaciones actuales | Documentar qué funciona y qué no al usar API directa para deploy/fix en workspace remoto | **HIGH** |
| Crear troubleshooting doc | Pasos que尝试é y por qué falló para que el próximo agente pueda corregir la skill | **HIGH** |

**Detalle**:
- Esta sesiónIntenté hacer PUT/GET a `/api/v1/workflows/{id}` con la API key pero recibí `401 unauthorized`
- El webhook funciona correctamente (permite ejecutar workflows)
- La API key parece no tener permisos de admin para modificar workflows
- Necesita documentación para que el próximo agente pueda investigar y corregir la skill

**Ver documentación**: `docs/stitch/N8N-API-DEPLOY-TROUBLESHOOTING.md`

| Item | Descripción | Prioridad |
|------|-------------|-----------|
| Formalizar gate MVP | Criteria de bloqueo para release y procedimiento de rollback | **MEDIUM** |

**Estado en tasks.md**: `4.3 Formalizar gate de release MVP` - PENDIENTE

---

## 3. Funcionalidades con Estado "PARCIAL"

Estas funcionalidades están implementadas pero requieren validación o hardening:

| Funcionalidad | Estado PARCIAL | Próximo paso |
|---------------|----------------|--------------|
| Consulta global avanzada | Limitada a `dias_proproximos`, sin filtros globales | Validar y expandir |
| Pause active batch | Guardrails implementados (`dry_run`, `confirm`, `batch_limit`), pero confirmación es booleana | Hardening con token |
| Tracking por tracking_id | No hay endpoint de estado para operaciones async | Implementar |

---

## 4. Dependencias y Precedencias

```
Phase 3.3 (Normalization)
        ↓
Phase 4.1 (Smoke Testing) ← Alertas wiring opcional antes
        ↓
Phase 4.2 (Retry verification)
        ↓
Phase 4.3 (Release Gate)
```

---

## 5. Referencias

- Tasks file: `openspec/changes/front-mvp-operational-console/tasks.md`
- Gap analysis: `docs/stitch/FRONT-VS-FLOWS-GAP.md`
- Mapping: `docs/stitch/API-CONTRACT-vs-FLOWS-MAPPING.md`
- Spec MVP: `docs/spec-mvp.md` (líneas 114-126 para Alertas)
- Evidence: `test.json`

---

## 6.行动元素 (Action Items)

### Inmediato (esta sesión)

- [x] Documentar normalización de resultados en F1 (código listo en repo)
- [x] Definir plan de implementación Alertas tab
- [x] Documentar troubleshooting n8n API deploy (creado N8N-API-DEPLOY-TROUBLESHOOTING.md)

### Corto plazo (prox 1-2 días)

- [x] Ejecutar smoke determinístico (Phase 4.1) - PASS executions 1059/1060/1025/1035
- [x] Verificar retries 3x/5m en F2 (Phase 4.2) - PASS (fix 0.2m->5m)

### Mediano plazo (prox 1 semana)

- [x] Implementar wiring Alertas tab en F3 - PASS runtime (execution 1024)
- [x] Implementar endpoint influencers/search (F1) - validación local
- [x] Formalizar gate release/rollback (Phase 4.3) - DOCUMENTADO
