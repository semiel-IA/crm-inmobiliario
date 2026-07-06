# CRM Inmobiliario

CRM SaaS multi-tenant para inmobiliarias y agentes independientes en Colombia. Centraliza
inventario de propiedades, leads/contactos, pipeline de ventas y arriendos, agenda de visitas y
WhatsApp como canal nativo de contacto.

Estado del proyecto: fase de fundaciones (F0). Ver `docs/plan-maestro.md` para el plan completo y
`docs/estado.md` para el backlog y avance por tarea.

## Requisitos

- Node.js >= 20
- npm (gestor de paquetes de este proyecto)

## Comandos

| Comando             | Descripción                                   |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Levanta el servidor de desarrollo (Next.js)   |
| `npm run build`     | Genera el build de producción                 |
| `npm run start`     | Sirve el build de producción                  |
| `npm run lint`      | Ejecuta ESLint                                |
| `npm run typecheck` | Verifica tipos de TypeScript (`tsc --noEmit`) |
| `npm test`          | Ejecuta la suite de tests unitarios (Vitest)  |
| `npm run format`    | Formatea el código con Prettier               |

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Base de datos y auth (Supabase +
Drizzle) llegan en tareas posteriores (T0.2–T0.4); tests E2E con Playwright llegan en T0.4.

## Estructura de carpetas

```
docs/                                   plan maestro, estado del backlog y ADRs
src/
  app/                                  rutas de Next.js (App Router)
  components/                           UI compartida (incluye shadcn/ui en components/ui)
  lib/                                  utilidades y helpers compartidos
  server/
    db/                                 esquema y acceso a base de datos (llega en T0.2–T0.3)
    services/                           lógica de negocio por módulo, testeable sin HTTP
    integrations/
      mercadopago/                      integración de pagos/suscripciones
      whatsapp/                         integración de WhatsApp Cloud API
      email/                            envío de correo transaccional
tests/
  unit/                                 tests unitarios (Vitest)
  e2e/                                  tests end-to-end (Playwright, llega en T0.4)
```
