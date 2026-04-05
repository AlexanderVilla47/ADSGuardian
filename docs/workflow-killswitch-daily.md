# AdsKiller — Workflow diario de control y kill-switch (MVP)

## 1) Objetivo

Automatizar el control diario de contratos activos para:

1. Disparar notificación preventiva única a 48h del vencimiento.
2. Pausar anuncios vencidos **solo a nivel Ad** en Meta Ads.
3. Escalar incidente crítico si un anuncio vencido queda sin pausar tras política de retry.

Timezone operativa: `America/Argentina/Buenos_Aires`.

---

## 2) Trigger y modos de ejecución

El workflow `workflows/contract-guard-daily-killswitch.json` soporta:

- **Programado**: nodo `Cron Diario 00:01` con cron `1 0 * * *` (00:01 local).
- **Forzado manual**: nodo `Trigger Manual On-Demand`.

Ambos convergen en la misma lógica operativa (sin desvíos funcionales).

---

## 3) Fuente de datos y contrato esperado

Fuente: Google Sheets (`GSHEET_CONTRATOS_ID`, tab por defecto `Contratos`).

Columnas esperadas (mínimas):

- `Contrato_ID`
- `Status_Contrato`
- `Fecha_Fin` (`YYYY-MM-DD` estricto)
- `Ad_ID`
- `Ad_Name`
- `Regex_Anuncio` (opcional; si falta, se deriva regex flexible desde `Ad_Name`)
- `Notificado_Previo`

Reglas aplicadas:

- Solo se procesan contratos con estado activo (`Activo|Active|Activa`).
- Clasificación por fecha:
  - `preventive`: faltan 0..2 días y `Notificado_Previo = false`.
  - `expired`: fecha de fin ya pasada.

---

## 4) Flujo paso a paso

## A. Clasificación

1. Se leen filas desde Google Sheets.
2. `Clasificar Contratos (Activo / 48h / Vencido)`:
   - valida formato de fecha y ventana temporal,
   - genera `correlation_id` por corrida,
   - construye regex case-insensitive flexible,
   - enruta por `control_type`.

## B. Preventiva 48h (una sola vez)

1. `Payload Alerta Preventiva` arma evento de severidad `WARNING`.
2. `Emitir Alerta Operativa` envía payload al canal único (`ALERT_WEBHOOK_URL`).
3. `Sheets - Marcar Notificado_Previo` actualiza:
   - `Notificado_Previo = true`
   - `Fecha_Notificado_Previo = now()` en timezone operativa.

> Reset de `Notificado_Previo` no ocurre acá; se mantiene en workflow de extensión (ya implementado en otro feature).

## C. Vencidos + kill-switch

1. `Regex Coincide con Nombre (Sheet)` verifica match inicial.
2. Si no matchea, se dispara `Alerta Crítica - Regex inválido`.
3. Si matchea:
   - `Meta - Precheck Estado Ad` consulta estado y nombre del Ad.
   - `Evaluar Precheck Meta` continúa **solo** si:
     - estado de Meta = `ACTIVE`
     - regex matchea nombre de Ad en Meta.
4. Si precheck falla por `429/500`, se reintenta con:
   - hasta 3 intentos,
   - espera fija de 5 minutos (`Wait 5m Precheck Retry`).
5. Si precheck queda en fallo final, `Alerta Crítica - Precheck fallido`.
6. Si está listo para pausar:
   - `Meta - Pausar Ad` ejecuta pausa a nivel Ad,
   - `Evaluar Pausa` aplica retry para `429/500` con política 3x/5m,
   - si pausa exitosa: `Sheets - Marcar Finalizado` (`Status_Contrato = Finalizado`).
7. Si se agotan retries o falla no recuperable: `Alerta Crítica - Pausa fallida` + `Stop and Error - Escalar Incidente`.

---

## 5) Entradas y salidas

## Entradas

- Fila de contrato desde Sheets.
- Variables de entorno:
  - `GSHEET_CONTRATOS_ID`
  - `GSHEET_CONTRATOS_TAB` (opcional)
  - `META_ACCESS_TOKEN`
  - `ALERT_WEBHOOK_URL`

## Salidas

- Alertas operativas (`WARNING` preventiva, `CRITICAL` incidente).
- Estado actualizado en Sheets:
  - preventiva notificada,
  - contrato finalizado si pausa fue exitosa.
- Error explícito de ejecución en incidentes críticos (`Stop and Error`).

---

## 6) Manejo de errores

## Errores transitorios Meta (retryables)

- Códigos: `429`, `500`.
- Política: `max 3 intentos`, `wait 5 minutos`.

## Errores no retryables o funcionales

- Regex inválido/no coincidente.
- Precheck no `200` al agotar intentos.
- Pausa fallida no recuperable.

Acción: generar alerta crítica y terminar ejecución con error para trazabilidad fuerte.

---

## 7) Alertas y severidades

- `WARNING`
  - `PREVENTIVE_48H`
  - Uso: recordatorio operativo preventivo.

- `CRITICAL`
  - `EXPIRED_NOT_PAUSED_REGEX_MISMATCH`
  - `EXPIRED_NOT_PAUSED_PRECHECK_FAILED`
  - `EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED`
  - Uso: anuncio vencido sin garantía de pausa efectiva.

No hay fallback Slack/Telegram en MVP (canal único por webhook operativo).

---

## 8) Payloads de ejemplo

## Preventiva (WARNING)

```json
{
  "alert_severity": "WARNING",
  "alert_type": "PREVENTIVE_48H",
  "Contrato_ID": "CTR-10021",
  "Ad_ID": "120212300001234567",
  "days_to_end": 1,
  "correlation_id": "ak-1712345678901-a1b2c3",
  "message": "Contrato CTR-10021 entra en ventana preventiva de 48h para anuncio 120212300001234567."
}
```

## Crítica (retry agotado)

```json
{
  "alert_severity": "CRITICAL",
  "alert_type": "EXPIRED_NOT_PAUSED_RETRY_EXHAUSTED",
  "Contrato_ID": "CTR-10021",
  "Ad_ID": "120212300001234567",
  "pause_status_code": 429,
  "pause_attempt": 3,
  "correlation_id": "ak-1712345678901-a1b2c3",
  "message": "Contrato CTR-10021 vencido sin pausa: Meta respondió 429 y se agotaron retries (3x cada 5m)."
}
```

---

## 9) Trazabilidad y observabilidad

Se propaga `correlation_id` por item procesado para diagnóstico end-to-end en:

- alertas,
- nodos de decisión,
- ejecución fallida crítica.

Esto permite auditar corridas programadas y forzadas.

---

## 10) Alineación con baseline del proyecto

Este flujo mantiene las reglas de `AGENTS.md`:

- pausa solo a nivel Ad,
- pre-check `ACTIVE`,
- regex flexible case-insensitive,
- preventiva 48h una sola vez,
- `Status_Contrato => Finalizado` solo tras pausa exitosa,
- retry Meta `429/500` 3 intentos con espera de 5 minutos,
- alerta crítica ante vencido no pausado.

Nota: no se encontró `docs/spec-mvp.md` en el estado actual del repo; esta documentación se alineó con las reglas cerradas del proyecto y con el requerimiento operativo provisto para el feature.
