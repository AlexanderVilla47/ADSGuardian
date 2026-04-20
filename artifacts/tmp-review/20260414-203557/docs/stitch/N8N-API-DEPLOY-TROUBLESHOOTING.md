# Troubleshooting: n8n API Direct Deploy - AdsKiller

**Fecha**: 2026-04-14  
**Proyecto**: AdsKiller  
**Agent**: Sesión actual (awkward-orange-koi)

---

## Objetivo

Documentar los intentos de deploy por API directa (`PUT /api/v1/workflows/{id}`) para que el próximo agente pueda investigar y corregir la skill `n8n-api-direct-ops`.

---

## Lo que FUNCIONA ✅

| Operación | Endpoint | Resultado |
|------------|----------|-----------|
| Ejecutar workflow | `POST /webhook/{workflow_name}` | ✅ 200 OK, retorna execution_id |
| Leer historial | `POST /webhook/contract-ui-management-v2` con `action=history` | ✅ 200 OK, datos paginados |
| Listar workflows | `GET /api/v1/workflows` (sin auth) | ✅ 200 OK, solo conectividad/listado |

---

## Lo que NO FUNCIONA ❌

| Operación | Endpoint | Header usado | Error |
|-----------|----------|--------------|-------|
| GET workflow detail | `GET /api/v1/workflows/{id}` | `Authorization: Bearer <REDACTED_API_KEY>` | `401 unauthorized` |
| GET workflow detail | `GET /api/v1/workflows/{id}` | `X-N8N-API-KEY: <REDACTED_API_KEY>` | `401 unauthorized` |
| PUT update workflow | `PUT /api/v1/workflows/{id}` | `Authorization: Bearer <REDACTED_API_KEY>` | `401 unauthorized` |
| PUT update workflow | `PUT /api/v1/workflows/{id}` | `X-N8N-API-KEY: <REDACTED_API_KEY>` | `401 unauthorized` |

---

## Lo que INTENTÉ (orden cronológico)

### 1. Primer intento: Authorization Bearer

```powershell
Invoke-RestMethod -Method Get -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Headers @{Authorization="Bearer $env:N8N_API_KEY"}
```

**Resultado**: `401 unauthorized`

---

### 2. Segundo intento: X-N8N-API-KEY header

```powershell
Invoke-RestMethod -Method Get -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Headers @{ "X-N8N-API-KEY" = $env:N8N_API_KEY }
```

**Resultado**: `401 unauthorized`

---

### 3. Tercer intento: Verificar si el endpoint existe

```powershell
Invoke-WebRequest -Method Get -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows"
```

**Resultado**: `200 OK` — el endpoint existe y devuelve lista de workflows SIN autenticación

---

### 4. Cuarto intento: Verificar /healthz

```powershell
Invoke-WebRequest -Method Get -Uri "http://168.138.125.21.nip.io:5678/healthz"
```

**Resultado**: `200 OK` — n8n está levantado

---

### 5. Quinto intento: Probar con la misma API key que funciona en webhook

```powershell
# Esta API key funciona en el webhook:
$env:N8N_API_KEY = "<REDACTED_API_KEY>"

# Ejecutar webhook - FUNCIONA:
Invoke-WebRequest -Method Post -Uri "http://168.138.125.21.nip.io:5678/webhook/contract-ui-management-v2" -Body '{"action":"history"}'
# => 200 OK

# GET workflow - NO FUNCIONA:
Invoke-RestMethod -Method Get -Uri "http://168.138.125.21.nip.io:5678/api/v1/workflows/cFBr6GavlSWDsUFz" -Headers @{ "X-N8N-API-KEY" = $env:N8N_API_KEY }
# => 401 unauthorized
```

---

## Hipótesis

1. **La API key es de tipo "regular"**: Solo tiene permisos para ejecutar webhooks, no para admin de workflows
2. **Falta role/permission**: En n8n, las API keys pueden tener diferentes niveles de acceso (member, admin, etc.)
3. **El endpoint de API requiere auth diferente**: Puede que n8n tenga separado el auth de webhooks del auth de API REST
4. `GET /api/v1/workflows` solo prueba conectividad/listado; no demuestra permisos de escritura.

---

## Incidente de secretos

Se detectó exposición de secretos en documentación previa.

### Acción inmediata

1. Rotar la API key expuesta.
2. Invalidar cualquier token reutilizado en docs, logs o snippets.
3. Reemplazar todo secreto persistido por `<REDACTED_API_KEY>`.
4. Evitar reusar ejemplos con valores reales en futuros troubleshooting.

### Regla operativa

Si una key quedó escrita en una doc, se considera comprometida hasta rotación.

---

## siguiente paso para el próximo agente

### Investigar en n8n:

1. **Revisar roles de API keys**: En n8n → Settings → API → verificar qué permisos tiene la API key actual
2. **Crear API key de admin**: Generar nueva API key con permisos de "Admin" o "Workflows:write"
3. **Verificar si hay rate limiting**: Revisar si hay algún bloqueo por cantidad de requests

### Actualizar la skill:

1. Agregar troubleshooting de 401/403 en `n8n-api-direct-ops/SKILL.md`
2. Incluir checklist de verificación de permisos antes de hacer deploy
3. Documentar que el webhook auth NO es lo mismo que API auth

---

## Archivos relevantes

- Skill actual: `.agents/skills/n8n-api-direct-ops/SKILL.md`
- Runbook: `docs/runbook-n8n-api-directa-agentes.md`
- Credenciales usadas (en env vars de sesión):
  - `N8N_API_KEY=<REDACTED_API_KEY>`
  - `N8N_BASE_URL=http://168.138.125.21.nip.io:5678` (resuelve a IP del server)

---

## Código que QUERÍA deployar

El código siguiente está implementado en el repo local (`workflows/contract-ui-management-v2.json`) pero no está desplegado porque no pude hacer el PUT:

```javascript
// En nodo "Build History Response" (a2-build-history)
const paged = rows.slice(start, start + pageSize).map((row) => {
  const rawResult = String(row.status ?? row.result ?? '').toLowerCase().trim();
  const normalizedResult = (() => {
    const successValues = ['success', 'completed', 'done', 'ok'];
    const partialValues = ['accepted', 'queued', 'pending', 'running', 'in_progress'];
    const failedValues = ['error', 'failed', 'failure', 'cancelled'];
    if (successValues.includes(rawResult)) return 'SUCCESS';
    if (partialValues.includes(rawResult)) return 'PARTIAL';
    if (failedValues.includes(rawResult)) return 'FAILED';
    return 'NOT EXECUTED';
  })();
  return { 
    execution_id: String(row.execution_id ?? ''), 
    tracking_id: String(row.tracking_id ?? ''), 
    correlation_id: String(row.correlation_id ?? ''), 
    action: String(row.action ?? ''), 
    run_mode: String(row.run_mode ?? ''), 
    result: String(row.status ?? row.result ?? ''), 
    normalized_result: normalizedResult,  // <-- NUEVO CAMPO
    actor: String(row.actor ?? ''), 
    executed_at: String(row.requested_at ?? row.timestamp ?? row.executed_at ?? '') 
  };
});
```

---

## Evidencia de test

 Actualmente el workflow responde SIN el campo `normalized_result`:

```json
{
  "ok": true,
  "data": {
    "items": [
      { "result": "error", "normalized_result": "" },
      { "result": "success", "normalized_result": "" }
    ]
  }
}
```

Después del deploy debería responder:

```json
{
  "ok": true,
  "data": {
    "items": [
      { "result": "error", "normalized_result": "FAILED" },
      { "result": "success", "normalized_result": "SUCCESS" }
    ]
  }
}
```
