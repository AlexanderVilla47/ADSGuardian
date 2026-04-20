# Flow3 input contract

Workflow objetivo: `BFHHQwYFfmcpqshb`

## Objetivo

Formalizar el contrato de entrada para notificaciones Flow3, cerrando canales permitidos y manejo de invalidos.

## Campos minimos obligatorios

- `execution_id` (string no vacio)
- `correlation_id` (string no vacio)
- `execution_mode` (string; recomendado: `manual` o `scheduled`)
- `executed_at` (ISO-8601 UTC)
- `timezone` (debe ser `America/Argentina/Buenos_Aires` para operacion)
- `execution_status` (string)
- `notification.channel` (enum cerrado)

## Enum cerrado de canales permitidos

`notification.channel` solo acepta:

- `slack`
- `telegram`
- `both`

Cualquier otro valor se trata como no soportado.

## Comportamiento esperado por canal

- `slack`: intenta envio por Slack.
- `telegram`: intenta envio por Telegram.
- `both`: intenta fan-out por Slack y Telegram en la misma ejecucion.
- `invalid`: no intenta envio a canales soportados y emite evento `ops_notification_channel_unsupported`.

## Reglas de validacion de entrada

1. `notification` debe existir.
2. `notification.channel` debe existir y ser string.
3. `notification.channel` se normaliza a lowercase antes de evaluar.
4. Si el valor no pertenece al enum permitido, se deriva al branch unsupported.

## Ejemplos validos

```json
{
  "execution_id": "flow3-cutover-20260412-001",
  "correlation_id": "corr-flow3-cutover-001",
  "execution_mode": "manual",
  "executed_at": "2026-04-12T23:00:00Z",
  "timezone": "America/Argentina/Buenos_Aires",
  "execution_status": "error",
  "notification": {
    "channel": "slack"
  }
}
```

```json
{
  "execution_id": "flow3-cutover-20260412-002",
  "correlation_id": "corr-flow3-cutover-002",
  "execution_mode": "manual",
  "executed_at": "2026-04-12T23:05:00Z",
  "timezone": "America/Argentina/Buenos_Aires",
  "execution_status": "error",
  "notification": {
    "channel": "both"
  }
}
```

## Ejemplos invalidos

```json
{
  "execution_id": "flow3-cutover-20260412-003",
  "correlation_id": "corr-flow3-cutover-003",
  "notification": {
    "channel": "email"
  }
}
```

Resultado esperado: evento `ops_notification_channel_unsupported` con `channel=email` y sin intento de envio soportado.

```json
{
  "execution_id": "flow3-cutover-20260412-004",
  "correlation_id": "corr-flow3-cutover-004",
  "notification": {
    "channel": 123
  }
}
```

Resultado esperado: invalidacion de contrato (tipo incorrecto) y branch unsupported/error controlado segun implementacion activa.
