# CRM Inmobiliario

CRM SaaS multi-tenant para inmobiliarias y agentes independientes en Colombia. Centraliza
inventario de propiedades, leads/contactos, pipeline de ventas y arriendos, agenda de visitas y
WhatsApp como canal nativo de contacto.

Estado del proyecto: fase de fundaciones (F0). Ver `docs/plan-maestro.md` para el plan completo y
`docs/estado.md` para el backlog y avance por tarea.

## Requisitos

- Node.js >= 20
- npm (gestor de paquetes de este proyecto)

## Configuración

1. Copia `.env.example` a `.env` (nunca se commitea; ver `.gitignore`).
2. Completa las variables con las credenciales del proyecto Supabase: Project Settings → Data
   API (URL y anon key), Project Settings → API Keys (service_role) y Project Settings →
   Database → Connection string (Postgres, `DATABASE_URL`). Cada variable en `.env.example`
   trae un comentario con su ubicación exacta en el dashboard.
3. Verifica la conexión con `npm run db:ping`: hace un GET a `/auth/v1/health` de Supabase y,
   si `DATABASE_URL` ya tiene la contraseña real (sin el placeholder
   `[DB_PASSWORD_PENDIENTE]`), también prueba la conexión directa a Postgres.

## Comandos

| Comando               | Descripción                                                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`         | Levanta el servidor de desarrollo (Next.js)                                                                                              |
| `npm run build`       | Genera el build de producción                                                                                                            |
| `npm run start`       | Sirve el build de producción                                                                                                             |
| `npm run lint`        | Ejecuta ESLint                                                                                                                           |
| `npm run typecheck`   | Verifica tipos de TypeScript (`tsc --noEmit`)                                                                                            |
| `npm test`            | Ejecuta la suite de tests unitarios (Vitest)                                                                                             |
| `npm run format`      | Formatea el código con Prettier                                                                                                          |
| `npm run db:ping`     | Verifica la conexión con Supabase (REST + Postgres)                                                                                      |
| `npm run db:generate` | Genera migraciones SQL a partir del esquema Drizzle (`src/server/db/schema`)                                                             |
| `npm run db:migrate`  | Aplica las migraciones pendientes a la base de datos real                                                                                |
| `npm run db:seed`     | Siembra (upsert idempotente) los planes de suscripción                                                                                   |
| `npm run test:rls`    | Suite de aislamiento multi-tenant contra el proyecto Supabase real (crea/borra datos de prueba)                                          |
| `npm run test:e2e`    | Suite E2E de auth (Playwright + Chromium) contra la app y la BD reales; requiere `.env` completo y borra sus datos de prueba al terminar |

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Supabase (Auth + Postgres) con
Drizzle ORM conectado desde T0.2; esquema núcleo SaaS (`tenants`, `plans`, `memberships`,
`audit_log`, `invitations`) + Row Level Security desde T0.3; auth multi-tenant completo (registro,
login, invitaciones por link, roles) y tests E2E con Playwright desde T0.4.

## Estructura de carpetas

```
docs/                                   plan maestro, estado del backlog y ADRs
src/
  app/                                  rutas de Next.js (App Router)
  components/                           UI compartida (incluye shadcn/ui en components/ui)
  lib/                                  utilidades y helpers compartidos
  server/
    db/                                 clientes Drizzle/Supabase, schema/ (tablas núcleo SaaS) y migrations/
    services/                           lógica de negocio por módulo, testeable sin HTTP
    integrations/
      mercadopago/                      integración de pagos/suscripciones
      whatsapp/                         integración de WhatsApp Cloud API
      email/                            envío de correo transaccional
tests/
  unit/                                 tests unitarios (Vitest, sin red)
  rls/                                  suite de aislamiento multi-tenant (Vitest, contra Supabase real)
  e2e/                                  tests end-to-end (Playwright, contra la app y BD reales)
```
