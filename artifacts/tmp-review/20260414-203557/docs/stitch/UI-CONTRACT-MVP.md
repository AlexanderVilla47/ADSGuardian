# AdsKiller UI Contract MVP (Unified)

## 1) Purpose and Design Rules

This contract defines a single operational UI for AdsKiller based on Stitch screens as reference (not source of truth).

Principles:
- Business-first: prioritize risk visibility and fast decisions over visual complexity.
- Operational simplicity: one main action per screen, low cognitive load.
- System coherence over pixel perfection: consistent navigation, states, and actions.
- Domain guardrails first: no UI flow can bypass critical business validations.

---

## 2) Final Unified Navigation

### Sidebar (desktop)

Order and labels:
1. `Dashboard`
2. `Contracts`
3. `Operational History`
4. `Settings`

Global rules:
- Single active item with filled background + accent icon.
- Keep Help/Profile out of main nav; place profile summary in sidebar footer only.
- No additional section names (`Explorar`, `Ejecuciones`, etc.) in MVP.

### Topbar (all screens)

Left:
- Global search input placeholder: `Search contracts, influencers, or execution IDs...`

Right:
- `Run now` button (always visible, primary for operations)
- User avatar + role text

Behavior:
- Topbar remains fixed.
- Search triggers context-aware results (contracts/history/influencer result screen).

### Mobile navigation

- Bottom nav with same 4 items as sidebar.
- Keep `Run now` as sticky floating action button on mobile.

---

## 3) Screen Definitions

## 3.1 Dashboard

Objective:
- Provide immediate operational health and the risk queue for intervention.

Primary actions:
- `Run now`
- `View contract`
- `Extend contract`
- `Pause ad`

Data blocks:
- KPI cards: Active Contracts, Expiring in 48h, Expiring Today, Expired Unpaused, Channel Errors.
- Risk table columns: Contract ID, Influencer, End Date, Contract Status, Severity, Actions.

Validations:
- `Pause ad` enabled only if ad status in Meta is `ACTIVE`.
- `Extend contract` requires valid `new_end_date` in `YYYY-MM-DD` and strictly greater than current end date.
- If extension succeeds, preventive 48h flag must reset.

States:
- Loading: skeleton for KPI cards and table rows.
- Empty: `No risks detected for today.`
- Error: `Unable to load dashboard data. Try again.`
- Success: show KPIs + table.

## 3.2 Contracts

Objective:
- Manage contract lifecycle (create, review, extend, finalize).

Primary actions:
- `New contract`
- `Sync channels`
- Row actions: `View`, `Extend`, `Finalize`.

Table columns (MVP):
- Contract ID
- Influencer
- Start Date
- End Date
- Contract Status
- Last Check
- Actions

Validations:
- Required fields on create: Influencer Name, Contract ID, Start Date, End Date, Ad Matching Pattern.
- Dates must be `YYYY-MM-DD`.
- End Date must be greater than Start Date.
- Contract ID must be unique.
- Ad matching pattern cannot be empty; test preview required before save.

States:
- Loading: table skeleton + disabled CTA.
- Empty: `No contracts yet. Create your first contract.`
- Error: `Could not load contracts. Retry.`
- Success: table + pagination.

## 3.3 Operational History

Objective:
- Audit executions and outcomes for scheduled/manual runs.

Primary actions:
- `Run now`
- `Filter`
- `View details`

Table columns:
- Date/Time
- Trigger Type (`Scheduler` | `Manual`)
- Result (`SUCCESS` | `PARTIAL` | `FAILED`)
- Contracts Evaluated
- Ads Paused
- Expired Found
- Errors
- Execution ID
- Action

Validations:
- `View details` requires valid execution ID.
- Date filter cannot exceed 90 days in MVP.
- If no node target reached in latest execution after last fix, mark as `NOT EXERCISED`.

States:
- Loading: list skeleton.
- Empty: `No executions found for selected period.`
- Error: `Execution history unavailable. Try again.`
- Success: rows + status badges.

## 3.4 Settings

Objective:
- Configure operational parameters and integration channels used by workflows.

Primary actions:
- `Save settings`
- `Test connection` per channel

Modules:
- Meta Ads connection status
- Primary notification channel
- Backup channel toggle (off by default in MVP)
- Retry policy view (3 attempts, 5m wait)
- Timezone display (`America/Argentina/Buenos_Aires`, read-only)

Validations:
- Secret/token fields are masked by default.
- `Save settings` disabled if required connection data is missing.
- Channel test must pass before enabling channel as active.

States:
- Loading: module skeletons.
- Empty: `No channel configured yet.`
- Error: `Settings could not be saved. Review required fields.`
- Success: `Settings updated successfully.`

## 3.5 Influencer Search Result

Objective:
- Resolve ambiguous search terms and route user to the intended influencer profile/contract context.

Primary actions:
- `Open profile`
- `Open contracts`
- `Refine search`

Content:
- Query summary
- Optional ambiguity alert
- Ranked result cards with match score and quick metadata.

Validations:
- Minimum query length: 2 chars.
- Match score visible only if scoring service returns confidence.
- If exact match exists, place first and highlight.

States:
- Loading: result cards skeleton.
- Empty: `No matching influencers found.`
- Error: `Search failed. Please try again.`
- Success: ranked suggestions list.

---

## 4) Reusable Components (MVP)

| Component | Variants | Usage | Rules |
|---|---|---|---|
| `KPI Card` | neutral, warning, critical | Dashboard + History counters | Title + value + optional trend; keep max 1 secondary line |
| `Data Table` | contracts, risk, executions | Main operational lists | Sticky header, sortable key cols, row hover, pagination |
| `Status Badge` | success, warning, error, neutral, info | Contract states and execution result | Uppercase short label; semantic color only |
| `Severity Badge` | critical, warn, info | Risk queue | Must be explicit and always visible |
| `Primary Button` | default, destructive | Main CTA | One primary per area; clear verb |
| `Secondary Button` | outline/tonal | Supporting actions | Never compete with primary hierarchy |
| `Inline Action Icon` | view, extend, pause | Table quick actions | Always include tooltip label |
| `Search Input` | global, local filter | Topbar and table filters | Leading icon + clear placeholder |
| `Alert Banner` | info, warning, error | Ambiguity/errors/system alerts | Keep message actionable and short |
| `Empty State Block` | no data/no results | All list screens | One sentence + one CTA |

---

## 5) Copy Guide (EN labels + clear messages)

### Navigation and global labels

- `Dashboard`
- `Contracts`
- `Operational History`
- `Settings`
- `Run now`
- `Search contracts, influencers, or execution IDs...`

### Action labels

- `New contract`
- `Sync channels`
- `View details`
- `Extend contract`
- `Pause ad`
- `Finalize contract`
- `Save settings`
- `Test connection`
- `Open profile`

### System messages

- Loading: `Loading data...`
- Generic empty: `No data available for this view.`
- Generic error: `Something went wrong. Please retry.`
- Dashboard empty: `No risks detected for today.`
- Contracts empty: `No contracts yet. Create your first contract.`
- History empty: `No executions found for selected period.`
- Search empty: `No matching influencers found.`
- Save success: `Settings updated successfully.`
- Validation date format: `Use YYYY-MM-DD format.`
- Validation end date: `End date must be later than start date.`

---

## 6) Non-Negotiable Domain Validations (UI)

- Date inputs must enforce `YYYY-MM-DD`.
- Show timezone label in date-related screens: `America/Argentina/Buenos_Aires`.
- Pause action targets `Ad` level only.
- Pause flow requires pre-check: ad status must be `ACTIVE` in Meta.
- On successful pause, contract status must become `Finalized`.
- Retry behavior for Meta `429`/`500`: 3 attempts with 5-minute delay.
