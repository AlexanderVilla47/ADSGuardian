# Workflow: `contract-ui-management`

Workflow n8n para gestión operativa desde UI con acciones:

- `alta`
- `consulta`
- `extension`

Enfocado en MVP de AdsKiller, persistiendo contratos en Google Sheets y respetando reglas de fecha (`YYYY-MM-DD`) y operación en timezone `America/Argentina/Buenos_Aires`.

---

## 1) Objetivo

Exponer un endpoint HTTP (Webhook) que permita a la UI:

1. Dar de alta contratos.
2. Consultar contratos próximos a vencer (ventana configurable, default 7 días).
3. Extender un contrato existente actualizando `Fecha_Fin` y reseteando `Notificado_Previo=false`.

---

## 2) Archivo exportable

- `workflows/contract-ui-management.json`

Importable en n8n como workflow único.

---

## 3) Trigger y enrutamiento

- **Trigger**: `Webhook UI` (POST `/contract-ui-management`)
- **Nodo de validación**: `Validate Input` (Code node)
- **Router**: `Route Action` (Switch) por `action`

Acciones soportadas:

- `alta`
- `consulta`
- `extension`

Si `action` no coincide, el workflow falla por validación.

---

## 4) Contrato de datos

## 4.1 Entrada base

```json
{
  "action": "alta | consulta | extension"
}
```

## 4.2 Entrada `alta`

Campos requeridos:

- `Contrato_ID` (string)
- `Cliente` (string)
- `Regex_Anuncio` (string)
- `Fecha_Fin` (string `YYYY-MM-DD`)

Campos opcionales:

- `Fecha_Alta` (si no viene, usa fecha actual en timezone del negocio)
- `Status_Contrato` (default: `Activo`)
- `Ad_ID` (default: `""`)

Defaults forzados por workflow:

- `Notificado_Previo = false`
- `Updated_At = timestamp ISO`

## 4.3 Entrada `consulta`

Campos opcionales:

- `dias_proximos` (entero 1..60, default: `7`)

Regla de filtro:

- Retorna contratos con `Fecha_Fin` dentro de `[hoy, hoy + dias_proximos]`.
- Excluye `Status_Contrato = Finalizado`.

## 4.4 Entrada `extension`

Campos requeridos:

- `Contrato_ID` (string)
- `Nueva_Fecha_Fin` (string `YYYY-MM-DD`)

Comportamiento:

- Busca contrato por `Contrato_ID`.
- Si no existe, lanza error de negocio.
- Si existe:
  - actualiza `Fecha_Fin = Nueva_Fecha_Fin`
  - actualiza `Updated_At`
  - resetea `Notificado_Previo = false`

---

## 5) Salidas esperadas

## 5.1 Respuesta `alta` (201)

```json
{
  "ok": true,
  "action": "alta",
  "message": "Contrato creado",
  "data": {
    "Contrato_ID": "CTR-1001"
  }
}
```

## 5.2 Respuesta `consulta` (200)

```json
{
  "ok": true,
  "action": "consulta",
  "dias_proximos": 7,
  "total": 2,
  "data": [
    {
      "Contrato_ID": "CTR-1001",
      "Fecha_Fin": "2026-04-10"
    }
  ]
}
```

## 5.3 Respuesta `extension` (200)

```json
{
  "ok": true,
  "action": "extension",
  "message": "Contrato extendido y Notificado_Previo reseteado",
  "data": {
    "Contrato_ID": "CTR-1001",
    "Fecha_Fin": "2026-05-15",
    "Notificado_Previo": false
  }
}
```

---

## 6) Estructura esperada de Google Sheets

Hoja: `Contratos`

Columnas recomendadas (alineadas al MVP):

- `Contrato_ID`
- `Cliente`
- `Regex_Anuncio`
- `Ad_ID`
- `Fecha_Alta`
- `Fecha_Fin`
- `Status_Contrato`
- `Notificado_Previo`
- `Updated_At`

> Nota: el workflow usa mapeo automático de columnas (`autoMapInputData`), por lo que conviene mantener exactamente estos nombres.

---

## 7) Decisiones MVP aplicadas

1. **Validación estricta de fecha**
   - Regex `YYYY-MM-DD` + chequeo de fecha real (ej. evita `2026-02-31`).

2. **Extensión con reseteo preventivo**
   - Siempre que hay extensión válida: `Notificado_Previo=false`.

3. **Consulta enfocada a operación**
   - Próximos vencimientos default en 7 días para tablero/UI.

4. **Timezone fija de negocio**
   - Referencia operativa `America/Argentina/Buenos_Aires` para “hoy”.

5. **Webhook síncrono para UI**
   - Respuesta directa por `Respond to Webhook`.

---

## 8) Limitaciones MVP

- No incluye autenticación/autorización del endpoint (recomendado agregar API key/HMAC en siguiente iteración).
- No incluye fallback de notificación externa (Slack/Telegram), alineado al alcance MVP fuera de scope.
- No incluye deduplicación de `Contrato_ID` en ruta `alta` (se recomienda validación previa por lookup si la UI no lo garantiza).
- No incluye alerting/observabilidad avanzada (métricas, correlation_id, SLO) en esta versión base.

---

## 9) Ejemplos de payload

## 9.1 Alta

```json
{
  "action": "alta",
  "Contrato_ID": "CTR-1001",
  "Cliente": "Acme SA",
  "Regex_Anuncio": "promo_otoño_2026",
  "Fecha_Fin": "2026-04-15",
  "Ad_ID": "12001234567890"
}
```

## 9.2 Consulta

```json
{
  "action": "consulta",
  "dias_proximos": 7
}
```

## 9.3 Extensión

```json
{
  "action": "extension",
  "Contrato_ID": "CTR-1001",
  "Nueva_Fecha_Fin": "2026-05-15"
}
```

---

## 10) Consistencia con lineamientos AdsKiller

Consistente con `AGENTS.md` en:

- soporte UI para altas/consultas/extensiones,
- fecha estricta `YYYY-MM-DD`,
- reseteo de preventiva al extender,
- timezone operativa definida.

Sobre `docs/spec-mvp.md`:

- El archivo no está presente actualmente en el árbol local del repo, por lo que la verificación se realizó contra reglas funcionales confirmadas en el pedido y `AGENTS.md`.
