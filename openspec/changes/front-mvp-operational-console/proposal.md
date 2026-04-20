# Proposal: Front MVP Operational Console

## Intent

Cerrar el gap front-vs-flows para operar AdsKiller desde UI con foco en riesgo: evitar anuncios vencidos sin pausar y garantizar notificacion operativa consultable.

## Scope

### In Scope
- Alinear UI MVP con capacidades reales de F1 `cFBr6GavlSWDsUFz`, F2 `8mlwAxLtJVrwpLhi` y F3 `BFHHQwYFfmcpqshb`.
- Definir contrato API unico front-back sobre Google Sheets (sin DB en esta fase).
- Implementar operaciones faltantes criticas para front: `listar_ads`, `pause_ad`, `baja_manual`, `run_now` y `operational_history`.

### Out of Scope
- Migracion a base de datos relacional.
- Modulo principal de matching avanzado (se mantiene como feature interna).
- Operacion masiva `pause_all_active` sin guardrails adicionales.

## Approach

Ejecutar por etapas negocio-first: primero contrato estable y acciones criticas de riesgo, luego historial consultable y gate formal de produccion. Reusar flujos canonicos existentes y extenderlos con endpoints controlados, evitando rediseño completo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `docs/plan-maestro-adskiller-mvp.md` | New | Plan ejecutable por etapas con DoD y gate |
| `docs/stitch/UI-CONTRACT-MVP.md` | Modified | Alineacion final de acciones soportadas por backend |
| `docs/stitch/FRONT-VS-FLOWS-GAP.md` | Modified | Seguimiento de cierre de gaps por accion |
| `workflows/contract-ui-management-v2.json` | Modified | Nuevas acciones API para front |
| `workflows/contract-guard-daily-killswitch.json` | Modified | Exposicion controlada de pausa manual |
| `workflows/ops-reporting-alerts.json` | Modified | Salida para historial consultable |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| UI promete acciones sin backend real | High | Gate por feature habilitada + pruebas por endpoint |
| Desvio en retries operativos (3x/5m) | Medium | Verificacion explicita antes de release |
| Historial incompleto en MVP Sheets | Medium | Contrato minimo de eventos + auditoria por correlation_id |

## Rollback Plan

Restaurar workflows a baseline estable previo, desactivar nuevas acciones del front por feature flag/route y mantener solo acciones ya verdes (`alta`, `consulta`, `extension`) hasta corregir.

## Dependencies

- `docs/stitch/FRONT-VS-FLOWS-GAP.md`
- `docs/stitch/UI-CONTRACT-MVP.md`
- Credenciales operativas de n8n + Meta + canales de notificacion

## Success Criteria

- [ ] UI ejecuta acciones criticas con backend real y trazable.
- [ ] No quedan vencidos sin pausar en validacion operativa.
- [ ] Historial operacional es consultable por `execution_id`.
