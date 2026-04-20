# AdsKiller - Evidencia hardening Flujo 2 (AK-TC-09)

Fecha: `2026-04-12`
Workflow: `8mlwAxLtJVrwpLhi` (`contract-guard-daily-killswitch`)

## 1) Preflight de acceso remoto

- `GET /healthz` -> `200`
- `GET /api/v1/workflows?limit=1` -> `401`
- `GET /api/v1/executions?limit=1` -> `401`

Resultado: sin API key activa para `api/v1`, no se puede disparar corrida ni leer `execution_id` post-fix.

## 2) Evidencia de hardening aplicado en artefacto del workflow

Archivo: `workflows/contract-guard-daily-killswitch.json`

- `Meta - Precheck Estado Ad`
  - URL: `https://graph.facebook.com/v20.0/{Ad_ID}`
  - Auth: `predefinedCredentialType` + `httpHeaderAuth`
  - Credencial: `Meta Ads API (Bearer)` (`id` placeholder: `__REPLACE_WITH_META_HTTP_HEADER_AUTH_ID__`)
- `Meta - Pausar Ad`
  - URL: `https://graph.facebook.com/v20.0/{Ad_ID}`
  - Body: `status=PAUSED`
  - Auth: credencial n8n `httpHeaderAuth`
- `Meta - Postcheck Estado Ad` (nuevo)
  - URL: `https://graph.facebook.com/v20.0/{Ad_ID}`
  - Auth: credencial n8n `httpHeaderAuth`
  - Fields: `effective_status,name`
- `Wait 5m Precheck Retry`: `amount=5`, `unit=minutes`
- `Wait 5m Pausa Retry`: `amount=5`, `unit=minutes`
- Gating de finalización:
  - rama `success` de `Rutear Resultado Pausa` -> `Meta - Postcheck Estado Ad`
  - `Finalizado Payload Valido` exige:
    1. `pause_state=success`
    2. `postcheck_state=confirmed_paused`
    3. `Contrato_ID` no vacío

## 3) Validación determinística por caso (regla: última ejecución post-fix)

Estado del gate determinístico: sin `execution_id` nueva posterior al fix por bloqueo `401`.

| Caso | Última execution_id post-fix | Veredicto | Motivo |
|---|---|---|---|
| Happy path (`ACTIVE -> pause -> PAUSED -> Finalizado`) | N/A (bloqueado) | `NO EJERCITADO` | No se pudo ejecutar corrida manual por falta de acceso `api/v1` |
| Error controlado (`sin PAUSED no finaliza`) | N/A (bloqueado) | `NO EJERCITADO` | No hay ejecución post-fix para verificar rama de post-check fallido |

## 4) Acción externa requerida para cierre AK-TC-09

1. Proveer API key de n8n con permiso de lectura/ejecución (`X-N8N-API-KEY`) para la instancia remota.
2. Crear o seleccionar credencial n8n `httpHeaderAuth` para Meta con nombre `Meta Ads API (Bearer)` y asignarla en:
   - `Meta - Precheck Estado Ad`
   - `Meta - Pausar Ad`
   - `Meta - Postcheck Estado Ad`
3. Ejecutar 2 corridas manuales controladas y compartir `execution_id`:
   - Caso A: `ACTIVE -> pause 2xx -> post-check PAUSED -> Finalizado`
   - Caso B: post-check sin `PAUSED` -> no finaliza + alerta crítica
