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

## ADR-005 — Invitaciones por link copiable; email tras interfaz con driver de consola (2026-07-06)

- **Contexto:** T0.4 necesita invitar miembros al equipo. Enviar correo real requiere una cuenta de
  un proveedor (Resend o similar), que por la regla $0 no se puede registrar sin aprobación del
  usuario (se pedirá en el checkpoint de fin de F0). El SMTP integrado de Supabase tiene un rate
  limit inutilizable para esto (2–4 correos/hora).
- **Decisión:** el flujo de invitación NO depende del email. El admin crea la invitación y obtiene
  un **link copiable** para compartir por el canal que quiera (WhatsApp es lo natural en el nicho).
  El envío de correo queda tras una interfaz `EmailSender` (`send({to, subject, html})`) en
  `src/server/integrations/email/`, con `ConsoleEmailSender` (loguea el correo en el server) como
  única implementación por ahora; un fallo de envío nunca hace fallar la invitación.
- **Consecuencia:** cuando exista la cuenta de Resend basta implementar otro driver de
  `EmailSender` sin tocar el flujo. En la BD solo se guarda el hash SHA-256 del token de
  invitación; el token en claro vive únicamente en el link que ve el admin al crearla.

## ADR-006 — Registro sin confirmación de email en el MVP (2026-07-06)

- **Contexto:** el signup self-service con confirmación de email dependería del SMTP integrado de
  Supabase (rate limit 2–4/hora) o de un proveedor externo que aún no existe (ver ADR-005).
- **Decisión:** el registro corre server-side con la Admin API (`email_confirm: true`): el usuario
  queda confirmado al crearse y puede iniciar sesión de inmediato (auto-login). Aplica igual a los
  usuarios creados al aceptar una invitación.
- **Consecuencia:** en el MVP no se verifica la propiedad del correo (riesgo aceptado y conocido);
  el endurecimiento (verificación real) se evalúa en T6.2.
