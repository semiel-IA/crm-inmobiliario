# Estado del proyecto (MVP recortado: F1, F2, F3)

Actualizado 2026-07-08. Cambio de alcance: plan maestro original era F0–F6; ahora reorganizado en **F1 (Núcleo CRM), F2 (Comunicación mínima), F3 (Monetización + lanzamiento)** para MVP más rápido.

---

## Fase 0 — Fundaciones ✓ COMPLETADA

- [hecho] T0.1 — Inicializar repo + scaffold + `/init`
- [hecho] T0.2 — Proyecto Supabase + conexión
- [hecho] T0.3 — Esquema núcleo SaaS + RLS
- [hecho] T0.4 — Auth completo
- [hecho] T0.5 — Layout de la app + CI

**Estado:** Scaffold, auth, multi-tenancy funcionales. MVP core listo para empezar.

---

## Fase 1 — Núcleo CRM (Contactos + Inventario + Pipeline Kanban) [EN CURSO]

**Plan detallado:** `docs/plan-fase-1-mvp.md`  
**Estimación:** 4–5 semanas  
**Objetivo:** Usuario puede crear contactos, propiedades, y mover deals en kanban.

### Tarea T1.1 — Esquema contactos y preferencias
- [hecho] — Migraciones `contacts` (0004/0005, creada dentro de T1.6 por la FK de propietario, ver
  ADR-011), `lead_preferences` (0008/0009) + `created_by` (0010) + RLS + seeds (10 leads con
  preferencias por tenant) + helper `isValidE164`. Revisión del orquestador 2026-07-09: se
  añadieron el ADR-011 (estaba citado pero sin escribir), la columna `created_by` faltante y los
  tests de aislamiento de `lead_preferences`. Verificado en vivo: unit 66/66, RLS 36/36, seed
  idempotente.

### Tarea T1.2 — Servicio y Server Actions (contactos)
- [hecho] — Zod schemas en `src/lib/validations/contacts.ts` (create + update `.partial()`,
  mensajes es-CO, par fecha/canal de consentimiento validado en conjunto), servicio en
  `src/server/services/contacts.ts` (`createContact`, `updateContact`, `getContact` con
  `lead_preferences` anidadas, `listContacts` con búsqueda/filtros/paginación 10 por página,
  `deactivateContact` soft-delete, `assignAgent` con verificación de membership activa del
  tenant) y Server Actions delgadas en `src/app/(app)/app/contactos/actions.ts`. Todas las
  queries filtran explícitamente por `tenant_id` (defensa en profundidad sobre RLS, plan §2.2).
  UI (T1.3) sigue en "coming soon"; estas acciones quedan listas para consumirse ahí.
  Verificado en vivo: unit 36/36 nuevos (validations 18 + servicio 18), sin regresiones en la
  suite existente.

### Tarea T1.3 — UI: Listado y ficha de contactos
- [hecho, E2E sin verificar] — `/app/contactos` (tabla con búsqueda, filtros por tipo/estado y
  paginación de 10, estado vacío), diálogo de creación/edición con `react-hook-form` +
  `@hookform/resolvers` sobre los schemas Zod de T1.2, y ficha `/app/contactos/[id]` con edición
  in-situ y desactivación. Se añadieron los primitivos shadcn de F1 (dialog, table, select,
  checkbox, popover, command, tabs, badge, textarea, alert-dialog, input-group, sonner) y el
  `Toaster` en el layout raíz. Bug corregido: re-exportar tipos desde un módulo `"use server"`
  provoca `ReferenceError` en cada llamada a una acción (ver nota en `actions.ts`).
  Verificado: typecheck limpio, lint limpio, unit 147/147. **E2E `tests/e2e/contacts.spec.ts`
  escrito pero NO ejecutado** — el proyecto Supabase está caído (ver "Bloqueos" abajo).

### Tarea T1.4 — Servicio preferencias del lead
- [hecho] — Zod schemas en `src/lib/validations/lead-preferences.ts` (reutiliza `PROPERTY_TYPES` de
  properties en vez de duplicar la lista; `operationType` limitado a venta|arriendo para respetar el
  check constraint de la tabla; `getLeadPreferenceRangeIssues` valida presupuesto min<max y estrato
  min<=max, mismo patrón que `getOperationPricingIssues`) y servicio en
  `src/server/services/lead-preferences.ts` (`createPreference`, `updatePreference` que re-valida
  los rangos contra el estado mezclado, `getPreference`, `listPreferences`) + Server Actions en
  `contactos/actions.ts`. Todas las queries filtran por `tenant_id` y las escrituras verifican que
  el contacto pertenece al tenant antes de tocar la fila.
  Revisión del orquestador 2026-07-26: se devolvió un hallazgo bloqueante — `getPreference`
  buscaba solo por `(contactId, tenantId)` con `.limit(1)`, pero el índice único de T1.1 es
  `(tenant_id, contact_id, operation_type)` a propósito (un contacto mixto comprador+arrendatario
  tiene dos filas), así que devolvía una fila arbitraria y ocultaba la otra. Corregido:
  `getPreference` ahora exige `operationType` (clave única completa) y se añadió `listPreferences`
  con `ORDER BY` explícito — esa es la API que debe consumir T1.5.
  Verificado en vivo: typecheck limpio, lint limpio, unit 176/176 (29 nuevos).

### Tarea T1.5 — UI: Sub-formulario de preferencias
- [hecho, E2E sin verificar] — `LeadPreferencesPanel` en la ficha de contacto: una pestaña por
  operación (Venta / Arriendo, la que no tiene fila se marca "(sin registrar)"), cada una con su
  `LeadPreferenceForm` independiente y su `operationType` fijo, de modo que guardar en una pestaña
  no puede pisar la fila de la otra (respeta el índice único
  `(tenant_id, contact_id, operation_type)`). Reutiliza los schemas Zod de T1.4 vía `zodResolver`
  sin duplicar reglas en cliente; toasts con `sonner`. Lógica pura (labels es-CO, parseo de zonas
  separadas por coma, fila DB → defaults de RHF) en `lead-preference-helpers.ts` con unit tests.
  No hizo falta un fetch extra: `getContact` ya devuelve todas las filas de preferencias.
  Verificado: typecheck limpio, lint limpio, unit 183/183 (7 nuevos). **Sin cobertura E2E**: el
  spec no se extendió y la BD sigue caída.

### Tarea T1.6 — Esquema propiedades
- [hecho] — Migraciones `properties`, `property_media`, `property_documents` (0004/0005), trigger
  de portada única (0006), bucket Storage `property-photos` con RLS por ruta de tenant y lectura
  pública solo para propiedades `disponible` (0007, ver ADR-011) + seeds (5 propiedades por
  tenant). Verificado en vivo junto con T1.1: RLS 36/36 incluye aislamiento de las 3 tablas,
  trigger de portada y bloqueo anon.

### Tarea T1.7 — Servicio CRUD propiedades
- [hecho] — Zod schemas en `src/lib/validations/properties.ts` (regla venta/arriendo/ambas
  compartida vía `getOperationPricingIssues`), servicio en `src/server/services/properties.ts`
  (`generatePropertyCode` con estrategia optimista + retry sobre el unique constraint,
  `createProperty` con verificación de owner en el tenant, `updateProperty` re-valida la regla de
  precios mezclando payload con la fila existente, `internalCode` inmutable, `listProperties` con
  filtros/paginación, `deactivateProperty` soft-delete) y Server Actions en
  `src/app/(app)/app/propiedades/actions.ts`. Revisión del orquestador 2026-07-09: aprobada sin
  hallazgos. Verificado en vivo: unit 138/138 (41 nuevos), RLS 36/36, CI verde (`d3f69f6`).

### Tarea T1.8 — UI: Listado y ficha de propiedades
- [hecho, E2E sin verificar] — `/app/propiedades` (tabla con búsqueda, filtros de
  tipo/operación/estado/precio y paginación), wizard multi-paso de creación con combobox de
  propietario sobre los contactos del tenant, y ficha `/app/propiedades/[id]` con cambio de estado
  y enlace para compartir. La lógica de presentación (labels es-CO, formato COP según
  venta/arriendo/ambas, constructor de URL pública) vive en `property-helpers.ts` y está cubierta
  por unit tests. Verificado: typecheck limpio, lint limpio, unit 147/147.
  **E2E `tests/e2e/properties.spec.ts` escrito pero NO ejecutado** (Supabase caído).
- Deuda conocida: `listProperties` no tiene filtro de búsqueda por código/barrio/ciudad, así que la
  página trae hasta 200 filas y filtra en memoria (ver comentario `SEARCH_SCAN_LIMIT` en
  `page.tsx`). Pendiente añadir un filtro `search` al servicio.

### Tarea T1.9 — Upload de fotos a Supabase Storage
- [pendiente] — Drop-zone, validación MIME/tamaño, reordenamiento, portada

### Tarea T1.10 — Ficha pública `/p/[tenant]/[codigo]`
- [pendiente] — Ruta pública (sin auth) para compartir propiedad; botón WhatsApp (wa.me)

### Tarea T2.1 — Esquema pipeline, stages y deals
- [pendiente] — Migraciones `pipelines`, `pipeline_stages`, `deals` + RLS + seeds (default pipelines)

### Tarea T2.2 — Servicio deals
- [pendiente] — Backend: crear deal, mover entre etapas, cerrar (ganado/perdido), historial

### Tarea T2.3 — UI: Kanban de deals
- [pendiente] — Página kanban con drag-drop entre etapas, crear deal, detalles modal

### Tarea T1.11 — Campo "próxima actividad"
- [pendiente] — Agregar columna `next_activity_date` a `contacts` y `deals`; UI para establecer fecha

---

## Fase 2 — Comunicación mínima viable (WhatsApp + Calendario simple) [PENDIENTE]

**Estimación:** 1–2 semanas  
**Objetivo:** Click-to-chat WhatsApp + vista simple de próximas actividades.

### Cambios respecto al plan maestro
- ❌ **NO** se implementa: WhatsApp Cloud API, automatizaciones complejas, agenda de visitas detallada, timeline unificado
- ✅ **SÍ** se implementa: botón wa.me simplista, vista tabla de próximas actividades por fecha

### Tareas (a detallar cuando F1 esté lista)
- T4.1 (simplificado) — Botón WhatsApp click-to-chat (wa.me link)
- T2.4 (simplificado) — Vista "Próximas actividades" (tabla por fecha, no calendario)

---

## Fase 3 — Monetización y lanzamiento [PENDIENTE]

**Estimación:** 2–3 semanas  
**Objetivo:** Suscripciones con MercadoPago, deploy a producción.

### Cambios respecto al plan maestro
- ✅ MercadoPago (confirmado 2026-07-08, no Wompi)
- ⏸️ Panel super-admin simplificado: solo lista de tenants + estado de pago (sin impersonación)
- ⏸️ Suite E2E simplificada (sin matching automático, sin visitas, sin recordatorios)
- ⏸️ Onboarding simplificado: solo landing + signup (sin wizard guiado)

### Tareas (a detallar cuando F1+F2 estén listas)
- T5.1 — Confirmar precios + crear cuenta MercadoPago sandbox
- T5.2 — Integración MercadoPago (suscripciones, webhooks, máquina de estados)
- T5.3 — Límites por plan + UI de suscripción (reducida)
- T5.4 — Panel super-admin mínimo
- T6.1 — Suite E2E de regresión simplificada
- T6.2 — Auditoría de seguridad + `/security-review`
- T6.4 — Deploy a producción (Vercel Hobby + Supabase)

---

## Qué se cortó del MVP (roadmap post-lanzamiento v1.5+)

| Funcionalidad | Razón | Alternativa en MVP |
|---|---|---|
| Motor de matching automático | Complejidad > valor inicial | Usuario conecta contactos a propiedades manualmente |
| Agenda de visitas (calendario completo) | Funcionalidad pesada | Campo simple "próxima actividad" (fecha) |
| Timeline unificado de actividades | Tracking detallado no crítico | Si need, users ven próxima actividad + notas |
| Automatizaciones (recordatorios, alertas) | Sin infraestructura jobs | Usuario recuerda manualmente o usa alarma del teléfono |
| WhatsApp Cloud API + webhooks | API external = complexity | Click-to-chat (wa.me) genera 90% del valor |
| Reportes/dashboard | Analytics inicial no crítico | Users pueden exportar CSV si necesitan |
| Panel super-admin completo | Pocas features en lanzamiento | Básico: lista de tenants + pago |
| Onboarding wizard guiado | UX nice-to-have | Landing + signup directo |
| Firma electrónica, API pública, facturación DIAN | Post-MVP | v2+ |

---

## Bloqueos activos

### 🔴 Proyecto Supabase inaccesible (detectado 2026-07-26)
`npm run db:ping` falla: Postgres `ENOTFOUND ... postgres.krcsempfrkizmbpqvksz not found` y el
health de Auth no responde. El E2E preexistente `tests/e2e/auth.spec.ts` —que estaba verde— falla
en el mismo punto (el registro nunca navega a `/app`), así que **no es una regresión del código
nuevo**. Causa más probable: los proyectos Supabase del plan gratuito se pausan tras ~1 semana sin
actividad y el último trabajo fue el 2026-07-09.

**Acción del usuario:** entrar al dashboard de Supabase y reanudar el proyecto (es gratis, no viola
la regla $0). Mientras tanto quedan bloqueados: `npm run test:e2e`, `npm run test:rls`,
`npm run db:seed` y cualquier prueba manual de la UI.

---

## Checkpoints 🔴 pendientes con el usuario

1. **Fin F1** — Demo en vivo: crear propiedad + lead + mover deal por kanban. Visto bueno a UX.
2. **Antes T5.1** — Confirmar precios finales para los 3 planes.
3. **T5.1** — Crear cuenta MercadoPago (sandbox mínimo).
4. **T6.2** — Revisar hallazgos de seguridad; aceptación de riesgos.
5. **T6.4** — Luz verde a producción; decisión sobre dominio propio (opcional, costo).

---

## Modelo de datos (actualizado para F1)

**Núcleo SaaS (F0):** `tenants`, `plans`, `subscriptions`, `payments`, `memberships`, `audit_log`

**CRM Fase 1:**
- `contacts` — nombre, teléfono E.164, email, cédula/NIT, tipos[], origen, estado lead, agente, consentimiento, **próxima_actividad** (fecha), notas, tenant_id, timestamps
- `lead_preferences` — contacto, operación, tipos[], zonas[], presupuesto, hab/baños/parqueos mín., estrato, tenant_id, timestamps
- `properties` — código interno, tipo, operación, estado, propietario, precio/canon, características, dirección, tenant_id, timestamps
- `property_media` — propiedad, URL, tipo (foto/video), orden, portada, tenant_id
- `property_documents` — propiedad, nombre, URL, tenant_id
- `pipelines` — nombre, operación, tenant_id
- `pipeline_stages` — pipeline, nombre, orden, tenant_id
- `deals` — contacto, propiedad, pipeline, etapa_actual, agente, valor_estimado, motivo_pérdida (si cerrado), historial JSONB, tenant_id, timestamps

**NO en F1 (cortado):**
- `matches`, `visits`, `activities`, `integration_settings` (WhatsApp), `scheduled_jobs` (automatizaciones)

---

## Decisiones registradas (ver también `docs/decisiones.md`)

- **MercadoPago vs Wompi:** Confirmado MercadoPago (2026-07-08)
- **Click-to-chat sin registro:** Sí, wa.me link puro, sin actividad automática (2026-07-08)
- **Panel super-admin:** Mínimo por ahora, impersonación queda para v1.5 (2026-07-08)

---

## Próximos pasos

1. ✅ Usuario aprueba plan de F1 (docs/plan-fase-1-mvp.md)
2. Orquestador despacha T1.1–T1.6 en paralelo (schemas + services)
3. Subagentes ejecutan tareas; orquestador valida cada entrega
4. Al completar F1: demo + checkpoint con usuario
5. F2 y F3 se detallan cuando F1 sea aceptada
