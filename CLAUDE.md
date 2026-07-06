# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

CRM SaaS **multi-tenant** para inmobiliarias en Colombia. Greenfield en fase de fundaciones (F0). El plan aprobado vive en `docs/plan-maestro.md` (arquitectura, modelo de datos, backlog completo de tareas T0.x–T6.x) y el avance por tarea en `docs/estado.md` — consúltalos antes de implementar cualquier tarea; el plan es la fuente canónica de requisitos. Las decisiones que se desvíen del plan se registran en `docs/decisiones.md`.

## Commands

- `npm run dev` — servidor de desarrollo (Next.js/Turbopack)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint (flat config, incluye `eslint-config-prettier`)
- `npm test` — Vitest, corre `tests/unit/**/*.test.ts` (single run)
- `npx vitest run tests/unit/format.test.ts` — un solo archivo de test
- `npm run format` — Prettier sobre todo el repo (`docs/plan-maestro.md` está en `.prettierignore` a propósito: es copia byte-fiel del plan aprobado, no reformatear)

## Architecture

Next.js 16 App Router + TypeScript + Tailwind v4 + shadcn/ui (nota: el plan dice "Next 15"; se instaló 16, ver `AGENTS.md` para los breaking changes de esta versión). Vitest para unit tests; Playwright llega en T0.4. Supabase (Postgres + Auth + Storage) con Drizzle ORM llega en T0.2–T0.3 — todavía no hay base de datos.

Capas (del plan §2.4–2.5): las rutas y Server Actions en `src/app/` son capa delgada; la lógica de negocio vive en `src/server/services/` (funciones puras/testeables sin HTTP), el acceso a datos en `src/server/db/`, y los clientes externos en `src/server/integrations/{mercadopago,whatsapp,email}/`. Utilidades compartidas y validaciones Zod en `src/lib/` (ej. `formatCOP` en `src/lib/format.ts`).

## Binding rules (from the approved plan)

- **Multi-tenancy row-level:** toda tabla de negocio lleva `tenant_id uuid NOT NULL` + política RLS + índice compuesto `(tenant_id, …)`. Cada módulo nuevo exige un test de aislamiento (tenant A no puede leer/escribir datos de tenant B).
- **Regla $0:** prohibido introducir servicios de pago, registrar cuentas o desplegar sin aprobación explícita del usuario. Si una tarea parece necesitarlo, detente y repórtalo.
- **Idioma:** código e identificadores en inglés; textos visibles de UI en español (es-CO). Moneda en COP (usar `formatCOP`).
- **TDD:** test primero para servicios/utilidades; los criterios de terminado de cada tarea están en las tablas de `docs/plan-maestro.md` §5.1.
- Commits convencionales en inglés en `main`.
