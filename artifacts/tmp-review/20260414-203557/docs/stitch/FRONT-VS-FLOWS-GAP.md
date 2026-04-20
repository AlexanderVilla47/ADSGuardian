# GAP Front MVP vs Workflows n8n (F1/F2/F3)

Fecha de snapshot post-A2: 2026-04-13

## Estado consolidado A2

Referencias:

- Contrato API MVP: `docs/stitch/API-CONTRACT-MVP.md`
- Mapping endpoint por endpoint: `docs/stitch/API-CONTRACT-vs-FLOWS-MAPPING.md`
- Notas de implementacion A2: `docs/stitch/A2-IMPLEMENTATION-NOTES.md`

Resultado consolidado:

- LISTO: 2
- PARCIAL: 7
- NO: 1

## Snapshot por capacidad de Front

| Capacidad Front MVP | Estado A2 | Nota de cierre |
|---|---|---|
| Alta | LISTO | Implementable en F1 como en A1. |
| Consulta | PARCIAL | Sigue acotada a `dias_proximos`; falta consulta global avanzada. |
| Extension | LISTO | Implementada con reset preventiva. |
| Baja manual | PARCIAL | Rama nueva A2 en F1 versionada; runtime remoto aun no la ejerce (400). |
| Busqueda influencer con typo | NO | Sin implementacion en F1/F2/F3. |
| Listar ads por contrato | PARCIAL | Rama nueva A2 en F1 versionada; pendiente GREEN runtime. |
| Pausar ad individual | PARCIAL | Dispatch manual F1->F2 + precheck `ACTIVE` en F2 versionado; pendiente GREEN runtime. |
| Pausar todos activos | PARCIAL | `dry_run` + `confirm` + `batch_limit` en F1/F2 versionado; pendiente GREEN runtime. |
| Run manual | PARCIAL | Tracking y log A2 en F1 versionado; runtime remoto sigue 400 en probe. |
| Historial operativo | PARCIAL | Lectura paginada sobre `Operations_Log` versionada en F1; pendiente GREEN runtime. |

## Riesgos abiertos post-A2

1. Desalineacion repo/despliegue: cambios A2 locales no estan activos en endpoint remoto probado.
2. Sin `execution_id` real de A2 en runtime, no se puede cerrar PASS deterministico aun.
3. `influencers/search` sigue faltante y bloquea una parte del front MVP.

## Proximo bloque recomendado (A3)

1. Desplegar F1/F2 A2 y correr suite deterministica GREEN por accion (capturando `execution_id`).
2. Cerrar `GET /api/v1/influencers/search` (fuzzy + score + top N).
3. Completar consulta global de contratos (filtros + paginacion real).
4. Agregar endpoint de estado por `tracking_id` para operaciones asincronas.
