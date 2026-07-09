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
- [pendiente] — Página `/contacts` (tabla con búsqueda/filtros) + `/contacts/[id]` (ficha)

### Tarea T1.4 — Servicio preferencias del lead
- [pendiente] — Backend de CRUD preferencias (zona, presupuesto, etc.)

### Tarea T1.5 — UI: Sub-formulario de preferencias
- [pendiente] — Formulario en ficha de contacto para editar preferencias

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
- [pendiente] — Página `/properties` + `/properties/[id]` con galería y detalles

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
