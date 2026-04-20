# Manual pause contract v2 (frontend ↔ F1 ↔ mock)

## Objetivo

Evitar falso positivo de UI (`accepted/queued` != `paused`) y mantener contrato compatible con migración futura a Meta real.

## `pause_ad` (respuesta inicial)

`action=pause_ad` responde asíncrono:

```json
{
  "ok": true,
  "data": {
    "accepted": true,
    "status": "queued",
    "tracking_id": "trk-...",
    "correlation_id": "ak-ui-...",
    "target": {
      "contract_id": "CTR-...",
      "ad_id": "123..."
    },
    "meta_patch": {
      "method": "PATCH",
      "path": "/v23.0/123...",
      "body": { "status": "PAUSED" },
      "version": "v1"
    }
  }
}
```

## Consulta de estado operativo

- Front consulta estado operativo por `tracking_id` usando historial (`action=history`) y filtro por correlación.
- Mientras no exista resultado final: UI muestra **En cola/Procesando**.
- Estados finales visibles: `paused`, `already_paused`, `failed`.

## Mock único para pausa manual

- Fuente de verdad mock: `workflows/adskiller-meta-mock-gsheet.json`.
- La pausa actualiza `Mock_Ads.status=PAUSED` por `ad_id` exacto.
- `workflows/local-meta-testing-simulator.json` queda **DEPRECATED** para regresión de laboratorio, no para veredicto operativo.
