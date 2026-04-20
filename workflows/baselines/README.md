# Baselines de workflows (Flow1 y Flow3)

Este directorio guarda snapshots versionados de workflows productivos para controlar regresiones.

- Flow1 actual: `contract-ui-management-v2` (`cFBr6GavlSWDsUFz`)
- Flow3 actual: `AdsKiller - Ops Reporting & Alerts (MVP)` (`BFHHQwYFfmcpqshb`)

## Convencion de versionado

- Nombre recomendado: `flow<numero>-<nombre>-<workflowId>-v<MAJOR>.<MINOR>(-<estado>).json`
- Ejemplos actuales:
  - `flow1-contract-ui-management-v2-cFBr6GavlSWDsUFz-v1.0.json`
  - `flow3-notifications-v1.0-green.json`
- Reglas:
  - `MAJOR`: cambio incompatible en ruteo, contratos o nodos clave.
  - `MINOR`: ajuste compatible (mensajes, validaciones, observabilidad).
  - `estado`: `green` solo si la suite smoke de 4 casos pasa completa.

## Como actualizar baseline

1. Exportar workflow actual desde n8n API (`/api/v1/workflows/<WORKFLOW_ID>`).
2. Sanitizar secretos antes de guardar:
   - API keys, tokens, passwords, secretos.
   - URLs de webhook con credenciales embebidas.
3. Guardar nuevo archivo en este directorio con version semantica.
4. Ejecutar `scripts/flow3-smoke-regression.ps1` y confirmar 4/4 en GREEN.
5. Registrar evidencia de corrida (execution_id por caso + timestamp) en release docs.

## Politica operativa

- Nunca reemplazar en caliente el baseline anterior: siempre agregar nueva version.
- Si una corrida smoke falla, no publicar baseline con sufijo `green`.
- El baseline vigente de release debe ser el ultimo archivo `*-green.json`.
