# Workflows folder layout

## Canonical (runtime-linked)

These are the only JSON files that should stay at `workflows/` root:

- `contract-ui-management-v2.json`
- `contract-guard-daily-killswitch.json`
- `ops-reporting-alerts.json`
- `mock-alerts-receiver.json`

The ID mapping is in `workflows/WORKFLOW_STATUS.md`.

## Non-canonical (history / experiments)

Everything not currently mapped to active runtime workflows is grouped under:

- `workflows/non-canonical/fixes/` — one-off fix snapshots
- `workflows/non-canonical/tmp/` — temporary test files
- `workflows/non-canonical/testing/` — simulators and mock payload contracts
- `workflows/non-canonical/legacy/` — previous generation flow exports

Rule of thumb: if a JSON is not in `WORKFLOW_STATUS.md` canonical list, keep it under `non-canonical/`.
