# Frontend AdsKiller MVP - Estado de Implementación

## Resumen Ejecutivo

El frontend operativo de AdsKiller está **mayormente implementado** (12/13 phases completadas). Compila correctamente pero aún no está conectado al backend real - usa mocks para endpoints que no están operativos.

**Última compilación**: ✅ Exit code 0
**Build time**: ~22 segundos

---

## Estado por Phase

| Phase | Estado | Descripción |
|-------|--------|-------------|
| **Phase 1** | ✅ COMPLETO | Setup (Vite, React 18, TypeScript, Tailwind, TanStack Query) |
| **Phase 2** | ✅ COMPLETO | Tipos TypeScript + API Client con mocks |
| **Phase 3** | ✅ COMPLETO | Layout (Sidebar, Topbar, Layout, Router) |
| **Phase 4** | ✅ COMPLETO | UI Components (Button, Input, Badge, Table, etc.) |
| **Phase 5** | ✅ COMPLETO | Domain Components (KpiCard, DataTable, InlineActionIcon) |
| **Phase 6** | ✅ COMPLETO | Hooks (useContracts, useOperations) + Zustand store |
| **Phase 7** | ✅ COMPLETO | Dashboard (KPIs + Risk Table) |
| **Phase 8** | ✅ COMPLETO | Contracts (Tabla + 4 modales) |
| **Phase 9** | ✅ COMPLETO | Operational History (Tabla + Filtros) |
| **Phase 10** | ✅ COMPLETO | Settings (Meta Ads, Channels, Retry Policy, Timezone) |
| **Phase 11** | ⏳ PENDIENTE | Integración con API real |
| **Phase 12** | ⏳ PENDIENTE | Testing |
| **Phase 13** | ⏳ PENDIENTE | Documentación |

---

## Archivos Creados

### Estructura del Proyecto

```
frontend/
├── package.json              # Dependencias: React 18, Vite, Tailwind, TanStack Query, Zustand
├── tsconfig.json             # TypeScript config con path aliases @/*
├── vite.config.ts            # Proxy /api -> n8n instance
├── tailwind.config.js        # Tokens shadcn/ui + colores de riesgo
├── index.html                # HTML base
├── .gitignore
├── .env.example
├── dist/                     # Build de producción
└── src/
    ├── main.tsx              # Entry point con React Query provider
    ├── App.tsx               # Router v6: /dashboard, /contracts, /history, /settings
    ├── index.css             # Tailwind base styles
    ├── vite-env.d.ts
    ├── types/
    │   └── api.ts            # DTOs: Contract, Ad, Operation, ApiResponse, RiskQueueItem
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts     # Axios instance + interceptors + mock fallback
    │   │   └── endpoints.ts  # Funciones para todos los endpoints
    │   ├── utils.ts          # cn() helper
    │   └── utils/
    │       └── date.ts       # YYYY-MM-DD validators, timezone helpers
    ├── components/
    │   ├── ui/               # Button, Input, Badge, Table, Card, Dialog, AlertBanner, EmptyState, Skeleton, Label
    │   ├── domain/           # KpiCard, DataTable, InlineActionIcon, SearchInput
    │   └── layout/           # Sidebar, Topbar, Layout
    ├── pages/
    │   ├── Dashboard.tsx     # KPIs + Risk Queue
    │   ├── Contracts.tsx     # Tabla + paginación
    │   ├── History.tsx       # Tabla + filtros
    │   ├── Settings.tsx      # Configuraciones
    │   └── modals/           # NewContract, ExtendContract, ViewContract, FinalizeContract
    ├── hooks/
    │   ├── useContracts.ts   # useContracts, useCreateContract, useExtendContract, useFinalizeContract
    │   └── useOperations.ts  # useRunNow, useHistory, useAdsByContract
    └── stores/
        └── useAppStore.ts    # Zustand: user, theme
```

---

## Lo que funciona

1. **Compilación**: `npm run build` genera `dist/` sin errores
2. **Router**: Navegación entre las 4 pantallas funciona
3. **Layout**: Sidebar (desktop) + Bottom Nav (mobile) + Topbar con Run Now
4. **Componentes UI**: Todos los componentes base creados y tipados
5. **Formularios**: Los 4 modales de Contracts tienen validaciones (react-hook-form + zod)
6. **Mock fallback**: El API client devuelve datos mockeados para endpoints PARCIALES/NO

---

## Lo que NO funciona aún

### 1. Integración con backend real (Phase 11)

Las screens muestran datos de mocks. Para conectar al backend real:

- Configurar `VITE_API_BASE_URL` en `.env` (apuntar a instancia n8n)
- Configurar `VITE_N8N_API_KEY` en `.env`
- Quitar mocks cuando endpoints pasen a GREEN

### 2. Testing (Phase 12)

- No hay tests unitarios
- No hay tests de integración
- No hay E2E

### 3. Documentación (Phase 13)

- Falta README.md
- Falta HANDOFF checklist

---

## Cómo levantarlo

```bash
cd frontend
npm install
npm run dev
```

Esto levanta el server en `http://localhost:5173`.

Para producción:
```bash
npm run build
# sirve desde dist/
```

---

## Notas Técnicas

### Validaciones implementadas

- Formato YYYY-MM-DD en todos los inputs de fecha
- Timezone: America/Argentina/Buenos_Aires
- End Date > Start Date en formularios
- Contract ID único (validación cliente)
- Pre-check de estado ACTIVE antes de pausar ad

### Gaps conocidos

- `influencers/search` endpoint no existe (screen bloqueado)
- Algunos endpoints necesitan mocks porque el backend tiene problemas de credencial OAuth2

---

## Siguiente paso recomendado

1. **Si el backend está operativo**: Conectar Phase 11 (quitar mocks, usar API real)
2. **Si el backend NO está operativo**: Implementar Phase 12 (tests) + Phase 13 (docs)
3. **Para operativo**: Correr en producción con `npm run build` y servir con nginx/apache

---

## Referencias

- UI Contract: `docs/stitch/UI-CONTRACT-MVP.md`
- API Contract: `docs/stitch/API-CONTRACT-MVP.md`
- Tasks SDD: `openspec/changes/front-mvp-operational-console/tasks.md`