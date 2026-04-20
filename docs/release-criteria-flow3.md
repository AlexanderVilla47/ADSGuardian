# Release criteria formal - Flow3 notifications

> Fuente de verdad del gate MVP: `docs/plan-maestro-adskiller-mvp.md`.
> Este documento conserva el detalle operativo y la evidencia específica de Flow3 (`BFHHQwYFfmcpqshb`).

Workflow: `BFHHQwYFfmcpqshb`

## Gate obligatorio de release

No se permite release si no hay corrida smoke mas reciente con 4 casos GREEN y evidencia determinística completa:

- `telegram`
- `slack`
- `both`
- `unsupported`

La corrida valida debe salir de `scripts/flow3-smoke-regression.ps1` sin fallos (`exit 0`).

Además, la evidencia debe cumplir:

- `execution_id` y `correlation_id` por cada caso.
- timestamps de corrida (`startedAt` o `stoppedAt`).
- alerting CRITICAL operativo y trazable.
- retries Meta `429/500` en `3x/5m` en el workflow afectado.

## Evidencia minima requerida

Para aprobar release, adjuntar en el ticket/reporte:

1. `execution_id` por cada caso (4 en total).
2. timestamp de corrida por caso (`startedAt` o `stoppedAt`).
3. version de baseline usada (ejemplo: `flow3-notifications-v1.0-green.json`).
4. resultado final de tabla PASS/FAIL.
5. link o copia de la plantilla completada (`docs/release-evidence-template.md`).

Sin esos 5 bloques de evidencia, el release queda bloqueado.

## Criterio de rollback

Hacer rollback inmediato a baseline previo si ocurre cualquiera de estos eventos post-release:

1. Fallo de smoke regression en una revalidacion inmediata post-release.
2. Evento `ops_notification_channel_error` en severidad `CRITICAL` sin mitigacion en <= 30 min.
3. Aumento sostenido de `ops_notification_channel_unsupported` por error de contrato de entrada.
4. Pérdida de trazabilidad mínima (`execution_id` / `correlation_id`) en una validación post-release.
5. Se detecta drift contra la baseline verde aprobada.

Accion de rollback:

- Restaurar workflow a ultimo baseline `*-green.json` estable.
- Repetir smoke regression completa (4 casos) antes de reabrir release.

## Validación post-rollback

1. Confirmar GET del workflow restaurado en `200`.
2. Repetir `scripts/flow3-smoke-regression.ps1`.
3. Verificar que `ops_notification_channel_error` y `ops_notification_channel_unsupported` sigan trazables.
4. Cerrar rollback solo con `4/4 GREEN` y evidencia archivada.

## Ownership y tiempos

- Owner primario: Operación AdsKiller.
- Owner secundario: responsable técnico de workflows n8n.
- Ack objetivo: `<= 10 min` en P1/CRITICAL.
- Mitigación/rollback: `<= 30 min` si persiste el riesgo.
- Cierre con evidencia: `<= 60 min`.

## Secuencia de aprobacion sugerida

1. Confirmar baseline actual en `workflows/baselines/`.
2. Ejecutar smoke regression y guardar evidencia.
3. Revisar alerting operativo (`docs/ops-alerting-flow3.md`).
4. Validar contrato de entrada (`docs/flow3-input-contract.md`).
5. Adjuntar evidencia de release (`docs/release-evidence-flow3-20260412.md` o fecha vigente) y la plantilla completada.
6. Aprobar release solo con gate GREEN + evidencia completa.

## Hypercare post-release (3 dias)

Tras aprobar release, se activa hypercare operativo de **3 dias** (no 7):

1. Ejecutar smoke diario con `scripts/flow3-hypercare-daily.ps1`.
2. Guardar evidencia diaria en `artifacts/flow3-hypercare/`.
3. Monitorear eventos `ops_notification_channel_error` y `ops_notification_channel_unsupported`.
4. Si falla smoke o hay incidente CRITICAL sin mitigacion <= 30 min, activar rollback inmediato.

Referencias de operacion:

- Plan de hypercare: `docs/flow3-hypercare-3d.md`
- Validacion productiva por canal: `docs/flow3-production-validation.md`
- Simulacro de incidentes: `docs/flow3-incident-drill.md`
