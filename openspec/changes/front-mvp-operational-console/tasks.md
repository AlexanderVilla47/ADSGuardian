# Tasks: Front MVP Operational Console

## Phase 1: Infrastructure / Setup

- [x] 1.1 Initialize React 18 + Vite project in `frontend/` with `npm create vite@latest . --template react-ts`
- [x] 1.2 Install dependencies: `zustand @tanstack/react-query react-router-dom`, `shadcn-ui` (radix primitives), `tailwindcss postcss autoprefixer`, `date-fns`, `react-hook-form` + `zod`, `lucide-react`, `clsx tailwind-merge`
- [x] 1.3 Configure `tsconfig.json` with path aliases (`@/*` -> `src/*`)
- [x] 1.4 Configure `vite.config.ts` with proxy to n8n API (`/api` -> n8n instance)
- [x] 1.5 Setup `tailwind.config.js` with shadcn/ui tokens and custom colors (risk semantic: critical/warn/info)
- [x] 1.6 Configure `.gitignore` for frontend (node_modules, dist, .env)
- [x] 1.7 Create `.env.example` with `VITE_API_BASE_URL`, `VITE_N8N_API_KEY` (placeholder)

## Phase 2: Types / API Client

- [x] 2.1 Create `src/types/api.ts` with DTOs: `Contract`, `Ad`, `Operation`, `ApiResponse<T>`, `RiskQueueItem`
- [x] 2.2 Create `src/services/api.ts` with `ApiClient` class implementing all 10 endpoints from API-CONTRACT-MVP
- [x] 2.3 Implement request/response interceptors for correlation_id injection and error envelope parsing
- [x] 2.4 Add mock fallback in ApiClient for endpoints with status PARCIAL (`listar_ads`, `pause_ad`, `run_now`, `history`)
- [x] 2.5 Create `src/utils/date.ts` with `validateDateFormat()`, `formatDateForTimezone()`, `daysUntilExpiry()` helpers

## Phase 3: Layout / Shell

- [x] 3.1 Create `src/components/layout/Sidebar.tsx` with 4 nav items: Dashboard, Contracts, Operational History, Settings
- [x] 3.2 Create `src/components/layout/Topbar.tsx` with global search placeholder and Run now button
- [x] 3.3 Create `src/components/layout/Layout.tsx` composing Sidebar + Topbar + outlet
- [x] 3.4 Create `src/App.tsx` with React Router v6 nested routes and providers (QueryClient, Store)
- [x] 3.5 Create `src/main.tsx` entry point mounting App with React Query provider

## Phase 4: UI Base Components

- [x] 4.1 Create `src/components/ui/Button.tsx` (Primary: filled, Secondary: outline/tonal, Destructive)
- [x] 4.2 Create `src/components/ui/Input.tsx` with leading icon slot
- [x] 4.3 Create `src/components/ui/Badge.tsx` (Status Badge: success/warning/error/neutral + Severity Badge: critical/warn/info)
- [x] 4.4 Create `src/components/ui/Table.tsx` with sticky header, sortable columns, pagination
- [x] 4.5 Create `src/components/ui/Card.tsx` for KPI Card variant
- [x] 4.6 Create `src/components/ui/Skeleton.tsx` for loading states
- [x] 4.7 Create `src/components/ui/AlertBanner.tsx` (info/warning/error variants)
- [x] 4.8 Create `src/components/ui/EmptyState.tsx` with message + CTA

## Phase 5: Domain Components

- [x] 5.1 Create `KPI Card` component composed of Card + Badge for neutral/warning/critical variants
- [x] 5.2 Create `Data Table` component composed of Table + sorting + pagination logic
- [x] 5.3 Create `InlineActionIcon` component with tooltip for view/extend/pause actions
- [x] 5.4 Create `SearchInput` component for global/locally filtered variants

## Phase 6: Hooks / State

- [x] 6.1 Create `src/hooks/useContracts.ts` with `useContracts()`, `useCreateContract()`, `useExtendContract()`, `useFinalizeContract()`
- [x] 6.2 Create `src/hooks/useOperations.ts` with `useRunNow()`, `useHistory()`, `useAdsByContract()`
- [x] 6.3 Create `src/stores/useAppStore.ts` Zustand store for global state (user, theme toggle)

## Phase 7: Screens - Dashboard

- [x] 7.1 Create `src/pages/Dashboard.tsx` with KPI cards: Active Contracts, Expiring in 48h, Expiring Today, Expired Unpaused, Channel Errors
- [x] 7.2 Render Risk table with columns: Contract ID, Influencer, End Date, Contract Status, Severity, Actions
- [x] 7.3 Implement row actions: View contract, Extend contract, Pause ad (enabled only if Meta status is ACTIVE)
- [x] 7.4 Add loading skeleton and empty state: "No risks detected for today."

## Phase 8: Screens - Contracts

- [x] 8.1 Create `src/pages/Contracts.tsx` with table columns: Contract ID, Influencer, Start Date, End Date, Status, Last Check, Actions
- [x] 8.2 Implement "New contract" modal with form: Influencer Name, Contract ID, Start Date, End Date, Ad Matching Pattern
- [x] 8.3 Add row actions: View, Extend, Finalize
- [x] 8.4 Validate dates YYYY-MM-DD and end_date > start_date on form submit
- [x] 8.5 Implement pagination (page, page_size)

## Phase 9: Screens - Operational History

- [x] 9.1 Create `src/pages/OperationalHistory.tsx` with table columns: Date/Time, Trigger Type, Result, Contracts Evaluated, Ads Paused, Expired Found, Errors, Execution ID
- [x] 9.2 Filter by date range (max 90 days), run_mode, result
- [x] 9.3 Implement "View details" action to show execution details
- [x] 9.4 Display NOT_EXERCISED state when latest execution after last fix didn't reach target node

## Phase 10: Screens - Settings

- [x] 10.1 Create `src/pages/Settings.tsx` with modules: Meta Ads connection status, Primary notification channel, Backup channel toggle, Retry policy view
- [x] 10.2 Display timezone: America/Argentina/Buenos_Aires (read-only)
- [x] 10.3 Implement "Test connection" per channel
- [x] 10.4 Mask secret/token fields by default

## Phase 11: Integration End-to-End (with mock fallback)

- [ ] 11.1 Connect Dashboard to `useContracts()` + `useRunNow()` with real API calls (fallback to mock if PARCIAL)
- [ ] 11.2 Connect Contracts to CRUD hooks, verify create -> list -> extend flow
- [ ] 11.3 Connect Operational History to `useHistory()`, verify paginated response
- [ ] 11.4 Test Run now button triggers execution and updates history

## Phase 12: Testing

- [ ] 12.1 Write unit tests for `src/utils/date.ts` (validateDateFormat, formatDateForTimezone, daysUntilExpiry)
- [ ] 12.2 Write unit tests for hooks with MSW (Mock Service Worker): createContract, extendContract
- [ ] 12.3 Write component tests (Button, Badge, Table) with React Testing Library
- [ ] 12.4 Write integration test: create contract -> list -> extend flow
- [ ] 12.5 Write E2E critical paths with Playwright: alta, extension, finalize, pausa

## Phase 13: Documentation / Cleanup

- [ ] 13.1 Create `README.md` in `frontend/` with setup, env config, available scripts, common issues
- [ ] 13.2 Document API proxy configuration in `vite.config.ts`
- [ ] 13.3 Create HANDOFF checklist for operations team: access, credentials, runbook
- [ ] 13.4 Clean up temporary mocks after backend endpoints pass to GREEN

---

## Dependencies and Blockers

| Task | Dependency | Blocker |
|------|------------|----------|
| 4.1-4.8 (UI Base Components) | 3.x (Layout) | None |
| 5.1-5.4 (Domain Components) | 4.x (UI Base Components) | None |
| 6.1-6.3 (Hooks / State) | 2.x (Types / API) | None |
| 7.1-7.4 (Dashboard) | 4.x, 5.x, 6.x | Backend: some endpoints PARCIAL |
| 8.1-8.5 (Contracts) | 4.x, 5.x, 6.x | Backend: `POST /contracts` LISTO, others PARCIAL |
| 9.1-9.4 (Operational History) | 4.x, 6.x | Backend: history endpoint PARCIAL |
| 10.1-10.4 (Settings) | 4.x | None |
| 11.x (Integration) | 7-10 | Backend PARCIAL endpoints - use mock fallback |

### Backend Endpoints Status (from API-CONTRACT-MVP)

- `POST /api/v1/contracts` - **LISTO**
- `GET /api/v1/contracts` - **PARCIAL** (needs mock)
- `PATCH /contracts/{id}/extend` - **LISTO**
- `PATCH /contracts/{id}/finalize` - **PARCIAL** (needs mock)
- `GET /influencers/search` - **PARCIAL**
- `GET /contracts/{id}/ads` - **PARCIAL** (needs mock)
- `POST /ads/{id}/pause` - **PARCIAL** (needs mock)
- `POST /ads/pause-active` - **PARCIAL**
- `POST /operations/run-now` - **PARCIAL** (needs mock)
- `GET /operations/history` - **PARCIAL** (needs mock)

---

## Implementation Order

1. **Phase 1-2**: Setup → Types → API Client (foundational, no blockers)
2. **Phase 3**: Layout shell (provides structure)
3. **Phase 4-5**: UI + Domain components (build on layout)
4. **Phase 6**: Hooks (consume API client)
5. **Phase 7-10**: Screens (consume components + hooks)
6. **Phase 11**: Integration (tie it all together)
7. **Phase 12**: Testing (verify correctness)
8. **Phase 13**: Documentation (hand off)

---

## Definition of Done

Each task must satisfy:

- **Specific**: File path + concrete change
- **Actionable**: Single logical unit
- **Verifiable**: How to confirm it works
- **Small**: Completable in 1 session

Example task with DoD:
> - [ ] 2.1 Create `src/types/api.ts` with DTOs: Contract, Ad, Operation, ApiResponse<T>, RiskQueueItem
> - **DoD**: File created with all interfaces exported. Type-checking passes (`npm run typecheck`).