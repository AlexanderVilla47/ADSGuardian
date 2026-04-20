# Flow3 incident drill

Workflow objetivo: `BFHHQwYFfmcpqshb`

Fecha de simulacro: `2026-04-12`

## Objetivo

Ejecutar simulacro operativo de incidentes para:

1. `ops_notification_channel_error`
2. `ops_notification_channel_unsupported`

con tiempos objetivo y criterios de salida.

## SLA operativo esperado

- `P1` (`severity=CRITICAL`): ack <= 10 min, mitigacion <= 30 min.
- `P2`: ack <= 30 min, mitigacion <= 4 h.

Referencia: `docs/ops-alerting-flow3.md`.

## Escenario A: channel_error

- Tipo: simulacro dirigido (credencial de canal invalida o canal no disponible).
- Evento esperado: `ops_notification_channel_error`.
- Severidad esperada: `P1` para CRITICAL.

### Timeline del simulacro

| Timestamp (ART) | Hito | Objetivo |
|---|---|---|
| T0 | Disparo controlado caso channel_error | generar evidencia de falla de canal |
| T0 + 5m | ACK on-call | <= 10 min |
| T0 + 20m | Mitigacion aplicada | <= 30 min |
| T0 + 30m | Revalidacion smoke | 4/4 GREEN o rollback |

Outcome esperado:

- incidente clasificado correctamente,
- evidencias capturadas (`execution_id`, `correlation_id`, `event`, `channel`, `timestamp`),
- mitigacion dentro de SLA o rollback ejecutado.

## Escenario B: unsupported

- Tipo: simulacro dirigido (payload con `notification.channel=email`).
- Evento esperado: `ops_notification_channel_unsupported`.
- Severidad esperada: `P2`.

### Timeline del simulacro

| Timestamp (ART) | Hito | Objetivo |
|---|---|---|
| T0 | Disparo controlado canal invalido | validar contrato de entrada |
| T0 + 10m | ACK on-call | <= 30 min |
| T0 + 60m | Correccion de emisor | <= 4 h |
| T0 + 90m | Revalidacion del caso | sin nuevo unsupported |

Outcome esperado:

- correccion del emisor de payload,
- no hay intento de envio por canales soportados cuando el canal es invalido,
- evidencia registrada y cierre operativo.

## Estado de ejecucion en esta sesion

- Preparado y documentado: **DONE**.
- Ejecucion real con lectura de trazas por API: **BLOCKED** (faltante `N8N_API_KEY` valida; API `401`).

## Checklist de cierre del simulacro

1. Evidencia minima completa por incidente.
2. Cumplimiento de SLA objetivo o justificacion documentada.
3. Revalidacion post-mitigacion con `scripts/flow3-smoke-regression.ps1`.
4. Si falla smoke, activar rollback segun `docs/release-criteria-flow3.md`.
