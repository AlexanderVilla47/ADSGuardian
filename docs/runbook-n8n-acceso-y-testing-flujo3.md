# Runbook operativo: acceso n8n y testing deterministico (Flujo 3)

## Estado actual y alcance

- Estado vigente: acceso a API de n8n confirmado en esta sesion.
- Alcance de este runbook: preflight de acceso, recuperacion ante fallas de API y validacion operativa del flujo objetivo.
- Audiencia: operadores no tecnicos con necesidad de ejecutar checks rapidos y escalar con evidencia clara.

## Configuracion canonica (sin secretos)

- Base API: `http://168.138.125.21:5678/api/v1`
- Auth: `N8N_API_KEY` enviada en header `X-N8N-API-KEY`
- `N8N_MCP_TOKEN`: legacy/deprecado para Flow3 (no usar para `/api/v1`)
- Workflow objetivo: `BFHHQwYFfmcpqshb`
- Cadena interna productiva: `cFBr6GavlSWDsUFz -> 8mlwAxLtJVrwpLhi -> BFHHQwYFfmcpqshb`
- Ingreso de cadena (F1 v2): `POST /webhook/contract-ui-management-v2`
- Webhook operativo: `POST /webhook/ops-reporting-alerts`

## Preflight obligatorio (antes de testear o diagnosticar)

1. Confirmar conectividad de red al host `168.138.125.21` y puerto `5678`.
2. Verificar que `N8N_API_KEY` este cargada por variable de entorno (no pegar en consola).
3. Ejecutar un check simple a la API para validar autenticacion y disponibilidad.
4. Confirmar que responde con codigo `200` y JSON valido.
5. Si falla, no continuar con testing funcional: pasar al arbol de diagnostico.

Comando de ejemplo (PowerShell):

```powershell
$headers = @{ "X-N8N-API-KEY" = $env:N8N_API_KEY }
Invoke-RestMethod -Method GET -Uri "http://168.138.125.21:5678/api/v1/workflows/BFHHQwYFfmcpqshb" -Headers $headers
```

Resultado esperado:

- Respuesta HTTP `200`.
- Se obtiene metadata del workflow `BFHHQwYFfmcpqshb`.

## Protocolo deterministico de testing

- Regla principal: el veredicto (PASS/FAIL) se decide solo con la ultima `execution_id` posterior al ultimo fix/cambio.
- Prohibido mezclar evidencia de ejecuciones historicas para justificar un resultado.
- Si la ultima ejecucion no llega al nodo objetivo, el estado obligatorio es `NO EJERCITADO`.
- Secuencia recomendada: `RED -> FIX -> GREEN`, con evidencia minima por cada corrida.
- Para cadena interna, validar que F3 reciba `correlation_id` y que ejecute al menos un nodo de envio/log.

## Arbol de diagnostico: falla de acceso API

### Caso 401 Unauthorized

- Verificar que el header sea exactamente `X-N8N-API-KEY`.
- No mezclar `Authorization: Bearer` ni `api-key` para endpoints `/api/v1` de este flujo.
- Confirmar que la key no este vacia, truncada o expirada.
- Rotar/reemitir credencial segun procedimiento interno y repetir preflight.

### Caso 403 Forbidden

- Verificar permisos de la API key para leer/ejecutar workflows.
- Confirmar que el entorno consultado sea el correcto (host y ruta de API).
- Si persiste, escalar con evidencia de request (sin secretos).

### Caso timeout / sin respuesta

- Validar conectividad de red y reachability al puerto `5678`.
- Reintentar en una segunda ventana de 2 a 5 minutos.
- Si sigue fallando, tratar como incidente de infraestructura y escalar.

## Arbol de diagnostico: falla Telegram (`401 Unauthorized`)

- Verificar token del bot en credenciales de n8n (no en texto plano en nodos).
- Confirmar que no se este usando un bot/token viejo tras rotacion.
- Ejecutar prueba aislada del nodo Telegram con mensaje corto de control.
- Si el `401` persiste, regenerar token en BotFather, actualizar credencial y revalidar.

## Checklist de inicio de sesion futura

- Confirmar hora/zona operativa: `America/Argentina/Buenos_Aires`.
- Ejecutar preflight API antes de cualquier prueba funcional.
- Verificar workflow objetivo `BFHHQwYFfmcpqshb`.
- Confirmar endpoint webhook `POST /webhook/ops-reporting-alerts`.
- Revisar `test.json` para no repetir evidencia ya registrada.
- Aplicar protocolo deterministico: usar solo ultima `execution_id` post-fix.
- Si hay error de acceso o Telegram, seguir arbol de diagnostico y escalar con evidencia.

## Seguridad

- No pegar API keys, tokens ni secretos en logs, issues o chats.
- Usar fingerprints para referenciar credenciales (ejemplo: `key_***A1B2`).
- Compartir evidencia operativa minimizada: codigo HTTP, timestamp, endpoint y `execution_id`.
- Sanitizar capturas antes de adjuntarlas (ocultar headers sensibles).
