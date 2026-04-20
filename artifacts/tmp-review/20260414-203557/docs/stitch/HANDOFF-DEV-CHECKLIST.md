# AdsKiller Frontend Handoff Checklist (MVP)

## 1) Implementation Checklist

## Global shell and navigation

- [ ] Implement a single app shell with fixed sidebar + fixed topbar.
- [ ] Sidebar contains only: Dashboard, Contracts, Operational History, Settings.
- [ ] Topbar includes global search, `Run now` CTA, user block.
- [ ] Mobile bottom nav mirrors same 4 items.
- [ ] Active route state is consistent in desktop and mobile nav.

## Design/system consistency

- [ ] Reuse one token set for colors, spacing, radius, typography.
- [ ] Use one component library contract for cards/tables/badges/buttons.
- [ ] Keep one primary action per screen section.
- [ ] Remove duplicate profile/help elements from content area.

## Domain validation wiring

- [ ] Enforce date format `YYYY-MM-DD` in all contract/date forms.
- [ ] Block save when End Date <= Start Date.
- [ ] Block `Pause ad` action when Meta ad status is not `ACTIVE`.
- [ ] On pause success, update contract status to `Finalized`.
- [ ] On extension success, reset preventive 48h state.
- [ ] Display timezone context: `America/Argentina/Buenos_Aires` in relevant forms/tables.

## UI states

- [ ] Add `loading`, `empty`, `error`, `success` states to each screen.
- [ ] Empty states include one clear CTA.
- [ ] Error states include retry action.
- [ ] Show inline field validation messages (not only toast).

## Accessibility and operational usability

- [ ] Icon-only actions include tooltips and aria labels.
- [ ] Keyboard focus visible on all controls.
- [ ] Table headers are clear, short, and stable.
- [ ] Status badges include text, not only color.

---

## 2) Acceptance Criteria by Screen

## Dashboard

- [ ] KPIs visible at first paint and aligned to risk operations.
- [ ] Risk queue table includes quick actions: View, Extend, Pause ad.
- [ ] `Run now` is visible without scrolling.
- [ ] Empty state text: `No risks detected for today.`
- [ ] Error state includes `Try again` action.

## Contracts

- [ ] `New contract` flow validates required fields before submit.
- [ ] Table shows: Contract ID, Influencer, Start Date, End Date, Contract Status, Last Check, Actions.
- [ ] Contract status badge values are standardized.
- [ ] Pagination works with total/count feedback.
- [ ] Empty state text: `No contracts yet. Create your first contract.`

## Operational History

- [ ] Table shows execution ID and trigger type for every row.
- [ ] Result badge supports `SUCCESS`, `PARTIAL`, `FAILED`, `NOT EXERCISED`.
- [ ] `View details` opens execution detail with immutable execution ID.
- [ ] Date range filter max is 90 days.
- [ ] Empty state text: `No executions found for selected period.`

## Settings

- [ ] Secrets are masked by default.
- [ ] `Save settings` disabled until required fields are valid.
- [ ] `Test connection` returns explicit success/failure feedback.
- [ ] Retry policy rendered as read-only: `3 attempts, 5m delay`.
- [ ] Success message: `Settings updated successfully.`

## Influencer Search Result

- [ ] Query summary is visible and matches searched term.
- [ ] Ambiguity banner appears only when needed.
- [ ] Cards are sorted by confidence score descending.
- [ ] Actions include `Open profile` and `Open contracts`.
- [ ] Empty state text: `No matching influencers found.`

---

## 3) Definition of Done (Frontend)

- [ ] All five screens implemented using this contract.
- [ ] No mixed nav terms (`Ejecuciones`, `Explorar`, `Historial`) in final UI.
- [ ] Copy is in English for labels/messages listed in UI contract.
- [ ] QA validates all required UI states and business validations.
- [ ] Stakeholder walkthrough confirms lower operational friction.
