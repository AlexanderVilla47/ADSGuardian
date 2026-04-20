# Evidencia de cierre post-recreacion F1(v2) -> F2 -> F3 (full-real)

Fecha: 2026-04-13

## Alcance

- Objetivo probado: cadena interna `cFBr6GavlSWDsUFz -> 8mlwAxLtJVrwpLhi -> BFHHQwYFfmcpqshb`
- Tipo de prueba: full-real integrada (1 corrida controlada)
- Caso ejecutado: `alta` (camino feliz esperado)

## Correlation y entradas

- Correlation de entrada F1: `ak-closeout-alta-20260413133848`
- Correlation observada en cadena interna F2/F3: `ak-f2-1776098335128-d8i7jq`
- Logical execution enviado a F1: `ak-closeout-alta-20260413133848:f1:alta`

## Evidencia deterministica (ultima corrida evaluada)

- F1 (nuevo): `cFBr6GavlSWDsUFz`
  - `execution_id`: `850`
  - `status`: `error`
  - Nodos clave alcanzados: `Build Internal Payload F1->F2`, `Execute F2 Internal`, `Log F1 Chain Dispatch OK`
  - Nodo de falla en rama funcional UI: `GS Append Alta` (error: `access to env vars denied`)

- F2: `8mlwAxLtJVrwpLhi`
  - `execution_id`: `851`
  - `status`: `success`
  - Nodos clave: `Build F2->F3 Canonical Summary`, `Execute F3 Internal`, `Log_F2_F3_Dispatch_OK`

- F3: `BFHHQwYFfmcpqshb`
  - `execution_id`: `854`
  - `status`: `success`
  - Nodos clave: `Normalize_InternalExecuteTrigger`, `Normalize_Payload`, `Log_ChannelSendFailure`

## Veredicto final

- Estado: `FAIL`
- Motivo: la corrida integrada NO cumple happy path completo porque F1 finaliza en `error` aunque el encadenamiento interno hacia F2/F3 se completa.
- Regla aplicada: veredicto emitido solo con la ultima `execution_id` posterior al ultimo cambio relevante (`850/851/854`), sin mezclar historico.

## Observaciones operativas

- El encadenamiento interno F1->F2 y F2->F3 esta conectado y activo.
- Existe drift de correlacion entre entrada F1 y correlacion canonica de F2/F3.
- Para cerrar en `PASS`, F1 debe resolver la restriccion de variables de entorno en la rama UI (`GS Append Alta`).
