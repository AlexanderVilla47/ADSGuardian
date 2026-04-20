# Design: Front MVP Operational Console

## Technical Approach

El frontend operativo de AdsKiller se construye como SPA con React + TypeScript + Vite, consumiendo los endpoints definidos en API-CONTRACT-MVP v1.0.0 y materializando las pantallas del UI-CONTRACT-MVP. La estrategia prioriza velocidad de entrega MVP sobre features avanzadas, usando componentes desacoplados que permiten evolución futura.

La integración con el backend n8n se realiza mediante cliente APItyped que respects el envelope estándar `{ok, data, error, meta}` y maneja errores según códigos del contrato. Para endpoints con estado PARCIAL en el gap analysis, se implementa fallback con mocks locales que permiten desarrollo offline.

## Architecture Decisions

### Decision: Stack de build y rendering

**Choice**: React 18 + TypeScript + Vite
**Alternatives considered**: Next.js 14 (App Router), Remix, CRA
**Rationale**: Vite ofrece hot module replacement instantáneo y build times 10-50x más rápidos que webpack. Para MVP operativo sin requisitos SSR/SEO, Next.js agrega complejidad innecesaria (server components, routing server-side,-edge functions). El equipo existing ya tiene conocimiento React sólido.

### Decision: Biblioteca de componentes UI

**Choice**: shadcn/ui con Tailwind CSS
**Alternatives considered**: Material UI, Chakra UI, Radix UI sin wrapper, Tailwind puro
**Rationale**: shadcn/ui usa Radix UI (primitiva accesible) + Tailwind (styling consistente), con copies locales de componentes bajo control del equipo. Evita vendor lock-in de librerías como MUI. Sigue el patrón de atomic design del UI Contract (componentes base → domain components → pages).

### Decision: Gestión de estado y cacheo

**Choice**: Zustand (estado global) + TanStack Query v5 (cacheo API)
**Alternatives considered**: Redux Toolkit, Jotai, Context API + SWR
**Rationale**: Zustand ofrece API minimal con middleware built-in (persist, devtools). TanStack Query maneja cacheo, deduplicación, retry automático y sincronización con servidor — ideal para endpoints que retornan datos paginados. Evita boilerplate de Redux.

### Decision: Routing y navegación

**Choice**: React Router v6 con nested routes
**Alternatives considered**: Wouter, TanStack Router, Next.js file-based routing
**Rationale**: API estable y conocida. Nested routes permiten layout shares (Sidebar/Topbar) sin re-render. Para MVP, no se justifica la complejidad de TanStack Router con type-safe routing.

### Decision: Validaciones de dominio

**Choice**: Validaciones de formato UI-side + validaciones de negocio en hooks reutilizables
**Alternatives considered**: Zod en capa API, solo validación backend
**Rationale**: La experiencia de usuario requiere feedback inmediato en formatos (YYYY-MM-DD, timezone). Las validaciones de negocio (pre-check ACTIVE, extensión > fecha actual) se implementan en hooks reuseables que el backend también aplique, pero el front proporciona UX proactive.

### Decision: Testing strategy

**Choice**: Vitest (unit) + React Testing Library + Playwright (E2E)
**Alternatives considered**: Jest + Enzyme + Cypress
**Rationale**: Vitest es 10x más rápido que Jest con compatibility API. Playwright ofrece mejor debugging y cross-browser que Cypress para aplicaciones SPA con estado complejo.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│  ┌──────────┐    ┌─────��────────┐    ┌────────────────┐       │
│  │ Pages    │───▶│ Hooks        │───▶│ API Client     │       │
│  │ (React)  │    │ (useCases)   │    │ (typed fetch)  │       │
│  └──────────┘    └──────────────┘    └────────────────┘       │
│       │                                    │                      │
│       ▼                                    ▼                      │
│  ┌──────────┐                      ┌────────────────┐              │
│  │ Zustand  │◀─────────────────────│ Backend n8n   │              │
│  │ (state) │                       │ F1/F2/F3 REST │              │
│  └──────────┘                       └────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

Flujo detalle para acción de pausa:

```
UI (Pause Ad) 
  → usePauseAd hook 
    → API: POST /api/v1/ads/{ad_id}/pause
      → Backend: F1 dispatch → F2 pre-check → F2 pause → F1 update status
        → Response: {ok, data: {result, precheck_status}}
          → UI update + toast notification
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `frontend/` | Create | Directorio root del proyecto |
| `frontend/package.json` | Create | Dependencias React 18, Vite, Tailwind, Zustand, TanStack Query, React Router |
| `frontend/tsconfig.json` | Create | TypeScript config |
| `frontend/vite.config.ts` | Create | Vite config con proxy a API |
| `frontend/tailwind.config.js` | Create | Tailwind con shadcn/ui tokens |
| `frontend/src/main.tsx` | Create | Entry point |
| `frontend/src/App.tsx` | Create | Router setup + providers |
| `frontend/src/components/ui/` | Create | Componentes base (Button, Input, Badge, Table, Card, Skeleton) |
| `frontend/src/components/domain/` | Create | KPI Card, Data Table, Status Badge, Severity Badge |
| `frontend/src/components/layout/` | Create | Sidebar, Topbar, Layout |
| `frontend/src/pages/` | Create | Dashboard, Contracts, OperationalHistory, Settings |
| `frontend/src/services/api.ts` | Create | Cliente API typed con envelope estándar |
| `frontend/src/hooks/useContracts.ts` | Create | Hooks para operaciones CRUD |
| `frontend/src/hooks/useOperations.ts` | Create | Hooks para run-now, history |
| `frontend/src/types/api.ts` | Create | DTOs del API Contract |
| `frontend/src/utils/date.ts` | Create | Validadores YYYY-MM-DD, formateo timezone |
| `frontend/.env.example` | Create | Variables de entorno |

## Interfaces / Contracts

### Tipos canónicos del frontend

```typescript
// API Contract types
interface Contract {
  contract_id: string;
  influencer_name: string;
  ad_match_pattern: string;
  ad_id?: string;
  ad_name?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  contract_status: 'Activo' | 'Finalizado';
  notified_preventive: boolean;
  notification_channel?: 'slack' | 'telegram' | 'both';
}

interface ContractListResponse {
  total: number;
  items: Contract[];
}

interface Operation {
  execution_id: string;
  correlation_id?: string;
  run_mode: 'manual' | 'scheduled';
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NOT_EXERCISED';
  contracts_evaluated: number;
  ads_paused: number;
  expired_found: number;
  errors: number;
  executed_at: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;
  };
  meta: {
    correlation_id: string;
    execution_id?: string;
    timestamp: string;
    source?: 'f1' | 'f2' | 'f3' | 'api';
  };
}

// Domain types para UI
interface RiskQueueItem extends Contract {
  severity: 'critical' | 'warn' | 'info';
  days_until_expiry: number;
}
```

### API Client signature

```typescript
class ApiClient {
  // Contracts
  createContract(data: CreateContractDTO): Promise<ApiResponse<Contract>>;
  listContracts(params: ContractQueryParams): Promise<ApiResponse<ContractListResponse>>;
  extendContract(contractId: string, newEndDate: string, reason: string): Promise<ApiResponse<Contract>>;
  finalizeContract(contractId: string, reason: string): Promise<ApiResponse<Contract>>;
  
  // Ads
  listAds(contractId: string): Promise<ApiResponse<AdListResponse>>;
  pauseAd(adId: string, contractId: string, reason: string): Promise<ApiResponse<PauseResult>>;
  pauseActiveAds(contractId: string, dryRun: boolean, maxBatch: number): Promise<ApiResponse<PauseBatchResult>>;
  
  // Operations
  runNow(mode: 'manual' | 'scheduled'): Promise<ApiResponse<RunNowResponse>>;
  getHistory(params: HistoryQueryParams): Promise<ApiResponse<OperationHistoryResponse>>;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | Utils (date validation), hooks (logic), components (props → output) | Vitest + React Testing Library |
| Integration | API client, full flows (alta → extend → finalize) | Vitest + MSW (Mock Service Worker) |
| E2E | Critical paths (crear contrato, pausa ad, run manual) | Playwright |

### Coverage targets MVP

- Componentes UI base: 70%
- Hooks de dominio: 80%
- Utils: 90%
- E2E: 4 critical flows (alta, extend, finalize, pausa)

## Migration / Rollout

No migration required para MVP — greenfield project.

 rollout:
1. Setup frontend local con `npm run dev`
2. Configurar `.env` con API base URL
3. Verificar proxy en Vite config apunta a n8n instance
4. Validar endpoints con mocks locales
5. Integrar con API real incrementally

## Open Questions

- [ ] **`influencers/search` NO implementado**: El screen de búsqueda de influencer está bloqueado. ¿Usar fallback temporal (búsqueda local en lista cached) o esperar implementación backend?
- [ ] **Estado PARCIAL de endpoints runtime**: Endpoints como `GET /contracts` y `POST /ads/{id}/pause` tienen estado PARCIAL. ¿Aceptar desarrollo con mocks locales hasta que backend pasen validación GREEN?
- [ ] **Autenticación**: No hay spec para auth. ¿Implementar mocks de autenticación (JWT placeholder) o dejar como opcional para MVP?

## Next Recommended

1. Crear tasks breakdown (sdd-tasks) basado en este design
2. Setup proyecto React + Vite + Tailwind
3. Implementar tipos y API client
4. Construir layout (Sidebar + Topbar)
5. Implementar componentes base
6. Implementar Dashboard como primer screen