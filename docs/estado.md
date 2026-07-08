# Estado del proyecto

Backlog de tareas del plan maestro (`docs/plan-maestro.md`), agrupado por fase. Se actualiza al cerrar
cada tarea para sobrevivir entre sesiones. Estados posibles: `[pendiente]`, `[en curso]`, `[hecho]`,
`[bloqueado]`.

## Fase 0 — Fundaciones

- [hecho] T0.1 — Inicializar repo + scaffold + `/init` (revisión: aprobada sin hallazgos críticos)
- [hecho] T0.2 — Proyecto Supabase + conexión (revisión: aprobada tras 1 ciclo de fix; ping REST verificado en vivo; ping directo a Postgres verificado ✔ (`db.krcsempfrkizmbpqvksz.supabase.co:5432`, conexión directa — no hizo falta el session pooler))
- [hecho] T0.3 — Esquema núcleo SaaS + RLS (revisión: aprobada sin hallazgos críticos ni importantes; aislamiento verificado en vivo 8/8)
- [hecho] T0.4 — Auth completo (revisión: aprobada tras 1 ciclo de fix — compensación de usuarios
  Auth huérfanos, unit tests de servicios, origen confiable `APP_URL`, dedupe + revocar
  invitaciones; unit 49/49, RLS 17/17 y E2E 6/6 verdes en vivo. Resend pendiente de cuenta del
  usuario (checkpoint F0); invitaciones por link copiable, correo solo en consola, ver ADR-005.
  Endurecimiento diferido a T6.2: índice único parcial `(tenant_id, email) WHERE accepted_at IS
NULL` contra invitaciones duplicadas concurrentes)
- [en curso] T0.5 — Layout de la app + CI (shell con navegación por módulos, guard por rol en el
  nav, settings del tenant con renombrar, y workflow de GitHub Actions listos y revisados —
  aprobado tras 1 fix al workflow; unit 56/56, RLS 17/17 y E2E 10/10 verdes en vivo. Falta el
  checkpoint del usuario: crear el repo en GitHub y hacer push para poder verificar el criterio
  "CI verde en PR")

## Fase 1 — Contactos e inventario (M1, M2)

- [pendiente] T1.1 — Esquema contactos
- [pendiente] T1.2 — CRUD contactos (UI + servicios)
- [pendiente] T1.3 — Preferencias del lead
- [pendiente] T1.4 — Esquema propiedades
- [pendiente] T1.5 — CRUD propiedades
- [pendiente] T1.6 — Ficha pública

## Fase 2 — Pipeline, agenda y actividades (M4, M5)

- [pendiente] T2.1 — Esquema pipeline + deals
- [pendiente] T2.2 — Kanban de negocios
- [pendiente] T2.3 — Esquema visitas + actividades
- [pendiente] T2.4 — Agenda de visitas
- [pendiente] T2.5 — Timeline y "mi día"

## Fase 3 — Matching y reportes (M3, M8)

- [pendiente] T3.1 — Motor de matching
- [pendiente] T3.2 — UI de matching
- [pendiente] T3.3 — Dashboard y reportes

## Fase 4 — WhatsApp y automatizaciones (M6, M7)

- [pendiente] T4.1 — Click-to-chat + registro
- [pendiente] T4.2 — Infraestructura de jobs
- [pendiente] T4.3 — WhatsApp Cloud API (opcional por tenant)
- [pendiente] T4.4 — Automatizaciones v1

## Fase 5 — Billing y super-admin (M9, M10)

- [pendiente] T5.1 — Confirmar precios/planes + cuenta MercadoPago
- [pendiente] T5.2 — Integración MercadoPago
- [pendiente] T5.3 — Límites por plan + UI de suscripción
- [pendiente] T5.4 — Panel super-admin

## Fase 6 — Endurecimiento y lanzamiento

- [pendiente] T6.1 — Suite E2E de regresión + seeds demo
- [pendiente] T6.2 — Auditoría de seguridad
- [pendiente] T6.3 — Onboarding + landing
- [pendiente] T6.4 — Producción ($0)

---

## Modelo de datos (tablas del plan maestro, §3)

**Núcleo SaaS:** `tenants`, `plans`, `subscriptions`, `payments`, `memberships`, `audit_log`

**CRM inmobiliario:** `contacts`, `lead_preferences`, `properties`, `property_media`,
`property_documents`, `pipelines`, `pipeline_stages`, `deals`, `visits`, `activities`, `matches`,
`integration_settings`, `scheduled_jobs`

Ninguna de estas tablas existe todavía: se crean a partir de T0.3 (núcleo SaaS) y T1.1/T1.4/T2.1/T2.3/T3.1
(módulos de negocio).

## Checkpoints 🔴 pendientes con el usuario

- T0.2 — facilitar la contraseña de la base de datos Postgres del proyecto Supabase (la cuenta y
  el proyecto ya existen; solo falta esto para poder correr el ping directo a Postgres).
- T0.5 — crear el repositorio en GitHub y hacer push (requiere cuenta GitHub del usuario; regla
  $0: no se registra nada sin aprobación) para activar GitHub Actions y verificar "CI verde en
  PR".
- Fin F0 — visto bueno a scaffold, esquema y flujo de registro.
- Fin F1 — visto bueno a UX de contactos y propiedades.
- Antes de T4.3 — cuenta Meta Business y decisión sobre WhatsApp saliente (micro-costo) vs. solo email.
- T5.1 — precios definitivos + cuenta MercadoPago (sandbox).
- T6.2 — aceptación de riesgos de seguridad residuales, si los hay.
- T6.4 — luz verde a producción; dominio propio opcional.
