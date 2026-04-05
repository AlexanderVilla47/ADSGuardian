# Skill Registry

**Orchestrator use only.** Read this registry once per session to resolve skill paths, then pass pre-resolved paths directly to each sub-agent's launch prompt. Sub-agents receive the path and load the skill directly — they do NOT read this registry.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| Discover/install missing capabilities | `find-skills` | `C:\Users\Usuario\.agents\skills\find-skills\SKILL.md` |
| n8n Code node JavaScript guidance | `n8n-code-javascript` | `C:\Users\Usuario\.agents\skills\n8n-code-javascript\SKILL.md` |
| n8n Code node Python guidance | `n8n-code-python` | `C:\Users\Usuario\.agents\skills\n8n-code-python\SKILL.md` |
| n8n expression design and troubleshooting | `n8n-expression-syntax` | `C:\Users\Usuario\.agents\skills\n8n-expression-syntax\SKILL.md` |
| n8n node setup by operation | `n8n-node-configuration` | `C:\Users\Usuario\.agents\skills\n8n-node-configuration\SKILL.md` |
| n8n validation interpretation and fixes | `n8n-validation-expert` | `C:\Users\Usuario\.agents\skills\n8n-validation-expert\SKILL.md` |
| General website audit tasks | `audit-website` | `C:\Users\Usuario\.agents\skills\audit-website\SKILL.md` |
| Frontend design tasks | `frontend-design` | `C:\Users\Usuario\.agents\skills\frontend-design\SKILL.md` |
| UX/UI design guidance | `ui-ux-pro-max` | `C:\Users\Usuario\.agents\skills\ui-ux-pro-max\SKILL.md` |
| Web design best-practice guidance | `web-design-guidelines` | `C:\Users\Usuario\.agents\skills\web-design-guidelines\SKILL.md` |
| Go tests and Bubbletea testing | `go-testing` | `C:\Users\Usuario\.config\opencode\skills\go-testing\SKILL.md` |
| Create new AI skills | `skill-creator` | `C:\Users\Usuario\.config\opencode\skills\skill-creator\SKILL.md` |
| Generate/update project skill registry | `skill-registry` | `C:\Users\Usuario\.config\opencode\skills\skill-registry\SKILL.md` |
| n8n workflow architecture patterns | `n8n-workflow-patterns` | `C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\.agents\skills\n8n-workflow-patterns\SKILL.md` |
| Expert usage of n8n-mcp tools | `n8n-mcp-tools-expert` | `C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\.agents\skills\n8n-mcp-tools-expert\SKILL.md` |
| Production API/HTTP integration in n8n | `n8n-api-http-robusta` | `C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\.agents\skills\n8n-api-http-robusta\SKILL.md` |
| Workflow observability and operational telemetry | `n8n-observability` | `C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\.agents\skills\n8n-observability\SKILL.md` |
| Workflow testing strategy and regression | `n8n-workflow-testing` | `C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\.agents\skills\n8n-workflow-testing\SKILL.md` |

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| `AGENTS.md` | `C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\AGENTS.md` | Index — reglas del proyecto, inventario y política de skills |
| `skills-gap-analysis.md` | `C:\Users\Usuario\Desktop\Proyectos\Automatizaciones\AdsKiller\docs\skills-gap-analysis.md` | Referenciado por AGENTS para cobertura/gaps |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
