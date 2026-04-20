# A2 - API Contract MVP vs F1/F2/F3 Mapping

Fecha: 2026-04-13

Referencias base:

- Contrato API A2: `docs/stitch/API-CONTRACT-MVP.md`
- F1: `workflows/contract-ui-management-v2.json` (`cFBr6GavlSWDsUFz`)
- F2: `workflows/contract-guard-daily-killswitch.json` (`8mlwAxLtJVrwpLhi`)
- F3: `workflows/ops-reporting-alerts.json` (`BFHHQwYFfmcpqshb`)
- Evidencia de probe A2: `test.json`

## Matriz endpoint por endpoint (snapshot post-A2)

| Endpoint (MVP) | Estado A2 | Evidencia repo/workflow | Bloqueo runtime actual |
|---|---|---|---|
| `POST /api/v1/contracts` (alta) | LISTO | F1 `Validate Input` + `Prepare Alta Row` + `GS Append Alta` + `Respond Alta`. | Sin bloqueo reportado en este bloque. |
| `GET /api/v1/contracts` (consulta) | PARCIAL | F1 `consulta` por `dias_proximos` sigue vigente, sin filtros globales completos. | No aplica a A2. |
| `PATCH /api/v1/contracts/{contract_id}/extend` | LISTO | F1 `Prepare Extension Row` + `GS Update Extension` + `Respond Extension`. | Sin bloqueo reportado en este bloque. |
| `PATCH /api/v1/contracts/{contract_id}/finalize` (`baja_manual`) | PARCIAL | Branch F1 desplegado y ejercitado: `GS Read For Baja` -> `Prepare Baja Row` -> `GS Update Baja` -> `Respond Baja Manual`. Ultima ejecucion F1: `933`. | Falla de runtime en `GS Read For Baja`: `ExpressionError` `access to env vars denied` al resolver `$env.GSHEET_CONTRATOS_DOC_ID`. |
| `GET /api/v1/influencers/search?q=` | NO | Sin nodos en F1/F2/F3 para fuzzy search. | Gap funcional vigente. |
| `GET /api/v1/contracts/{contract_id}/ads` (`listar_ads`) | PARCIAL | Branch F1 desplegado y ejercitado: `GS Read For Listar Ads` -> `Build Listar Ads Response` -> `Respond Listar Ads`. Ultima ejecucion F1: `936`. | Falla de runtime en `GS Read For Listar Ads`: `ExpressionError` `access to env vars denied` al resolver `$env.GSHEET_CONTRATOS_DOC_ID`. |
| `POST /api/v1/ads/{ad_id}/pause` (`pause_ad`) | PARCIAL | Evidencia A2-P3: F1 webhook acepta request (`execution_id` `919`) y despacha F2 (`execution_id` `920`); en F2 corren `Meta_Check_Precheck_Estado_Ad` + `Pause_Meta_Pausar_Ad`. | No quedo GREEN manual deterministico por `Ad_ID` solicitado: en `execution_id` `920` no aparece el `Ad_ID` pedido y se proceso contrato vencido `CTR-9001` con `run_mode=scheduled`. |
| `POST /api/v1/ads/pause-active` (`pause_active`) | PARCIAL | Guardrails activos en F1: `dry_run` + `confirm` + `batch_limit` (1..100) y preview en `Build Pause Active Preview`. | A2-P3 deja blueprint ejecutable para migrar a `dry_run` + `confirm_token` + `max_batch_size`; implementacion runtime pendiente. |
| `POST /api/v1/operations/run-now` | LISTO | F1 acepta `action=run_now`, responde `202` con `execution_id` y dispara F2 interno (`Execute F2 Internal`). | Sin bloqueo funcional en corrida A2-P1 (`execution_id` F1: `934`, F2: `935`). |
| `GET /api/v1/operations/history` | PARCIAL | F1 acepta `action=history`, enruta a `GS Read Operations History` y aplica filtros/paginacion (`from/to/result/run_mode/execution_id/page/page_size`). | La corrida llega al nodo de historia pero cae por `access to env vars denied` (F1 `execution_id`: `940`). |

## Snapshot cuantitativo A2

- LISTO: 2 endpoints
- PARCIAL: 7 endpoints
- NO: 1 endpoint

## Bloqueos y observaciones

1. En A2-P1, `run_now` quedo operativo en runtime remoto (`202` + dispatch interno F2 confirmado).
2. `history` todavia no cierra GREEN: la ejecucion entra al branch correcto pero falla por restriccion de env vars en runtime (`access to env vars denied`).
3. A2-P2: `baja_manual` (`execution_id` `933`) y `listar_ads` (`execution_id` `936`) tambien enrutan al nodo objetivo, pero fallan por la misma restriccion de env vars.
4. A2-P3: `pause_ad` dejo evidencia de dispatch y pipeline F2 ejercitado (`919` -> `920`), pero el caso manual por `Ad_ID` puntual sigue `NO EJERCITADO` segun regla deterministica (no aparece el `Ad_ID` pedido en la ultima corrida).
5. `pause_active` requiere hardening operativo de confirmacion por token; hoy la confirmacion es booleana (`confirm=true`).
6. F2 mantiene waits de retry en 5 minutos (`Wait 5m Precheck Retry`, `Wait 5m Pausa Retry`).
