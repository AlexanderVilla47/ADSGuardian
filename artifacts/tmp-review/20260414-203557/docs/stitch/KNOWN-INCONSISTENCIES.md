# Known Inconsistencies in Stitch Screens and Resolution

This document captures inconsistencies detected in `docs/stitch` and the unification decision applied in the MVP UI Contract.

| Area | Inconsistency detected | Evidence in Stitch folders | Resolution decision |
|---|---|---|---|
| Navigation naming | Mixed menu item names: `Ejecuciones y Alertas`, `Ejecuciones`, `Historial Operativo` | `dashboard_*`, `contratos_*`, `historial_*`, `configuraci_n_*` | Use only `Operational History` in final nav |
| Extra module in nav | `Explorar` appears only in search suggestion views | `sugerencias_de_b_squeda_*` | Remove from main nav; keep influencer search as contextual screen |
| Shell structure | Some screens use top-nav only, others sidebar + topbar, others both duplicated | `sugerencias_de_b_squeda_*`, `detalle_de_contrato_*`, `dashboard_*` | Single shell: fixed sidebar + fixed topbar across all screens |
| Active item behavior | Active styles vary heavily (underline, fill, left accent, text-only) | Almost all variants | Standardize to filled active item with icon + label |
| Language consistency | Mixed ES/EN labels: `Contratos Management`, `Run now`, `Corridas`, `New Contract` | `contratos_*`, `dashboard_*`, `historial_*` | Final copy in EN labels/messages per UI contract |
| Profile placement | User info appears in sidebar footer and also topbar in multiple variants | `configuraci_n_*`, `historial_*`, `contratos_*` | Keep compact profile in topbar; optional minimal identity in sidebar footer only |
| Primary CTA purpose | Conflicting primary CTAs (`Run now`, `New Contract`, `Save Channel Configuration`) with no hierarchy | `dashboard_*`, `contratos_*`, `configuraci_n_*` | One operational primary action per screen; global topbar keeps `Run now` |
| Status model | Different status vocabularies: `Active/Paused/Critical Risk`, `SUCCESS/PARTIAL/FAILED` | `contratos_*`, `historial_*`, `dashboard_*` | Split into two taxonomies: Contract Status and Execution Result |
| Date format | Human-readable dates and ISO mixed (`Oct 12, 2024` vs `2026-05-20`) | `contratos_*`, `dashboard_*`, `historial_*` | Inputs/validations enforce `YYYY-MM-DD`; presentation can be localized but consistent |
| Channel scope | Settings variants imply broad channel setup (Slack/Telegram/API) without clear MVP boundary | `configuraci_n_*`, `configuraci_n_de_canales_*` | Keep channels module but constrain to operational needs and explicit validation/test |
| Search results behavior | Ambiguity alert, score cards, and actions vary across search versions | `sugerencias_de_b_squeda_*`, `perfil_operativo_*` | Define one influencer result pattern: query summary + ranked cards + clear actions |
| Mobile nav parity | Some screens lack consistent mobile bottom nav items | `dashboard_*`, `contratos_*`, `configuraci_n_*` | Mobile nav must mirror desktop nav 1:1 |
| Table actions | Row actions differ by icon set, label, and availability | `dashboard_*`, `contratos_*` | Standard row action set by context: View, Extend, Pause ad/Finalize |
| Header search placeholder | Placeholders vary by screen (`Buscar corrida`, `Search parameters`, etc.) | `historial_*`, `configuraci_n_*`, `contratos_*` | Use one global search placeholder and contextual filtering below |

## Final note

Stitch artifacts remain valuable references for layout and components, but not as canonical UX behavior. Canonical behavior is defined in `docs/stitch/UI-CONTRACT-MVP.md`.
