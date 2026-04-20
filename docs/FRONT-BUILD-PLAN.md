# Plan de Construcción Frontend AdsKiller MVP

## Resumen Ejecutivo

Este plan establece la hoja de ruta para construir el frontend operativo de AdsKiller basándose en los contratos definidos en la carpeta `docs/stitch/`. El frontend debe consumir los endpoints definidos en `API-CONTRACT-MVP.md` y materializar las pantallas especificadas en `UI-CONTRACT-MVP.md`.

---

## Fases del Plan

### Fase 1: Fundamentos del Frontend (Semana 1-2)

#### 1.1 Configuración del Proyecto

- **Stack recomendado**: React + TypeScript + Vite (o Next.js para mejor SEO/performance)
- **Librería de componentes**: shadcn/ui (Tailwind CSS) para seguir patrones de diseño accesibles
- **Estado global**: Zustand o React Query para gestión de estado y cacheo de API
- **Rutas**: React Router v6+ para navegación entre pantallas

#### 1.2 Estructura de Proyecto

```
src/
├── components/          # Componentes reutilizables del UI Contract
│   ├── ui/              # Componentes base (Button, Input, Badge, etc.)
│   ├── layout/          # Sidebar, Topbar, Layout general
│   └── domain/          # KPI Card, Data Table, Status Badge, etc.
├── pages/               # Screen definitions del UI Contract
│   ├── Dashboard/
│   ├── Contracts/
│   ├── OperationalHistory/
│   ├── Settings/
│   └── SearchResults/
├── services/            # Cliente API (axios o fetch wrapper)
├── hooks/               # Custom hooks para lógica de dominio
├── types/               # TypeScript interfaces (DTOs del API Contract)
├── utils/               # Helpers (formateo de fechas, validaciones YYYY-MM-DD)
└── constants/           # Configuraciones (timezone, endpoints base)
```

#### 1.3 Tipos y DTOs Base

Generar TypeScript interfaces basadas en el API Contract MVP:

```typescript
// Tipos prioritarios a definir
interface Contract {
  contract_id: string;
  influencer_name: string;
  ad_match_pattern: string;
  start_date: string;      // YYYY-MM-DD
  end_date: string;        // YYYY-MM-DD
  contract_status: 'Activo' | 'Finalizado';
  notified_preventive: boolean;
  notification_channel: 'slack' | 'telegram' | 'both';
}

interface Operation {
  execution_id: string;
  correlation_id: string;
  run_mode: 'manual' | 'scheduled';
  result: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'NOT_EXERCISED';
  contracts_evaluated: number;
  ads_paused: number;
  expired_found: number;
  errors: number;
  executed_at: string;     // ISO 8601
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
```

---

### Fase 2: Componentes Reutilizables (Semana 2-3)

#### 2.1 Componentes del UI Contract

Construir los componentes definidos en la sección 4 del `UI-CONTRACT-MVP.md`:

| Componente | Variantes | Prioridad | Notas |
|------------|-----------|-----------|-------|
| KPI Card | neutral, warning, critical | Alta | Título + valor + trend opcional |
| Data Table | contracts, risk, executions | Alta | Sticky header, sortable, paginación |
| Status Badge | success, warning, error, neutral, info | Alta | Uppercase, color semántico |
| Severity Badge | critical, warn, info | Alta | Visible siempre en cola de riesgo |
| Primary Button | default, destructive | Alta | Una primaria por área |
| Secondary Button | outline/tonal | Media | Nunca competir con jerarquía primaria |
| Inline Action Icon | view, extend, pause | Alta | Tooltip siempre presente |
| Search Input | global, local filter | Alta | Icono líder + placeholder claro |
| Alert Banner | info, warning, error | Media | Mensaje accionable y corto |
| Empty State Block | no data/no results | Media | Una oración + un CTA |

#### 2.2 Layout y Navegación

Implementar según especificación del `UI-CONTRACT-MVP.md`:

**Sidebar (Desktop)**:
- Orden: Dashboard → Contracts → Operational History → Settings
- Regla: Un item activo con background filled + icono accent
- Excluir: Help/Profile del nav principal (solo perfil en footer del sidebar)

**Topbar (Todas las pantallas)**:
- Izquierda: Global search input (`Search contracts, influencers, or execution IDs...`)
- Derecha: Botón `Run now` (siempre visible, primario) + avatar usuario + rol

**Mobile**:
- Bottom nav con los mismos 4 items
- `Run now` como floating action button sticky

---

### Fase 3: Pantallas del Frontend (Semana 3-5)

#### 3.1 Dashboard (Prioridad Alta)

**Objetivo**: Salud operativa inmediata y cola de riesgo para intervención.

**Bloques de datos**:
- KPI Cards: Active Contracts, Expiring in 48h, Expiring Today, Expired Unpaused, Channel Errors
- Tabla de riesgo: Contract ID, Influencer, End Date, Contract Status, Severity, Actions

**Acciones principales**:
- `Run now`
- `View contract` → navegar a pantalla de detalle
- `Extend contract` → abrir modal con validación de fecha
- `Pause ad` → solo habilitado si estado en Meta es `ACTIVE`

**Validaciones de dominio (no negociables)**:
- `Pause ad` solo si ad status en Meta = `ACTIVE`
- `Extend contract` requiere `new_end_date` en YYYY-MM-DD > end_date actual
- Al extender, resetear flag `notified_preventive` a false

**Estados de carga**:
- Loading: skeleton para KPI cards y filas de tabla
- Empty: "No risks detected for today."
- Error: "Unable to load dashboard data. Try again."
- Success: KPIs + tabla

#### 3.2 Contracts (Prioridad Alta)

**Objetivo**: Gestión del ciclo de vida del contrato (alta, revisión, extensión, finalización).

**Acciones principales**:
- `New contract` → formulario con validación
- `Sync channels` → integración con canales
- Fila: `View`, `Extend`, `Finalize`

**Columnas de tabla (MVP)**:
- Contract ID, Influencer, Start Date, End Date, Contract Status, Last Check, Actions

**Validaciones del formulario**:
- Campos requeridos: Influencer Name, Contract ID, Start Date, End Date, Ad Matching Pattern
- Fechas: formato YYYY-MM-DD, End > Start
- Contract ID: único
- Ad matching pattern: no vacío, preview requerido antes de guardar

#### 3.3 Operational History (Prioridad Media)

**Objetivo**: Auditoría de ejecuciones y resultados para runs programados/manuales.

**Columnas**:
- Date/Time, Trigger Type (Scheduler | Manual), Result (SUCCESS | PARTIAL | FAILED | NOT_EXERCISED), Contracts Evaluated, Ads Paused, Expired Found, Errors, Execution ID, Action

**Acciones**:
- `Run now`
- `Filter` (filtros por fecha hasta 90 días, result, run_mode)
- `View details` → modal o panel con detalles de ejecución

**Regla operativa**: Si el nodo objetivo no se alcanzó en la última ejecución tras el último fix, marcar como `NOT EXERCISED`

#### 3.4 Settings (Prioridad Media)

**Objetivo**: Configurar parámetros operativos y canales de integración.

**Módulos**:
- Meta Ads connection status
- Primary notification channel
- Backup channel toggle (off por defecto en MVP)
- Retry policy view (3 intentos, 5 min wait)
- Timezone display (America/Argentina/Buenos_Aires, solo lectura)

**Acciones**:
- `Save settings`
- `Test connection` por canal

**Validaciones**:
- Campos de secreto/token tapados por defecto
- `Save settings` deshabilitado si faltan datos requeridos de conexión
- Test de canal debe pasar antes de habilitarlo como activo

#### 3.5 Influencer Search Results (Prioridad Baja - Bloqueada)

**Objetivo**: Resolver términos de búsqueda ambiguos y rutear al perfil/contrato correcto.

**Nota**: Este screen está bloqueado porque el endpoint `GET /api/v1/influencers/search` tiene estado `NO` en el gap analysis. Priorizar construcción después de que el backend implemente esta funcionalidad.

---

### Fase 4: Integración con API (Semana 4-6)

#### 4.1 Cliente API

Implementar cliente que respete el envelope estándar del API Contract:

```typescript
// Estructura de respuesta canónica
const response = await api.get('/contracts');
// { ok: true, data: {...}, meta: {...} }
```

#### 4.2 Endpoints a Consumir

| Endpoint | Método | Estado Backend | Prioridad |
|----------|--------|-----------------|-----------|
| `/api/v1/contracts` | POST | LISTO | Alta |
| `/api/v1/contracts` | GET | PARCIAL | Media (limitado a dias_proximos) |
| `/api/v1/contracts/{id}/extend` | PATCH | LISTO | Alta |
| `/api/v1/contracts/{id}/finalize` | PATCH | PARCIAL | Media |
| `/api/v1/influencers/search` | GET | NO | Baja (bloqueado) |
| `/api/v1/contracts/{id}/ads` | GET | PARCIAL | Media |
| `/api/v1/ads/{id}/pause` | POST | PARCIAL | Alta |
| `/api/v1/ads/pause-active` | POST | PARCIAL | Baja |
| `/api/v1/operations/run-now` | POST | PARCIAL | Media |
| `/api/v1/operations/history` | GET | PARCIAL | Media |

#### 4.3 Manejo de Errores

Implementar manejo según códigos de error del API Contract:
- `VALIDATION_ERROR` (400) → mostrar mensaje de validación al usuario
- `NOT_FOUND` (404) → "No se encontró el recurso"
- `CONFLICT` (409) → mostrar conflicto específico
- `UNSUPPORTED_ACTION` (422) → "Acción no soportada"
- `PRECONDITION_FAILED` (412) → "No cumple precondición" (ej: ad no está ACTIVE)
- `RATE_LIMITED` (429) → "Too many requests, reintentar en X minutos"
- `UPSTREAM_ERROR` (502) → "Error upstream, contact support"
- `INTERNAL_ERROR` (500) → "Error interno, reintentar"

#### 4.4 Retry Logic

- Para errores 429 y 500: implementar retry automático con 3 intentos y 5 minutos de espera entre intentos
- Mostrar feedback al usuario durante reintentos

---

### Fase 5: Validaciones de Dominio (Semana 5-6)

#### 5.1 Validaciones No Negociables

Implementar en el frontend según `UI-CONTRACT-MVP.md`:

1. **Formatos de fecha**:
   - Todos los inputs de fecha deben usar formato YYYY-MM-DD
   - Mostrar timezone label: "America/Argentina/Buenos_Aires"

2. **Flujo de pausa de ad**:
   - Targeting: solo a nivel Ad (no Ad Set ni Campaign)
   - Pre-check obligatorio: verificar estado `ACTIVE` en Meta antes de intentar pausar
   - Post-pausa: contract status debe cambiar a `Finalizado`

3. **Extensión de contrato**:
   - `new_end_date` > `end_date` actual
   - Resetear `notified_preventive` a false tras extensión exitosa

4. **Retry policy**:
   - Visualizar: 3 intentos, 5 minutos de espera
   - Para errores 429/500 del backend

---

### Fase 6: Testing y QA (Semana 6-7)

#### 6.1 Pruebas Unitarias

- Componentes de UI: React Testing Library
- Utilidades de validación de fechas
- Mappers de DTOs

#### 6.2 Pruebas de Integración

- Mock de API responses según API Contract
- Flujo completo Happy Path para cada screen
- Flujos de error (400, 404, 429, 500)

#### 6.3 Pruebas E2E (Opcional)

- Cypress o Playwright para flujos críticos:
  - Crear contrato → extender → finalizar
  - Pausar ad con pre-check
  - Ejecutar run manual

---

### Fase 7: Documentación Handoff (Semana 7-8)

#### 7.1 Entregables

1. **README.md del proyecto frontend**:
   - Instrucciones de setup y run
   - Stack y dependencias
   - Estructura de directorios

2. **HANDOFF-DEV-CHECKLIST.md**:
   - Checklist de verificación para developers
   - Validaciones de dominio a probar
   - Endpoints a mockear

3. **UI Contract actualizado**:
   - Copia del UI-CONTRACT-MVP.md en el repo del frontend
   - Notas de implementación si hay deviations

---

## Dependencias y Precedencias

### Dependencias del Backend

El frontend depende de que los siguientes endpoints estén operativos:

| Endpoint | Estado Requerido | Bloquea |
|----------|-----------------|---------|
| POST /contracts | LISTO | Pantalla Contracts - Alta |
| GET /contracts | PARCIAL (limitado) | Dashboard - Consulta |
| PATCH /contracts/{id}/extend | LISTO | Dashboard + Contracts - Extensión |
| POST /ads/{id}/pause | PARCIAL | Dashboard - Pausa ad |

### Precedencias de Construcción

```
1. Setup proyecto + tipos básicos
2. Layout (Sidebar + Topbar)
3. Componentes base (Button, Input, Badge, Table)
4. Dashboard (KPIs + Risk Table)
5. Contracts (Tabla + Formulario Alta)
6. Operational History (Tabla + Filtros)
7. Settings (Configuraciones)
8. Integración API real
9. Testing
```

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|-------------|
| Endpoint `influencers/search` no implementado | Pantalla search no funcional | Construir después de que backend complete; usar fallback temporal |
| Endpoints con estado PARCIAL en runtime | Testing limitado | Usar mocks locales para desarrollo; documentar gaps en HANDOFF |
| Validaciones de dominio en frontend vs backend | Inconsistencias | Centralizar validaciones en hooks reutilizables; no duplicar lógica |
| Timezone America/Argentina/Buenos_Aires | Fechas incorrectas | Usar biblioteca de fechas con timezone fijo (date-fns-tz o dayjs) |

---

## Métricas de Éxito

- [ ] Frontend compila sin errores y corre en localhost
- [ ] Todas las pantallas del UI Contract están implementadas
- [ ] Validaciones de dominio funcionan correctamente
- [ ] Integración con API (mock o real) exitosa
- [ ] Tests unitarios cubren componentes críticos
- [ ] Documentación de handoff entregada

---

## Referencias

- UI Contract: `docs/stitch/UI-CONTRACT-MVP.md`
- API Contract: `docs/stitch/API-CONTRACT-MVP.md`
- Gap Analysis: `docs/stitch/FRONT-VS-FLOWS-GAP.md`
- Mapping API vs Flows: `docs/stitch/API-CONTRACT-vs-FLOWS-MAPPING.md`