# Workflow Status (n8n + repo)

Last cleanup: 2026-04-13 (America/Argentina/Buenos_Aires)

## Canonical active workflows

- `cFBr6GavlSWDsUFz` -> `workflows/contract-ui-management-v2.json`
- `8mlwAxLtJVrwpLhi` -> `workflows/contract-guard-daily-killswitch.json`
- `BFHHQwYFfmcpqshb` -> `workflows/ops-reporting-alerts.json`
- `YKJI902TH3uIeJHD` -> `workflows/mock-alerts-receiver.json`

## Non-canonical organization

- Non-active JSON snapshots were moved to `workflows/non-canonical/` (fixes/tmp/testing/legacy).
- Root `workflows/` should remain reserved for canonical active exports only.

## Legacy / obsolete references

- `rpnGFPo0nDthwzdB` (old F1) was removed from n8n and backed up in `workflows/legacy/`.
- `pRQpzxtljw1l87FA` (`contract-ui-management-v2-clean`) was removed from n8n and backed up in `workflows/legacy/`.
- `kCUaiNxwRxJMVqMg` (`tmp-diagnose-*`) was removed from n8n and backed up in `workflows/legacy/`.
- `OcDla9dvpqVD6GPi` (`Test Minimal Code`) was removed from n8n and backed up in `workflows/legacy/`.

## Evidence

- Cleanup execution report: `artifacts/workflow-cleanup/cleanup-report-20260413-133918.json`
- Backup snapshots: `workflows/legacy/*.json`
