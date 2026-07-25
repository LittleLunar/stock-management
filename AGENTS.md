# Stock Management — LLM Wiki Agent Schema

This repository maintains an Obsidian-compatible LLM wiki at `wiki/`. The wiki is the canonical knowledge layer for product vision, domain model, architecture, phases, and patterns.

## Skills

- **Checked:** using-superpowers, documentation-writer, obsidian-markdown, memory-management, task-management, writing-plans
- **Using:** wiki contract + skill router (this repo)
- Global skills: `~/.agents/skills/<name>/SKILL.md`

## Wiki location

```
wiki/
  index.md           ← master catalog (update on every ingest)
  log.md             ← append-only activity log
  overview.md        ← high-level domain synthesis
  Getting Started.md ← onboarding for agents and humans
  entities/          ← products, org units, documents, systems
  concepts/          ← architecture, costing, accounting, patterns
  features/          ← phase and capability pages
  flows/             ← cross-cutting operational flows
  sources/           ← summaries of ingested specs/conversations
  comparisons/       ← side-by-side tables
  analyses/          ← deeper dives filed from queries
raw/
  assets/            ← Obsidian attachment folder (immutable)
```

## Mandatory contract

> [!important]
> **Read relevant wiki pages BEFORE every operation (ingest, query, lint, update). Update all affected pages AFTER every operation.** Never skip read-before or write-after.

Canonical rule: `.cursor/rules/wiki-contract.mdc`

## Skill-first contract

Before every operation:

1. Read `~/.agents/skills/using-superpowers/SKILL.md` when classifying work
2. Follow `.cursor/rules/skills-router.mdc` for this repo
3. Prefer process skills (brainstorming, writing-plans, systematic-debugging) before implementation

Canonical rule: `.cursor/rules/skill-superpowers-first.mdc`

## Page conventions

- YAML frontmatter: `tags`, `created`, `updated`; plus `source_count` on concept/entity pages
- Use `[[wikilinks]]` for all internal cross-references
- Entity/concept pages end with `## Sources`
- Keep pages factual; opinions and deep analysis go in `analyses/`

## Key wiki pages by topic

| Topic | Canonical page |
|-------|----------------|
| Product overview | [[overview]], [[Stock Management System]] |
| Stack | [[Tech Stack]] |
| Domain model | [[Domain Model]] |
| Stock truth | [[Document-Driven Inventory]] |
| Costing | [[FIFO Costing]] |
| Accounting | [[Inventory Accounting]] |
| Multi-branch | [[Org Branch Location]] |
| POS readiness | [[POS Integration Boundary]] |
| Phase inventory | [[Feature Phases]] |
| Phase A–F detail | [[features/Phase A]], … [[features/Phase F]] |
| Build plan | `docs/superpowers/plans/` |

## Docs vs wiki

| Location | Purpose |
|----------|---------|
| `wiki/` | Compounding knowledge (entities, concepts, links) |
| `docs/` | Diátaxis docs, specs, implementation plans |
| `TASKS.md` | Active work tracking |
| `CLAUDE.md` + `memory/` | Hot cache + deep project memory |

## Ingest style

Ingest from conversation decisions, specs under `docs/superpowers/specs/`, and code as it lands. Update [[index]] and [[log]] every time.

## Search

Use `wiki/index.md` as catalog. Grep/`[[wikilinks]]` for navigation.
