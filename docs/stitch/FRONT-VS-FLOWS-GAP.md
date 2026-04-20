# FRONT-VS-FLOWS-GAP

Ultima actualizacion: 2026-04-15

Mapeo del estado de cierre entre el contrato UI MVP y los workflows canonicos F1/F2/F3.

Leyenda de estado:
- **CERRADO**: implementado, deployado y smoke verificado.
- **EN PROGRESO**: parcialmente implementado o pendiente de validacion con credenciales.
- **PENDIENTE-PROD**: implementado pero requiere credenciales de produccion para validar (Meta API o canales reales).
- **PENDIENTE**: no implementado.

---

## Matriz de estado por accion

| Accion UI | Endpoint F1 (`cFBr6GavlSWDsUFz`) | Estado | Trigger F2 | Notif F3 | Observaciones |
|---|---|---|---|---|---|
| `alta` | `action=alta` → GS Append Alta | CERRADO | NO (solo registra) | NO | Ejecucion 936 validada. |
| `consulta` | `action=consulta` → GS Read Contratos | CERRADO | NO | NO | Rule 1 del Switch fue corregida 2026-04-15 (condicion legacy broken). |
| `extension` | `action=extension` → GS Read For Extension → GS Update Extension | CERRADO | NO | NO | Pre-check de contrato existente. |
| `baja_manual` | `action=baja_manual` → GS Read For Baja → GS Update Baja | CERRADO | NO | NO | Ejecucion 933 validada. Auditoria de motivo y timestamp. |
| `listar_ads` | `action=listar_ads` → GS Read For Listar Ads | CERRADO | NO | NO | Ejecucion 936 validada. |
| `pause_ad` | `action=pause_ad` → pre-check ACTIVE → Meta API | CERRADO | NO | NO | Pre-check ACTIVE implementado. Validacion funcional real requiere Meta API (PENDIENTE-PROD). |
| `run_now` | `action=run_now` → Build Operation Tracking → GS Append + Execute F2 | CERRADO | SI | SI (via F2→F3) | Ejecuciones 952, 957, 962 validadas. |
| `operational_history` | `action=history` → GS Read Operations History | CERRADO | NO | NO | Ejecucion 1007 validada. Normalizacion SUCCESS/PARTIAL/FAILED/NOT EXERCISED (ejecucion 1022). |
| `search` | `action=search` → GS Read For Search → Filter → Respond | CERRADO | NO | NO | Implementado y deployado 2026-04-15. Filtra por campo `Cliente` en hoja Contratos. |
| `pause_active` | `action=pause_active` → Build Operation Tracking | CERRADO | SI | SI (via F2→F3) | Ruta operativa de pausa masiva via F2. |

---

## Estado de F2 (KillSwitch - `8mlwAxLtJVrwpLhi`)

| Aspecto | Estado | Detalle |
|---|---|---|
| Cardinalidad en Code nodes | CERRADO | 4 nodos corregidos 2026-04-15: `Evaluar Precheck Meta`, `Normalizar HTTP Pausa`, `Evaluar Pausa`, `Build Finalizado Payload`. Pattern `$input.all().map()` + modo `runOnceForAllItems`. |
| Retries 3x/5m en Meta 429/500 | CERRADO | Fix aplicado 2026-04-12 (wait 0.2m → 5m). |
| Validacion real con Meta API (AK-TC-09) | PENDIENTE-PROD | Requiere credenciales Meta API en produccion. Hardening de post-check PAUSED aplicado. |
| AK-TC-01 a AK-TC-08 | CERRADO | Todos PASS con datos mock. |

---

## Estado de F3 (Ops Reporting - `BFHHQwYFfmcpqshb`)

| Aspecto | Estado | Detalle |
|---|---|---|
| Routing por severidad (Is_CriticalAlert) | CERRADO | Bug corregido 2026-04-15: nodo IF v2 usaba formato de condicion v1 que defaulteaba a output 0. Fix: migrar a formato nativo IF v2. |
| Dual-channel Slack + Telegram en paralelo | CERRADO | Implementado 2026-04-15. Is_SlackChannel e Is_TelegramChannel corren en paralelo por presencia de credenciales. F2 cableado a F3 (reemplazado mock). |
| ORA-TC-01 INFO path | CERRADO | GREEN ejecucion 1076. Dual-channel: Slack + Telegram. |
| ORA-TC-02 WARN + Telegram | CERRADO | GREEN ejecucion 1077. Solo Telegram configurado. [WARN] + incidente recibido. |
| ORA-TC-03 CRITICAL + Slack | CERRADO | GREEN ejecucion 1078. Solo Slack configurado. [CRITICAL] + accion requerida recibido. |
| ORA-TC-04 canal no soportado | CERRADO | GREEN ejecucion 1079. Sin credenciales → Log_UnsupportedChannel. Ningun canal recibio mensaje. |
| ORA-TC-05 falla de envio | CERRADO | GREEN ejecucion 1080. URL invalida → onError:continueErrorOutput → Log_ChannelSendFailure. |
| ORA-TC-06 trazabilidad | CERRADO | GREEN ejecucion 1081. Normalizacion de tipos, fallback correlation_id, fallback timezone. |

---

## Items fuera de alcance MVP

- Reemplazo de Google Sheets por DB productiva.
- Modulo independiente de matching avanzado.
- Operaciones bulk (`pause_all_active`) sin guardrails formales.
- Validacion de `pause_ad` con Meta API real (AK-TC-09) — requiere credenciales de produccion.
