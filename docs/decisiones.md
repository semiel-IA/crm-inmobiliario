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

## ADR-007 — Reorganización de fases para MVP más rápido (2026-07-08)

- **Contexto:** plan maestro original preveía 6 fases de complejidad creciente (F0–F6), con funcionalidades como motor de matching automático, agenda de visitas completa, automatizaciones con jobs, y WhatsApp Cloud API. El usuario pidió recortar alcance para lanzar más rápido.
- **Decisión:** nueva estructura de 3 fases:
  - **F1 (4–5 sem):** contactos + propiedades + pipeline kanban (núcleo CRM vendible)
  - **F2 (1–2 sem):** WhatsApp click-to-chat + campo "próxima actividad" (comunicación mínima)
  - **F3 (2–3 sem):** MercadoPago suscripciones + deploy (monetización y lanzamiento)
  - **Cortado del MVP:** matching automático, agenda detallada, automatizaciones, WhatsApp API profunda, panel super-admin completo, reportes avanzados, onboarding wizard
- **Consecuencia:**
  - Duración F1+F2+F3: 7–10 semanas en lugar de las 20+ que implicaba F0–F6
  - MVP funcional y vendible sin funcionalidades complejas; roadmap post-lanzamiento (v1.5+) en `docs/plan-fase-1-mvp.md`
  - Tareas cortadas quedan documentadas para desarrollo futuro
  - Plan detallado de F1 en `docs/plan-fase-1-mvp.md`; F2 y F3 se detallan tras aprobación de F1

## ADR-008 — Confirmar MercadoPago, no Wompi (2026-07-08)

- **Contexto:** plan maestro original cita MercadoPago; el usuario preguntó si prefería Wompi para simplificar.
- **Decisión:** mantener MercadoPago (decisión original del usuario en el plan maestro; no cambiar).
- **Consecuencia:** integración T5.2 usa MercadoPago SDK (Python/JS), webhooks, suscripciones con preapproval; sandbox gratis para desarrollo.

## ADR-009 — Click-to-chat WhatsApp sin registro automático (2026-07-08)

- **Contexto:** F2 simplificada planteaba click-to-chat via `wa.me`. Plan maestro preveía registro automático de interacción. El usuario confirma: sí, click puro sin registro.
- **Decisión:** botón WhatsApp en contacto/negocio/propiedad genera link `wa.me/{teléfono}?text={mensaje}` que abre WhatsApp. **No** registra automáticamente la interacción; el agente crea la actividad manualmente si quiere.
- **Consecuencia:** flujo más simple, menos BD writes; timeline sin ruido; el usuario controla qué se registra. WhatsApp API profunda y webhooks quedan para v2.

## ADR-010 — Panel super-admin mínimo en F3 (2026-07-08)

- **Contexto:** plan maestro (M9) preveía panel super-admin completo: auditoría, impersonación, suspender/reactivar, métricas. El usuario pidió simplificar.
- **Decisión:** T5.4 en F3 queda reducido a: lista de tenants + plan + estado de pago. Sin impersonación, sin auditoría detallada, sin métricas de uso.
- **Consecuencia:** panel mínimo para gestión básica. Funcionalidad completa (auditoría, impersonación, KPIs) queda para v1.5+ como T5.4-v2. Se conserva auditoría en `audit_log` table pero UI back-office no la expone en lanzamiento.

## ADR-011 — `contacts` creada en T1.6 y bucket único de Storage con rutas por tenant (2026-07-08)

- **Contexto:** T1.6 (esquema de propiedades) necesita `properties.owner_contact_id` como FK
  obligatoria hacia `contacts`, pero `contacts` pertenecía a T1.1, que corría en paralelo. Además,
  el brief de T1.6 dejaba abierta la estrategia de Storage: bucket por tenant
  (`property-photos-{tenant_id}`) o bucket único con rutas por tenant.
- **Decisión:**
  1. La tabla `contacts` se creó dentro de T1.6 (migración `0004`), siguiendo exactamente la
     especificación de T1.1, para que `properties` pudiera referenciarla. T1.1 quedó reducida a
     `lead_preferences` (migraciones `0008`/`0009`) + seeds de leads; no toca `contacts`.
  2. Storage: **un solo bucket privado `property-photos`** con rutas
     `{tenant_id}/{property_id}/{filename}` (fotos/videos) y
     `{tenant_id}/{property_id}/documents/{filename}` (documentos privados). El aislamiento lo dan
     políticas RLS sobre `storage.objects` que comparan el primer segmento de la ruta con
     `public.current_tenant_id()`. Un bucket por tenant exigiría aprovisionamiento en el registro
     de cada tenant (pieza móvil extra) sin mejorar el aislamiento efectivo.
  3. Las fotos de propiedades `disponible` son legibles por `anon` vía una policy que usa el
     helper `SECURITY DEFINER` `public.property_is_publicly_listed()` (una sola verificación
     booleana; nunca expone columnas de `properties` a `anon`). El subpath `documents/` queda
     excluido de la lectura pública sin importar el estado de la propiedad.
- **Consecuencia:** T1.10 (ficha pública) lee propiedades vía `service_role` en el servidor
  (filtrando `status = 'disponible'` en código) y las fotos directamente por URL de Storage; el
  aislamiento multi-tenant de Storage queda verificado por las políticas de la migración `0007`.
