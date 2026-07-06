# Decisiones de arquitectura (ADRs)

Registro corto de decisiones que se desvían del plan maestro o lo precisan. Formato: contexto → decisión → consecuencia.

## ADR-001 — Next.js 16 en lugar de 15 (2026-07-06)

- **Contexto:** el plan (§2.1) asumía Next.js 15; al ejecutar T0.1 la última estable era 16.2.10 y el brief pedía "última versión estable".
- **Decisión:** se adopta Next.js 16 (App Router). `AGENTS.md` (generado por el scaffold) documenta los breaking changes relevantes de esta versión.
- **Consecuencia:** las tareas T0.2+ deben seguir convenciones de Next 16; el plan no se reescribe, esta nota prevalece sobre la mención "15".

## ADR-002 — Identidad git local del repo (2026-07-06)

- **Contexto:** la máquina no tenía `user.name`/`user.email` configurados en ningún nivel.
- **Decisión:** se configuró identidad solo a nivel de este repo para poder commitear (sin tocar config global).
- **Consecuencia:** si el usuario prefiere otra identidad para commits futuros, basta `git config user.name/user.email` en el repo.
