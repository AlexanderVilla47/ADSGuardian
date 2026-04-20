# Alerting operativo Flow3 (sin infraestructura nueva)

Workflow objetivo: `BFHHQwYFfmcpqshb` (flow3 notifications)

Este documento formaliza reglas de alerta usando eventos ya emitidos por el workflow.

## Eventos a monitorear

### 1) `ops_notification_channel_error`

- Significado: intento de envio a Slack o Telegram fallo.
- Origen esperado: nodo `Log Channel Send Failure`.
- Severidad:
  - `P1` si `severity=CRITICAL` en el evento.
  - `P2` para resto de casos (`WARN`/`INFO` heredado del flujo).
- Umbral operativo:
  - `P1`: alertar inmediato en el primer evento.
  - `P2`: alertar si hay 2 o mas eventos en 15 minutos.

### 2) `ops_notification_channel_unsupported`

- Significado: se pidio un canal no soportado por MVP.
- Origen esperado: nodo `Log Unsupported Channel`.
- Severidad:
  - `P2` siempre (problema de contrato/entrada).
- Umbral operativo:
  - alertar en el primer evento.

## Campos minimos esperados (observabilidad)

Para ambos eventos se espera payload con:

- `event`
- `channel`
- `severity`
- `correlation_id`
- `execution_id`
- `message`
- `timestamp`

Si falta alguno de estos campos, tratar como desviacion de observabilidad y abrir tarea correctiva.

## Duenos y tiempos objetivo

- Dueño primario: Operacion AdsKiller (on-call).
- Dueño secundario: Responsable de workflows n8n del equipo.
- Tiempos objetivo:
  - `P1`: ack <= 10 min, mitigacion <= 30 min.
  - `P2`: ack <= 30 min, mitigacion <= 4 h.

## Acciones por tipo de alerta

### `ops_notification_channel_error`

1. Confirmar `execution_id` y `correlation_id` del evento.
2. Revisar nodo de envio correspondiente (Slack o Telegram) en esa ejecucion.
3. Validar credencial/config del canal y conectividad saliente.
4. Ejecutar smoke regression de Flow3 para confirmar estado post-fix.
5. Registrar incidente y cierre con evidencia minima.

### `ops_notification_channel_unsupported`

1. Confirmar `channel` recibido (ejemplo: `both`, `email`, etc).
2. Verificar origen del payload que envio canal invalido.
3. Corregir emisor para usar solo `slack` o `telegram`.
4. Reejecutar caso y confirmar que no vuelve a emitir unsupported.

## Playbook corto (respuesta rapida)

1. Identificar severidad (P1/P2) con reglas de arriba.
2. Capturar evidencia: `event`, `channel`, `execution_id`, `correlation_id`, `timestamp`.
3. Aplicar correccion minima de canal/config.
4. Validar con `scripts/flow3-smoke-regression.ps1`.
5. Cerrar incidente solo con corrida 4/4 GREEN.
