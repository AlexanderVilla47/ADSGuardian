# Plan Maestro Front MVP AdsKiller (negocio-first)

Fecha: 2026-04-13

## 1) Objetivo de negocio

Entregar una consola operativa MVP que cierre el gap actual entre front y workflows canonicos:

- F1 `cFBr6GavlSWDsUFz` (gestion de contratos)
- F2 `8mlwAxLtJVrwpLhi` (kill-switch diario y manual)
- F3 `BFHHQwYFfmcpqshb` (notificaciones operativas)

Prioridad de negocio:

1. Evitar anuncios vencidos sin pausar.
2. Asegurar notificacion operativa accionable.
3. Dar capacidad real de operacion diaria desde UI.

Decisiones vigentes:

- Persistencia MVP: Google Sheets (sin DB por el momento).
- El matching de anuncios queda como feature interna (no modulo principal del front).

Fuentes base: `docs/stitch/FRONT-VS-FLOWS-GAP.md` y `docs/stitch/UI-CONTRACT-MVP.md`.

## 2) Estrategia de ejecucion por etapas

### Etapa 0 - Base operativa y contrato unico front-back

Objetivo: estabilizar el contrato API para que la UI no dependa de internals n8n.

Alcance:

- Definir un endpoint facade unico para UI con acciones MVP (`alta`, `consulta`, `extension`, `run_now`).
- Estandarizar DTOs de request/response y codigos de error.
- Agregar `correlation_id` en requests/responses para trazabilidad.

DoD:

- Contrato versionado y documentado en repo.
- UI consume contrato unico sin llamadas directas a nodos internos.
- Trazabilidad por `correlation_id` visible en logs de ejecucion.

### Etapa 1 - Riesgo critico: vencidos y pausa operativa

Objetivo: habilitar operaciones que impactan directamente en evitar vencidos sin pausar.

Alcance:

- Implementar `listar_ads` por `Contrato_ID`.
- Implementar `pause_ad` manual por item con pre-check `ACTIVE`.
- Implementar `baja_manual` para cierre operativo controlado.

DoD:

- Dashboard y detalle de contrato muestran ads reales (no mock).
- Boton `Pause ad` ejecuta pausa real y refleja estado final.
- `baja_manual` deja evidencia (usuario, motivo, timestamp).

### Etapa 2 - Historial y alerting consultable

Objetivo: transformar F3 en capacidad operativa consultable desde UI.

Alcance:

- Persistir eventos y resultados de ejecucion (store en Sheets MVP).
- Exponer lectura paginada para `Operational History`.
- Unificar severidad/resultados (`SUCCESS|PARTIAL|FAILED`, `NOT EXERCISED`).

DoD:

- Tabla de historial en UI con filtros basicos y detalle por `execution_id`.
- Alerta de fallos de canal visible en UI, no solo en Slack/Telegram.
- Evidencia de corridas manuales y scheduler auditable.

### Etapa 3 - Endurecimiento para produccion MVP

Objetivo: liberar MVP con control de riesgo operativo y rollback claro.

Alcance:

- Validar retries efectivos 3x/5m en caminos Meta `429/500`.
- Ejecutar regresion de humo operativa de punta a punta.
- Definir gate final de release + plan de rollback.

DoD:

- Sin casos de anuncios vencidos activos en corrida de validacion.
- Gate de release cumplido con evidencia minima.
- Rollback ejecutable y probado sobre baseline estable.

## 3) Gate de release/rollback MVP (fuente de verdad)

Este documento es la fuente de verdad del gate MVP. Los detalles operativos de Flow3 quedan enlazados desde `docs/release-criteria-flow3.md` y la evidencia de release usa la plantilla `docs/release-evidence-template.md`.

### 3.1 Checklist Go/No-Go verificable

**No se habilita release si falla cualquiera de estos puntos:**

1. **Salud endpoints críticos**
   - `GET /healthz` responde `200`.
   - `GET /api/v1/workflows/{id}` responde `200` con `N8N_API_KEY` válida.
   - La regresión smoke operativa relevante cierra `exit 0`.
2. **Evidencia determinística por chunk**
   - Cada chunk cerrado se aprueba solo con su **última** `execution_id` post-fix.
   - No se mezclan corridas históricas para emitir `PASS/FAIL`.
   - Chunks cerrados con evidencia vigente: `3.3`, `A`, `B/B.1/C`, `D3`.
3. **Observabilidad mínima**
   - Toda evidencia trae `correlation_id`, `execution_id`, `timestamp` y veredicto.
   - Los eventos `CRITICAL` conservan `severity`, `channel`, `message` y origen trazable.
4. **Retries 3x/5m**
   - Los caminos Meta `429/500` mantienen `3` intentos y espera `5m` antes de fallar.
5. **Alertas CRITICAL operativas**
   - `ops_notification_channel_error` en `CRITICAL` alerta en el primer evento.
   - `ops_notification_channel_unsupported` alerta en el primer evento.
   - Los tiempos objetivo siguen siendo `ack <= 10 min` y `mitigacion <= 30 min` para P1.
6. **Riesgo funcional**
   - No quedan `Expired Unpaused` tras la corrida de control.
   - La pausa sigue restringida a nivel **Ad** y respeta `America/Argentina/Buenos_Aires`.

### 3.2 Rollback operativo

**Trigger de rollback:** cualquiera de estos eventos vuelve el release a **NO-GO**:

- falla la smoke regression o una validación determinística post-fix,
- falta trazabilidad mínima (`execution_id` / `correlation_id`),
- se pierde observabilidad de alertas CRITICAL,
- hay drift de contrato o queda un anuncio vencido sin pausar,
- la verificación post-release no confirma baseline verde.

**Pasos técnicos:**

1. Congelar activaciones/corridas manuales del workflow impactado.
2. Restaurar el último baseline verde o backup aprobado del workflow afectado.
3. Reaplicar solo el payload mínimo necesario por API directa.
4. Verificar GET de detalle y salud del workflow restaurado.
5. Ejecutar la smoke/regresión mínima del caso afectado.

**Validación post-rollback:**

- GET del workflow restaurado en `200`.
- Smoke mínima `GREEN` contra el baseline restaurado.
- Alertas CRITICAL operativas y trazables.
- Sin `Expired Unpaused` en la corrida de control.

**Ownership y tiempos:**

- Owner primario: Operación AdsKiller.
- Owner secundario: responsable técnico de workflows n8n.
- Ack objetivo: `<= 10 min` en P1/CRITICAL.
- Inicio de rollback: `<= 30 min` si persiste el riesgo.
- Cierre técnico: `<= 60 min` con evidencia mínima.

### 3.3 Plantilla mínima de evidencia de release

La evidencia debe incluir como mínimo:

- fecha y hora,
- commit/tag/version de release,
- versiones de workflows afectadas,
- `execution_id` y `correlation_id` por caso,
- veredicto final (`GO` / `NO-GO`),
- baseline usado para rollback si aplica.

Ver plantilla canónica: `docs/release-evidence-template.md`.

## 4) Checklist de arranque (primeras 5 tareas ejecutables)

- [ ] 1. Confirmar y publicar contrato de acciones MVP (`alta`, `consulta`, `extension`, `run_now`) con DTOs estables.
- [ ] 2. Implementar endpoint `listar_ads` por `Contrato_ID` para poblar detalle de contrato real.
- [ ] 3. Implementar endpoint `pause_ad` manual (`Contrato_ID` + `Ad_ID`) con pre-check `ACTIVE`.
- [ ] 4. Implementar persistencia de historial operativo en Sheets + endpoint de lectura paginada.
- [ ] 5. Conectar Dashboard/Operational History al backend real y validar estados (`SUCCESS|PARTIAL|FAILED|NOT EXERCISED`).

## 5) Alcance explicitamente fuera de este kickoff

- Reemplazo de Sheets por DB productiva.
- Modulo independiente de matching avanzado como producto separado.
- Operaciones bulk de alto riesgo (`pause_all_active`) sin guardrails formales.
