# Agent Memory Notes

Persistent corrections and clarifications about this codebase.

## LLM Wiki

Stock-management wiki at `wiki/`. Read `wiki/index.md` before architecture/feature work. Schema: root `AGENTS.md` + `wiki/AGENTS.md`. Rule: `.cursor/rules/wiki-contract.mdc`.

## Skill-first workflow

Use global skills under `~/.agents/skills/`. Router: `.cursor/rules/skills-router.mdc`. Superpowers: `.cursor/rules/skill-superpowers-first.mdc`.

## Stack lock

Fastify + Drizzle + Postgres + Vite/React + TanStack + Tailwind. See `.cursor/rules/stack-conventions.mdc`.

## Memory

Hot cache: `CLAUDE.md`. Deep: `memory/`. Tasks: `TASKS.md`.
