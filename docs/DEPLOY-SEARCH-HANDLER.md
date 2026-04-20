# Deploy Search Handler - Instrucciones para Agente

## Estado Actual

1. ✅ 9 nodos Google Sheets tienen Service Account (credentials + authentication)
2. ✅ "search" está en allowed actions del Validate Input
3. ⚠️ Switch tiene caso para search pero SIN handler implementado

## Lo que FALTA - Implementar Search Handler

### Paso 1: Agregar 3 nodos nuevos

**Nodo 1: GS Read For Search**
- Type: n8n-nodes-base.googleSheets
- Operation: read
- Document ID: 1RKQ05Zy6beCwCr_mT95eVSgeOqQTAfTA_9kaYX1XJoY
- Sheet: Contratos
- Authentication: serviceAccount
- Position: después de GS Read Contratos

**Nodo 2: Filter Search Results**  
- Type: n8n-nodes-base.code (JavaScript)
```javascript
const query = String($items('Validate Input', 0, 0)[0].json.q ?? '').toLowerCase();
const results = items.filter(item => {
  const cliente = String(item.json.Cliente ?? '').toLowerCase();
  return cliente.includes(query);
});
return results;
```
- Position: después de GS Read For Search

**Nodo 3: Respond Search**
- Type: n8n-nodes-base.respondToWebhook  
- Response: JSON
- Body:
```json
{
  "ok": true,
  "action": "search",
  "query": "{{$items('Validate Input',0,0)[0].json.q}}",
  "total": "{{$items('Filter Search Results').length}}",
  "data": "{{$items('Filter Search Results').map(item => item.json)}}"
}
```
- Position: después de Filter Search Results

### Paso 2: Conectar los nodos

- Switch (caso search) → GS Read For Search
- GS Read For Search → Filter Search Results  
- Filter Search Results → Respond Search

## API para deployar

URL: `http://168.138.125.21:5678/api/v1/workflows/cFBr6GavlSWDsUFz`
Method: PUT
Header: `X-N8N-API-KEY: <REDACTED_API_KEY>`

## Test de validación

```bash
curl -X POST "http://168.138.125.21.nip.io:5678/webhook/contract-ui-management-v2" \
  -H "Content-Type: application/json" \
  -d '{"action":"search","q":"camila"}'
```

Respuesta esperada:
```json
{
  "ok": true,
  "action": "search", 
  "query": "camila",
  "total": 2,
  "data": [...]
}
```

---

## Notas técnicas

- Las credenciales usan formato: `credentials: {googleApi: {}}`
- Authentication en parameters: `authentication: "serviceAccount"`
- Error com�n del API: "request/body must NOT have additional properties" 
  - Soluci�n: usar payload m�nimo con solo nodes + connections + settings

## Incidente de secretos

Si un token real quedó expuesto en esta guía:

1. Rotarlo de inmediato.
2. Sustituirlo por `<REDACTED_API_KEY>`.
3. Revalidar el deploy con credenciales nuevas antes de seguir.
