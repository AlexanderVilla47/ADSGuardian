# Flow3 production validation

Workflow objetivo: `BFHHQwYFfmcpqshb`

Fecha de corte: `2026-04-12`

## Objetivo

Validar trazabilidad productiva de canales `slack`, `telegram` y `both` con `execution_id` + `correlation_id`.

## Evidencia consolidada disponible

Ultima corrida smoke GREEN reportada:

- `681` telegram: PASS
- `682` slack: PASS
- `683` both: PASS
- `684` unsupported: PASS

Fuente: `docs/release-evidence-flow3-20260412.md`.

## Intento de validacion directa por API en esta sesion

- Endpoint: `GET /api/v1/workflows/BFHHQwYFfmcpqshb`
- Resultado: `401 Unauthorized`
- Metodos probados: `Authorization: Bearer <fingerprint>` y `X-N8N-API-KEY: <fingerprint>` usando credencial legacy de sesion.
- Conclusion: sin `N8N_API_KEY` valida no se puede extraer en esta sesion el detalle de `correlation_id`/timestamps desde `executions`.

Fingerprint usado (sin exponer secreto): `N8N_MCP_TOKEN` `eyJhbG...iQ` (longitud total ocultada).

## Estado de validacion por canal

| Canal | Ultima evidencia de ejecucion | Resultado | Trazabilidad execution_id | Trazabilidad correlation_id |
|---|---:|---|---|---|
| telegram | 681 | PASS | OK | BLOCKED (API 401 en sesion) |
| slack | 682 | PASS | OK | BLOCKED (API 401 en sesion) |
| both | 683 | PASS | OK | BLOCKED (API 401 en sesion) |

## Cierre operativo requerido para completar trazabilidad

1. Exportar `N8N_API_KEY` operativa del entorno productivo (no en texto plano).
2. Re-ejecutar `scripts/flow3-smoke-regression.ps1` o consulta puntual de `executions/{id}?includeData=true`.
3. Registrar para cada canal: `execution_id`, `correlation_id`, `startedAt`, `stoppedAt`, outcome.
4. Actualizar este documento retirando estado `BLOCKED`.
