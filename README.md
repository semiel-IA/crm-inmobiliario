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

> **`DATABASE_URL` debe apuntar al transaction pooler (puerto 6543).** Ni la conexión directa
> (`db.<ref>.supabase.co`, ya no se expone) ni el session pooler (puerto 5432, devuelve
> `28P01 password authentication failed` incluso con la contraseña correcta) funcionan en este
> proyecto. Ante un `28P01`, revisa el puerto antes de sospechar de la contraseña.

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

## Despliegue en Vercel

Next.js se autodetecta: no hace falta `vercel.json` ni ajustar los comandos de build.

1. **Importa el repositorio** en Vercel (Add New → Project). Framework: Next.js.
2. **Carga las variables de entorno** (Project Settings → Environment Variables). Son las mismas
   de `.env` más `APP_URL`:

   | Variable                        | Ámbito             | Notas                                            |
   | ------------------------------- | ------------------ | ------------------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`      | Production/Preview | Pública, se expone al navegador                  |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production/Preview | Pública, protegida por RLS                       |
   | `SUPABASE_SERVICE_ROLE_KEY`     | Production/Preview | **Secreta**: bypassa RLS, solo servidor          |
   | `DATABASE_URL`                  | Production/Preview | Transaction pooler, **puerto 6543** (ver arriba) |
   | `APP_URL`                       | Production         | `https://tu-dominio.vercel.app`, sin barra final |

   `APP_URL` no es opcional en producción: los enlaces de invitación se construyen a partir de
   ella y, si falta, se arman con los headers de la petición.

3. **Aplica las migraciones** contra la base de producción antes del primer despliegue
   (`npm run db:migrate`) y siembra los planes (`npm run db:seed`).
4. **Despliega.** Tras el deploy, valida el flujo real: registro → login → invitar agente.

### Notas de runtime

- El cliente de Postgres usa `max: 1` y `prepare: false` (ver `src/server/db/client.ts`): cada
  lambda tibia mantiene su propio pool y el plan gratuito de Supabase permite 15 conexiones en
  total, así que subir `max` agota el pool con pocas lambdas concurrentes.
- La protección de rutas vive en `src/proxy.ts` (el rename de `middleware.ts` en Next 16) y es
  optimista: páginas y Server Actions revalidan sesión y rol en el servidor, y RLS hace cumplir el
  aislamiento por tenant en la base de datos.

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
