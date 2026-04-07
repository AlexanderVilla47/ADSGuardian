# AdsKiller — Runbook de Cutover a Producción (Mock/Test ➜ Prod)

> **Propósito:** ejecutar la transición a producción de una sola vez, con control operativo, evidencia y rollback seguro.

---

## 1) Alcance y precondiciones

### Alcance

Este runbook cubre el paso de estado actual de testing/mock a producción para:

- `contract-ui-management`
- `contract-guard-daily-killswitch`
- `ops-reporting-alerts`
- `local-meta-testing-simulator` (solo para desactivación/aislamiento en prod)

Incluye:

- configuración n8n,
- variables,
- credenciales,
- URLs,
- waits y modo mock/prod,
- webhooks,
- alertas,
- validación final,
- rollback.

### Precondiciones obligatorias

1. Ventana de cambio aprobada (fecha/hora y responsables confirmados).
2. Backups/export de workflows actuales antes de tocar configuración.
3. Acceso de operador a n8n prod (edición + activación de workflows).
4. Acceso a credenciales de producción (Meta + Google + canal de alertas).
5. Dataset controlado para smoke tests P0 (incluye casos happy, precheck failed y pause failed).
6. Alineación de timezone operativa en `America/Argentina/Buenos_Aires`.

---

## 2) Estado actual vs estado producción (por workflow)

| Workflow | Estado actual (mock/testing) | Estado objetivo (producción) | Acción de cutover |
|---|---|---|---|
| `contract-ui-management` | Webhook operativo de UI y persistencia en Sheets por env vars (`GSHEET_CONTRATOS_DOC_ID`, `GSHEETS_CREDENTIAL_ID`). Export en repo con `"active": false` (esto no refleja estado real de n8n). | Webhook productivo con credenciales/Sheet de prod, endpoint estable para UI productiva. | Validar doc ID/credencial de prod, probar alta/consulta/extensión, activar workflow en n8n prod. |
| `contract-guard-daily-killswitch` | Soporta modo `META_MODE=mock` usando `META_SIMULATOR_BASE_URL` (fallback `http://localhost:5678/webhook`). Retry 3 intentos con waits de 5 min. | `META_MODE=prod`, llamadas directas a `https://graph.facebook.com/v20.0/{Ad_ID}` con token prod y alerta operativa real. | Cambiar variables/env de modo prod, validar URLs Meta reales, verificar waits 5m, activar cron y trigger manual. |
| `ops-reporting-alerts` | Recibe payload por webhook y envía a Slack/Telegram según payload. En pruebas suele apuntar a canales sandbox. | Envío a canal operativo real (webhook Slack prod o bot/chat Telegram prod), con evidencias de recepción. | Actualizar origen de payload y canales productivos, ejecutar smoke de INFO/WARN/CRITICAL. |
| `local-meta-testing-simulator` | Simulador local para escenarios `429/500/400/inactive` vía webhooks `/meta/precheck/:adId` y `/meta/pause/:adId`. | No debe intervenir en tráfico productivo. Debe quedar desactivado/aislado. | Confirmar workflow desactivado en prod y sin referencias activas desde kill-switch. |

---

## 3) Checklist maestro de cambios requeridos

> Completar esta tabla durante el cutover (una fila = un cambio verificable).

| Cambio requerido | Dónde | Valor actual mock/testing | Valor prod esperado | Responsable | Evidencia |
|---|---|---|---|---|---|
| Modo Meta en producción | n8n env var `META_MODE` (kill-switch) | `mock` | `prod` | Owner Técnico | Captura de env vars en n8n + ejecución mostrando URL Graph API |
| Base URL simulador Meta | n8n env var `META_SIMULATOR_BASE_URL` | `http://localhost:5678/webhook` (u otra local) | **No usada** en prod (dejar vacía/no referenciada operativamente) | Owner Técnico | Captura de variable + trazas de ejecución sin URL simulador |
| Token Meta Ads | n8n env var `META_ACCESS_TOKEN` | token de test/mock | token prod vigente (mínimo privilegio) | Seguridad/Integración | Prueba `precheck` 200 en ad real controlado |
| URL alerta operativa | n8n env var `ALERT_WEBHOOK_URL` | webhook sandbox/mock | webhook productivo de operación | Operación | Mensaje de alerta recibido en canal prod de prueba controlada |
| Google Sheet contratos (kill-switch) | `GSHEET_CONTRATOS_ID` | Sheet de QA/testing | Sheet productiva | Operación | Update de fila real en hoja prod durante smoke |
| Tab de contratos | `GSHEET_CONTRATOS_TAB` | `Contratos` (test) | `Contratos` (prod) o tab acordada | Operación | Lectura/escritura correcta en tab objetivo |
| Google Sheet UI | `GSHEET_CONTRATOS_DOC_ID` (`contract-ui-management`) | doc QA/testing | doc prod | Operación | Alta/consulta/extensión OK en sheet prod |
| Credencial Google UI | `GSHEETS_CREDENTIAL_ID` (`contract-ui-management`) | credencial testing | credencial prod | Seguridad/Integración | Ejecución UI sin error de auth Google |
| URLs Meta precheck/pause | Nodos `Meta - Precheck Estado Ad` y `Meta - Pausar Ad` | Resolución a simulador local cuando `META_MODE=mock` | Resolución a `https://graph.facebook.com/v20.0/{Ad_ID}` | Owner Técnico | Captura de execution data con URL final de Graph API |
| Wait retry precheck | Nodo `Wait 5m Precheck Retry` | puede estar reducido en entornos de test (si hubo override manual) | **5 minutos** | Owner Técnico | Captura de configuración del nodo |
| Wait retry pausa | Nodo `Wait 5m Pausa Retry` | puede estar reducido en entornos de test (si hubo override manual) | **5 minutos** | Owner Técnico | Captura de configuración del nodo |
| Webhook UI expuesto a frontend prod | `Webhook UI` path `/contract-ui-management` | endpoint de test/staging | endpoint base de n8n prod + path estable | Frontend + Owner Técnico | Request/response 200/201 desde UI prod |
| Webhook reporting interno | `KillSwitch Result Webhook` path `/ops-reporting-alerts` | tráfico de pruebas | tráfico desde kill-switch productivo | Owner Técnico | ejecución correlacionada kill-switch ➜ reporting |
| Trigger cron productivo | Nodo `Cron Diario 00:01` | desactivado o en entorno no-prod | activo en prod (00:01 America/Argentina/Buenos_Aires) | Operación | captura de cron + próxima ejecución programada |
| Trigger manual operativo | `Trigger Manual On-Demand` | uso QA | habilitado para run forzado en prod | Operación | evidencia de ejecución manual productiva |
| Simulador local aislado | `local-meta-testing-simulator` | activo en pruebas locales | inactivo en prod | Owner Técnico | captura workflow inactivo |

---

## 4) Variables y credenciales requeridas

### Variables de entorno

| Variable | Workflow | Requerida en prod | Notas |
|---|---|---|---|
| `META_MODE` | kill-switch | Sí | Debe quedar en `prod` para usar Graph API real. |
| `META_SIMULATOR_BASE_URL` | kill-switch | No operativa | Solo testing/mock; en prod no debe usarse en ejecución real. |
| `META_ACCESS_TOKEN` | kill-switch | Sí | Token prod vigente y con permisos mínimos necesarios. |
| `ALERT_WEBHOOK_URL` | kill-switch | Sí | Canal operativo real para WARNING/CRITICAL. |
| `GSHEET_CONTRATOS_ID` | kill-switch | Sí | Documento productivo de contratos. |
| `GSHEET_CONTRATOS_TAB` | kill-switch | Sí | Por defecto `Contratos` si no se define. |
| `GSHEET_CONTRATOS_DOC_ID` | UI management | Sí | Documento de contratos usado por UI en prod. |
| `GSHEETS_CREDENTIAL_ID` | UI management | Sí | Credencial de Google Sheets para entorno productivo. |

### Credenciales

| Credencial | Uso | Validación mínima |
|---|---|---|
| Meta Ads token prod | Precheck + Pause Ad | `GET` precheck 200 y `POST` pausa controlada con respuesta esperada |
| Google Sheets cred prod | Lectura/escritura contratos | Alta + update (`Finalizado` o extensión) confirmados en hoja prod |
| Canal de alertas prod | WARNING/CRITICAL operativas | Recepción efectiva de mensaje de prueba y trazabilidad de `correlation_id` |

---

## 5) Cambios de nodos específicos (control de configuración)

### `contract-guard-daily-killswitch`

1. **`Meta - Precheck Estado Ad`**
   - Verificar resolución de URL a Graph API en prod:
   - `https://graph.facebook.com/v20.0/{Ad_ID}`
2. **`Meta - Pausar Ad`**
   - Verificar resolución de URL a Graph API en prod.
3. **`Wait 5m Precheck Retry`**
   - Confirmar `amount=5`, `unit=minutes`.
4. **`Wait 5m Pausa Retry`**
   - Confirmar `amount=5`, `unit=minutes`.
5. **`Emitir Alerta Operativa` / alertas críticas**
   - Confirmar `ALERT_WEBHOOK_URL` productiva.
6. **`Cron Diario 00:01`**
   - Confirmar scheduling activo en prod.

### `ops-reporting-alerts`

1. **`KillSwitch Result Webhook`**
   - Validar recepción en endpoint productivo `/ops-reporting-alerts`.
2. **`Send Slack Notification` / `Send Telegram Notification`**
   - Confirmar que usa canales operativos productivos (no sandbox).
3. **Rama `CRITICAL`**
   - Confirmar mensaje de acción requerida llega y se visualiza correctamente.

### `contract-ui-management`

1. **`Webhook UI`**
   - Confirmar endpoint productivo `/contract-ui-management` comunicado a frontend.
2. **Nodos Google Sheets**
   - Confirmar doc ID y credencial productiva (`GSHEET_CONTRATOS_DOC_ID`, `GSHEETS_CREDENTIAL_ID`).

---

## 6) Secuencia paso a paso de cutover (ejecución única)

### Fase A — Preparación (T-1)

1. Congelar cambios en workflows durante la ventana.
2. Exportar backup de workflows actuales desde n8n (JSON con timestamp).
3. Confirmar matriz de responsables (Operación, Owner Técnico, Integración, On-call).
4. Cargar/validar variables y credenciales prod sin activar aún cron.

### Fase B — Cambio controlado

1. Desactivar (o asegurar inactivo) `local-meta-testing-simulator` en prod.
2. Ajustar variables de `contract-guard-daily-killswitch`:
   - `META_MODE=prod`
   - `META_ACCESS_TOKEN=<prod>`
   - `ALERT_WEBHOOK_URL=<prod>`
   - `GSHEET_*` productivos
3. Verificar nodos de wait en 5 minutos (precheck y pausa).
4. Verificar endpoint UI productivo y conectividad frontend ↔ n8n.
5. Verificar endpoint reporting y canal de alertas productivo.

### Fase C — Activación

1. Activar `contract-ui-management`.
2. Activar `ops-reporting-alerts`.
3. Activar `contract-guard-daily-killswitch` (cron + manual).
4. Ejecutar corrida manual controlada (no esperar al cron) para smoke tests P0.

### Fase D — Cierre de ventana

1. Evaluar criterios Go/No-Go.
2. Si Go: dejar activo y registrar evidencia completa.
3. Si No-Go: ejecutar rollback inmediato (sección 9).

---

## 7) Smoke tests P0 post-cutover (obligatorios)

> Los 3 escenarios deben ejecutarse en la misma ventana de cutover.

| ID | Escenario | Preparación | Resultado esperado (pass) | Evidencia obligatoria |
|---|---|---|---|---|
| P0-01 | **Happy path** (vencido + ACTIVE + pausa OK) | Contrato vencido controlado + ad `ACTIVE` | Ad pasa a `PAUSED`, `Status_Contrato=Finalizado`, alerta/report acorde sin crítico | Captura ejecución kill-switch + fila Sheets actualizada + mensaje de reporte |
| P0-02 | **Precheck failed** | Simular respuesta no recuperable en precheck o agotamiento de retry 429/500 | Se emite `CRITICAL` de precheck fallido, no avanza a pausa, trazabilidad completa | Captura rama de error + alerta recibida + `correlation_id` |
| P0-03 | **Pause failed** | Precheck OK pero pausa falla (no recuperable o retries agotados) | Se emite `CRITICAL`, no marca `Finalizado`, `Stop and Error`/incidente visible | Captura ejecución fallida + alerta crítica + estado en Sheets sin falso positivo |

### Evidencia mínima a capturar (checklist)

- [ ] ID de ejecución n8n por cada P0.
- [ ] `correlation_id` de cada ejecución.
- [ ] Captura de variables productivas aplicadas (`META_MODE`, `GSHEET_*`, alert webhook).
- [ ] Captura de respuesta de Meta (status code) en precheck/pause.
- [ ] Captura de mensaje de alerta/report en canal operativo.
- [ ] Captura de fila en Google Sheets con resultado final esperado.

---

## 8) Criterio de Go / No-Go

### Go (habilitar operación productiva)

Se declara **GO** solo si:

1. P0-01, P0-02 y P0-03 pasan con evidencia completa.
2. No hay referencia activa al simulador local en ejecuciones productivas.
3. Webhooks UI y reporting responden correctamente.
4. Alertas llegan al canal operativo correcto.
5. No hay errores de credenciales en Meta/Google.

### No-Go (rollback inmediato)

Declarar **NO-GO** si ocurre cualquiera:

- falla un P0 crítico,
- no hay trazabilidad (`execution_id`/`correlation_id`) en ejecución,
- alertas críticas no llegan,
- se detecta riesgo de dejar vencidos sin pausar.

---

## 9) Rollback plan (volver a mock de forma segura)

> Objetivo: restaurar estado de testing/mock rápidamente y sin ambigüedad.

1. **Pausar operación productiva**
   - Desactivar `contract-guard-daily-killswitch` (evitar corridas automáticas durante rollback).
2. **Restaurar variables de testing/mock**
   - `META_MODE=mock`
   - `META_SIMULATOR_BASE_URL=<url mock vigente>`
   - restaurar tokens/webhooks/sheets de entorno de test según backup.
3. **Reactivar simulador**
   - Activar `local-meta-testing-simulator` (si aplica para QA).
4. **Revalidar wiring mock**
   - Ejecutar corrida manual de prueba contra simulador.
5. **Confirmar no contaminación de prod**
   - Verificar que no se enviaron más alertas a canal prod tras rollback.
6. **Comunicar estado**
   - Reportar rollback ejecutado, causa y siguiente ventana propuesta.

### Evidencia de rollback

- [ ] Captura de workflow kill-switch desactivado durante rollback.
- [ ] Captura de `META_MODE=mock` y `META_SIMULATOR_BASE_URL` aplicados.
- [ ] Captura de ejecución manual mock exitosa.
- [ ] Registro de comunicación de incidente/cierre de ventana.

---

## 10) Registro de ejecución del cutover (completar en vivo)

| Ítem | Valor |
|---|---|
| Fecha/hora inicio ventana | |
| Fecha/hora fin ventana | |
| Change owner | |
| Operador n8n | |
| On-call | |
| Resultado final | GO / NO-GO |
| Observaciones | |
