# Evidencia de release Flow3 - 2026-04-12

> Plantilla canónica para nuevas releases: `docs/release-evidence-template.md`.

Workflow objetivo: `BFHHQwYFfmcpqshb`

Baseline de referencia: `workflows/baselines/flow3-notifications-v1.0-green.json`

Resultado de gate smoke mas reciente: `GREEN 4/4`

## Tabla de evidencia (corrida GREEN 681-684)

| Caso | Canal | execution_id n8n | Estado | Fuente |
|---|---|---:|---|---|
| SMOKE-01 | telegram | 681 | PASS | `scripts/flow3-smoke-regression.ps1` |
| SMOKE-02 | slack | 682 | PASS | `scripts/flow3-smoke-regression.ps1` |
| SMOKE-03 | both | 683 | PASS | `scripts/flow3-smoke-regression.ps1` |
| SMOKE-04 | unsupported (`email`) | 684 | PASS | `scripts/flow3-smoke-regression.ps1` |

## Veredicto final de release

- Estado final: **PASS**
- Cobertura gate: **4/4 casos en GREEN**
- Regla aplicada: veredicto basado en la ultima ejecucion valida por caso, sin mezclar historico.

## Referencias cruzadas

- Criterio formal de gate/rollback: `docs/release-criteria-flow3.md`
- Regresion smoke: `docs/flow3-smoke-regression.md`
- Alerting operativo: `docs/ops-alerting-flow3.md`
- Contrato de entrada: `docs/flow3-input-contract.md`
- Validacion productiva: `docs/flow3-production-validation.md`
- Simulacro de incidentes: `docs/flow3-incident-drill.md`
- Hypercare 3 dias: `docs/flow3-hypercare-3d.md`
