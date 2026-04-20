# Flow3 hypercare 3 dias

Workflow objetivo: `BFHHQwYFfmcpqshb`

Ventana de hypercare: **3 dias** posteriores al cutover.

## Objetivo

Reducir riesgo post-release con monitoreo activo, smoke diario y criterio de rollback explicito.

## Plan operativo por dia

## Dia 1 (estabilizacion)

- Ejecutar `scripts/flow3-hypercare-daily.ps1` al inicio de turno.
- Revisar eventos `ops_notification_channel_error` y `ops_notification_channel_unsupported`.
- Confirmar que no haya drift de contrato de entrada (`docs/flow3-input-contract.md`).
- Si aparece incidente P1, priorizar mitigacion y considerar rollback inmediato.

## Dia 2 (consistencia)

- Repetir smoke diario y guardar evidencia en `artifacts/flow3-hypercare/`.
- Verificar tendencia de errores por canal (sin crecimiento sostenido).
- Validar trazabilidad de `execution_id`/`correlation_id` en muestras del dia.

## Dia 3 (cierre)

- Ejecutar smoke diario final.
- Confirmar 72h sin incidente critico abierto de canal.
- Emitir acta de cierre de hypercare con decision final: cerrar o extender.

## Criterios de cierre de hypercare

Se cierra hypercare solo si se cumplen todos:

1. Smoke diario GREEN durante los 3 dias.
2. Sin incidentes P1 abiertos al cierre del dia 3.
3. Sin aumento sostenido de `ops_notification_channel_unsupported`.
4. Evidencia diaria archivada en `artifacts/flow3-hypercare/`.

## Criterios de rollback durante hypercare

Activar rollback al baseline estable (`flow3-notifications-v1.0-green.json`) si ocurre cualquiera:

1. Falla smoke en una validacion diaria y no se recupera en ventana operativa.
2. `ops_notification_channel_error` CRITICAL sin mitigacion <= 30 min.
3. Error de contrato con impacto sostenido (`unsupported`) en origen no corregido.

## Ejecucion programable

Script operativo diario:

- `scripts/flow3-hypercare-daily.ps1`

Salida esperada por corrida:

- `artifacts/flow3-hypercare/flow3-hypercare-YYYYMMDD-HHMMSS.log`
- `artifacts/flow3-hypercare/flow3-hypercare-YYYYMMDD-HHMMSS.json`
- `artifacts/flow3-hypercare/flow3-hypercare-YYYYMMDD-HHMMSS.md`

Ejemplo de scheduler en Windows (diario 09:00):

```powershell
schtasks /Create /SC DAILY /TN "AdsKiller-Flow3-Hypercare" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\scripts\flow3-hypercare-daily.ps1" /ST 09:00
```
