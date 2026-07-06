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

## ADR-003 — Claims `tenant_id`/`role` vía `app_metadata`, sin Custom Access Token Hook (2026-07-06)

- **Contexto:** el plan (§2.3) preveía un Custom Access Token Hook de Supabase para inyectar `tenant_id`/`role` en el JWT. Al implementar T0.3 (esquema núcleo + RLS) hacía falta una fuente de esos claims para que las políticas RLS los lean sin una consulta extra.
- **Decisión:** los claims viajan en `app_metadata` del JWT (no en `user_metadata`, que sí es editable por el usuario final). `app_metadata` se setea server-side con `service_role` al crear el usuario/membership (T0.4) y Supabase lo incluye en todo JWT que emite de forma nativa — no requiere configurar ni mantener un Custom Access Token Hook. Las funciones `public.current_tenant_id()` y `public.current_member_role()` (creadas en la migración `0001_rls_policies.sql`) leen `auth.jwt() -> 'app_metadata'`.
- **Consecuencia:** T0.4 debe escribir `app_metadata.tenant_id`/`app_metadata.role` al crear usuarios/memberships (vía Admin API, `service_role`) en vez de configurar un hook; si el rol de un usuario cambia, su JWT actual queda desactualizado hasta el próximo refresh de sesión (aceptable para el MVP, se documenta como limitación conocida). Esta nota reemplaza la mención al hook en el plan §2.3.
