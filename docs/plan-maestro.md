# Plan Maestro — CRM Inmobiliario SaaS Multi-Tenant (Colombia)

## Contexto

Se construirá desde cero (el directorio `CRM` está vacío) un CRM especializado para inmobiliarias y agentes de bienes raíces en Colombia, como producto SaaS multi-tenant vendible a muchos negocios del sector. El usuario actúa como dueño del producto y aprueba hitos; **Fable 5 actúa como orquestador** (planea, delega, valida — no ejecuta); **subagentes con Sonnet 5 ejecutan** todo el trabajo real (código, archivos, comandos, pruebas). Esta fase es 100 % de planeación: no se escribe código hasta la aprobación explícita del usuario.

**Decisiones ya tomadas por el usuario (no renegociables):**

| Decisión | Elección |
|---|---|
| Nicho | Inmobiliarias y agentes independientes, Colombia |
| Modelo | SaaS multi-tenant, datos aislados por inmobiliaria |
| Stack | TypeScript full-stack (Next.js + **Supabase**/PostgreSQL) |
| Presupuesto infra | **$0 estricto** — todo en capas gratuitas; cualquier costo inevitable se consulta al usuario ANTES de incurrir en él (ver §2.6) |
| Hosting | **Vercel plan Hobby (gratis)** |
| Alcance MVP | Core CRM + integración WhatsApp |
| Pasarela de cobro | **MercadoPago** (suscripciones en COP) |
| Herramientas de trabajo | Skills instaladas: **superpowers** (obra), **ui-ux-pro-max**, **/security-review** (Anthropic); `/init` genera `CLAUDE.md` al arrancar (T0.1) |

---

## 1. Descubrimiento y alcance del nicho

### 1.1 Flujo real de trabajo de una inmobiliaria colombiana

**Operación de VENTA:**
1. **Captación del inmueble** — el propietario consigna la propiedad (con o sin exclusividad); se pacta comisión (típicamente 3 % del valor de venta) y se recopilan documentos: certificado de tradición y libertad, matrícula inmobiliaria, paz y salvos.
2. **Captación del lead comprador** — llega por portales (Fincaraíz, Metrocuadrado, Ciencuadras), redes sociales, fachada/valla, referidos o WhatsApp. El 80 %+ del primer contacto real ocurre por WhatsApp.
3. **Calificación** — presupuesto, forma de pago (crédito hipotecario, leasing, contado, subsidio), zona y tipo de inmueble deseado, urgencia.
4. **Matching y visitas** — se cruzan preferencias del lead con el inventario, se agendan y realizan visitas, se registra feedback.
5. **Oferta y negociación** — oferta formal, contraoferta, acuerdo de precio y condiciones.
6. **Promesa de compraventa** — firma de promesa con arras; el comprador tramita crédito/avalúo con el banco.
7. **Escrituración** — firma en notaría, registro en Oficina de Registro de Instrumentos Públicos, pago de comisión.
8. **Postventa** — entrega del inmueble, referidos, solicitud de reseñas.

**Operación de ARRIENDO:**
1. Captación del inmueble (comisión típica: primer canon + 8–10 % mensual por administración).
2. Captación del lead arrendatario → calificación (canon máximo, codeudor o póliza).
3. Visitas → solicitud de arriendo → **estudio del arrendatario** (aseguradora/afianzadora tipo El Libertador, Sufi, datacrédito).
4. Aprobación → contrato de arrendamiento (Ley 820 de 2003) → inventario de entrega.
5. Administración mensual: recaudo del canon, novedades, renovaciones.

**Dolores que el CRM resuelve (propuesta de valor):** hoy este flujo vive en Excel, cuadernos y chats de WhatsApp personales. Los leads se pierden por falta de seguimiento, el inventario está desactualizado, no hay trazabilidad de qué agente mostró qué inmueble a quién, y cuando un agente renuncia se lleva los contactos. El CRM centraliza inventario + leads + pipeline + agenda con el WhatsApp como canal nativo.

### 1.2 Alcance del MVP (v1)

**DENTRO del MVP:**
- Gestión de contactos/leads (compradores, arrendatarios, propietarios) con origen y consentimiento de datos (Ley 1581 — habeas data).
- Inventario de propiedades con fotos, documentos, y ficha compartible pública (link para enviar por WhatsApp).
- Pipeline visual (kanban) con etapas propias del sector, separado para venta y arriendo.
- Matching lead ↔ propiedad por preferencias (zona, presupuesto, tipo, habitaciones).
- Agenda de visitas y actividades con recordatorios.
- WhatsApp: click-to-chat desde cualquier contacto, registro de interacción, envío de ficha de propiedad, y recordatorios de visita vía WhatsApp Cloud API.
- Dashboard básico: leads por agente, embudo, propiedades más visitadas, tiempos por etapa.
- Multi-tenant completo: registro de inmobiliaria, roles (admin, agente, asistente), aislamiento de datos.
- Suscripción y cobro con MercadoPago + panel super-admin (nuestro back-office).

**FUERA del MVP (v1.5 / v2):**
- Publicación automática en portales (Fincaraíz, Metrocuadrado) — v1.5, es el gancho comercial #2.
- Automatizaciones avanzadas (nurturing multi-paso, scoring de leads) — v1 solo recordatorios.
- Bandeja de WhatsApp compartida (inbox completo bidireccional) — v2; MVP registra y envía plantillas.
- App móvil nativa — la web será responsive/PWA.
- Módulo de administración de arriendos (recaudo mensual, novedades) — v2, es casi otro producto.
- Firma electrónica de documentos, API pública para terceros, contabilidad/facturación electrónica DIAN.

### 1.3 Modelo de negocio del CRM

Precios en COP, cobro mensual vía MercadoPago (preapproval/suscripciones), **14 días de prueba sin tarjeta**, descuento ~20 % en pago anual.

| Plan | Precio/mes (propuesto) | Usuarios | Propiedades activas | Diferenciadores |
|---|---|---|---|---|
| **Agente** | COP 69.900 | 1 | 40 | Todo el core + WhatsApp |
| **Equipo** | COP 189.900 | hasta 5 | 250 | + roles, reportes por agente |
| **Inmobiliaria** | COP 399.900 | hasta 15 | Ilimitadas | + auditoría, prioridad soporte, (futuro: portales/API) |

Límites aplicados por software (bloqueo suave: avisar, luego impedir crear). Precios definitivos se validan con el usuario antes de construir el módulo de billing (checkpoint 🔴).

---

## 2. Arquitectura técnica

### 2.1 Stack (elegido y justificado)

| Capa | Tecnología | Justificación |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | Full-stack en un solo repo/lenguaje; ideal para que subagentes generen código consistente |
| UI | Tailwind CSS + shadcn/ui | Componentes accesibles listos (tablas, formularios, kanban), velocidad de desarrollo |
| Base de datos | **PostgreSQL en Supabase** | Free tier suficiente para MVP; trae Auth, Storage (fotos) y **RLS nativo** — 3 problemas resueltos en un servicio |
| ORM / acceso | **Drizzle ORM** + migraciones SQL versionadas | Tipado end-to-end, migraciones explícitas revisables por el orquestador |
| Auth | Supabase Auth (email+password, magic link) con JWT claims `tenant_id` y `role` | Integra con RLS sin código extra |
| Storage | Supabase Storage (buckets por tenant para fotos/docs) | Incluido en free tier, políticas de acceso por tenant |
| Jobs/recordatorios | Vercel Cron + tabla `scheduled_jobs` (outbox) | Sin infraestructura extra de colas en MVP; Hobby permite crons diarios (suficiente con ventanas de recordatorio) |
| Hosting | **Vercel Hobby (gratis)** en subdominio `*.vercel.app` | $0; ver nota de costos §2.6 sobre uso comercial |
| Email transaccional | Resend (free tier 3.000 emails/mes) | Invitaciones, recuperación, notificaciones y recordatorios — canal $0 por defecto |
| WhatsApp | Links `wa.me` (gratis) + Meta WhatsApp Business Cloud API opcional | Click-to-chat y recepción: $0; plantillas salientes tienen micro-costo por mensaje (§2.6) |
| Pagos | MercadoPago (Suscripciones/preapproval + webhooks) | Decisión del usuario; soporta COP y medios locales |
| Testing | Vitest (unit/integration) + Playwright (E2E) | Estándar del ecosistema |
| CI | GitHub Actions: typecheck, lint, tests en cada PR | Gate automático de calidad |

### 2.6 Política de costo $0 (regla del proyecto)

**Todo el desarrollo y el lanzamiento inicial cuestan $0:** Supabase free (500 MB BD, 1 GB storage, auth ilimitado razonable), Vercel Hobby, Resend free, Sentry free, GitHub free, subdominio `crm.vercel.app`. Ningún subagente puede introducir un servicio de pago; si una tarea parece necesitarlo, se detiene y el orquestador lo consulta contigo 🔴.

**Divulgación honesta — los ÚNICOS costos que en algún momento serán inevitables** (ninguno se incurre sin tu aprobación explícita, y ninguno aplica durante el desarrollo):

| Costo | Cuándo aparece | Monto aprox. | Alternativa $0 mientras tanto |
|---|---|---|---|
| Dominio propio (`tucrm.com.co`) | Solo al lanzar con marca | ~$50–70 mil COP/año | Subdominio gratis `*.vercel.app` |
| Vercel Hobby es para uso **no comercial** (ToS) | Cuando ya cobres a clientes reales | Pro: $20 USD/mes | Desarrollo y pilotos gratis en Hobby; al facturar, se decide: pagar Pro o migrar a Cloudflare (gratis, con trabajo extra) |
| Plantillas salientes de WhatsApp Cloud API | Solo si activas recordatorios por WhatsApp | Centavos de USD por mensaje | Recordatorios por **email (Resend, $0)** por defecto; WhatsApp saliente queda opcional por tenant |
| Comisión MercadoPago | Solo cuando ya estés cobrando suscripciones | ~3,5 % + IVA por transacción (se descuenta del ingreso, sin costo fijo) | Sandbox gratuito para todo el desarrollo |

Si en cualquier punto aparece un costo distinto a estos cuatro, se trata como bloqueo 🔴 y se te pregunta primero.

### 2.2 Multi-tenancy — decisión

Alternativas evaluadas:

1. **Base de datos por tenant** — máximo aislamiento, pero costo y complejidad operativa (migraciones × N) inviables con presupuesto mínimo. ❌
2. **Schema por tenant** — intermedio, pero Supabase/PgBouncer y el tooling de migraciones lo hacen frágil; complica reporting global. ❌
3. **Row-level: columna `tenant_id` + PostgreSQL Row Level Security (RLS)** ✅ **← elegida.** Una sola BD, una migración, escalable a cientos de tenants. El aislamiento se garantiza en la capa de base de datos (no solo en el código): toda tabla de negocio tiene `tenant_id NOT NULL` y política RLS `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`. Defensa en profundidad: aunque un bug en la app olvide filtrar, Postgres no devuelve filas ajenas.

Reglas de oro (se validan en cada entrega):
- Ninguna tabla de negocio sin `tenant_id` + política RLS + índice compuesto `(tenant_id, ...)`.
- Tests de aislamiento obligatorios por módulo: usuario del tenant A no puede leer/escribir datos del tenant B.
- El super-admin (nosotros) opera vía `service_role` solo desde el panel back-office, con auditoría.

### 2.3 Autenticación y roles

- **Registro self-service**: quien se registra crea su tenant (inmobiliaria) y queda como `admin`; invita a su equipo por email.
- Roles por tenant (tabla `memberships`):

| Rol | Permisos |
|---|---|
| `admin` | Todo: usuarios, facturación, configuración, ver datos de todos los agentes |
| `agente` | CRUD sobre sus leads/negocios/visitas; ve inventario completo; no ve leads de otros agentes (configurable por el admin) |
| `asistente` | Crear/editar contactos, propiedades y agendar visitas; sin acceso a reportes ni configuración |
| `super_admin` (global, nuestro) | Panel back-office: tenants, planes, suscripciones, métricas de uso; nunca dentro de la UI del tenant |

- JWT de Supabase con custom claims (`tenant_id`, `role`) emitidos por un hook de acceso; middleware de Next.js protege rutas por rol.

### 2.4 Estrategia de API

- **Interno (MVP):** Server Actions + Route Handlers de Next.js (REST) — sin capa GraphQL; simplicidad > flexibilidad en esta etapa.
- **Webhooks entrantes:** `/api/webhooks/mercadopago` (pagos) y `/api/webhooks/whatsapp` (estados de mensaje) — firmados y verificados.
- **API pública:** NO en MVP. El código se organiza en capa de servicios (`src/server/services/*`) separada de las rutas, de modo que exponer REST público versionado (integraciones con portales, Zapier) en v2 no requiera reescritura.
- **Ficha pública de propiedad:** ruta pública `/p/[tenant-slug]/[codigo]` sin auth — es el link que el agente comparte por WhatsApp (SEO-friendly, con fotos y botón de contacto).

### 2.5 Estructura del repositorio

Monorepo simple (una sola app Next.js):

```
CRM/
├─ docs/                      # este plan, especificaciones, ADRs
├─ src/
│  ├─ app/                    # rutas: (auth), (app)/[modulos], (public)/p/, admin/ (super-admin), api/
│  ├─ components/             # UI compartida (shadcn/ui)
│  ├─ server/
│  │  ├─ db/                  # schema Drizzle, migraciones, seeds
│  │  ├─ services/            # lógica de negocio por módulo (testeable, sin HTTP)
│  │  └─ integrations/        # mercadopago/, whatsapp/, email/
│  └─ lib/                    # utilidades, validaciones Zod compartidas
├─ tests/                     # Vitest + Playwright
└─ .github/workflows/ci.yml
```

---

## 3. Modelo de datos (específico del sector)

Todas las tablas de negocio: `id uuid`, `tenant_id uuid NOT NULL` (+ RLS), `created_at`, `updated_at`, `created_by`.

**Núcleo SaaS:**
- `tenants` — nombre, slug, NIT, logo, ciudad, config (JSONB), estado (`trial | activo | suspendido | cancelado`).
- `plans` — nombre, precio COP, `max_usuarios`, `max_propiedades`, features (JSONB). (Global, sin tenant_id.)
- `subscriptions` — tenant, plan, estado, `mp_preapproval_id`, periodo, `trial_ends_at`.
- `payments` — suscripción, monto, estado, `mp_payment_id`, fecha (histórico desde webhooks).
- `memberships` — user (Supabase auth) ↔ tenant, rol, estado (`invitado | activo | desactivado`).
- `audit_log` — quién hizo qué (crítico para el plan Inmobiliaria y para soporte).

**CRM inmobiliario:**
- `contacts` — nombre, teléfono/WhatsApp (E.164, campo estrella), email, cédula/NIT, **tipos[]** (`comprador | arrendatario | propietario` — una persona puede ser varios), origen (`portal | referido | redes | fachada | whatsapp | web`), agente asignado, estado del lead (`nuevo | contactado | calificado | inactivo`), consentimiento habeas data (fecha/medio), notas.
- `lead_preferences` — contacto, operación (`venta | arriendo`), tipos de inmueble[], ciudades/barrios[], presupuesto min–max (o canon), habitaciones/baños/parqueaderos mín., estrato min–max, área mín. → **insumo del matching**.
- `properties` — código interno (autogenerado por tenant), tipo (`apartamento | casa | lote | local | oficina | bodega | finca`), operación (`venta | arriendo | ambas`), estado (`disponible | reservada | vendida | arrendada | inactiva`), propietario → `contacts`, precio venta / canon + administración, área m², habitaciones, baños, parqueaderos, **estrato**, antigüedad, dirección (privada) + barrio/ciudad/departamento (públicos), lat/lng, matrícula inmobiliaria, exclusividad (bool + vencimiento), % comisión pactada, descripción.
- `property_media` — fotos/videos ordenados (Supabase Storage), portada.
- `property_documents` — certificado de tradición y libertad, paz y salvos, poder, etc. (privados).
- `pipelines` + `pipeline_stages` — se crean por defecto al crear el tenant y son editables:
  - Venta: `Prospecto → Calificado → Visita agendada → Visita realizada → Oferta → Negociación → Promesa firmada → Escrituración → Cerrado ganado / Cerrado perdido`
  - Arriendo: `Prospecto → Calificado → Visita → Solicitud/estudio → Aprobado → Contrato firmado → Cerrado ganado / perdido`
- `deals` (negocios) — contacto + propiedad + pipeline/etapa, valor estimado, agente, motivo de pérdida (catálogo), fechas de entrada por etapa (para métricas de tiempo).
- `visits` — negocio/contacto/propiedad, fecha-hora, agente, estado (`programada | realizada | cancelada | no_show`), feedback estructurado (¿le gustó?, objeciones).
- `activities` — tipo (`llamada | whatsapp | email | nota | tarea`), vinculada a contacto/negocio/propiedad, vencimiento, completada. Alimenta el timeline y la lista "tareas de hoy".
- `matches` — contacto ↔ propiedad, score, estado (`sugerido | enviado | descartado | interesado`), generado por job al crear/editar propiedades o preferencias.
- `integration_settings` — credenciales WhatsApp Cloud API por tenant (cifradas), configuración de notificaciones.
- `scheduled_jobs` — outbox para recordatorios (visita mañana, lead sin tocar hace N días).

Relaciones clave: `contacts 1—N deals N—1 properties`; `deals 1—N visits/activities`; `contacts 1—N lead_preferences`; `matches` materializa el cruce preferencias × inventario.

---

## 4. Desglose de funcionalidades por módulo (MVP)

| # | Módulo | Funcionalidad v1 |
|---|---|---|
| M1 | **Leads y contactos** | CRUD, tipos múltiples, asignación a agente, timeline de actividades, captura rápida "lead desde WhatsApp" (pegar teléfono → crear), filtros/búsqueda, consentimiento datos |
| M2 | **Inventario de propiedades** | CRUD con galería de fotos (drag & drop), documentos privados, estados, ficha pública compartible `/p/...`, filtros por zona/precio/tipo, código interno |
| M3 | **Matching** | Al guardar propiedad o preferencia → job calcula matches (zona + operación + presupuesto ±15 % + tipo + habitaciones); pantalla "sugeridos para este lead" y "leads para esta propiedad"; marcar enviado/descartado |
| M4 | **Pipeline** | Kanban drag & drop por operación, etapas del sector (editables), valor del embudo, motivo de pérdida obligatorio, historial de etapas |
| M5 | **Agenda y actividades** | Calendario de visitas (semana/día), tareas con vencimiento, "mi día" por agente, feedback post-visita |
| M6 | **WhatsApp** | Click-to-chat con mensaje pre-llenado (incluye link de ficha), registro automático de la interacción en el timeline, recordatorio de visita por plantilla Cloud API (a cliente y agente) |
| M7 | **Automatizaciones básicas** | Recordatorio visita (24 h y 2 h antes), alerta "lead sin actividad hace X días", notificación de nuevo match — vía WhatsApp/email + campana in-app |
| M8 | **Reportes** | Dashboard: leads nuevos por periodo/origen/agente, embudo de conversión, tiempo promedio por etapa, propiedades más visitadas, actividad por agente |
| M9 | **Panel multi-tenant (super-admin)** | Lista de tenants, plan y estado de pago, métricas de uso, suspender/reactivar, impersonar solo-lectura para soporte |
| M10 | **Suscripción y billing** | Selección de plan, checkout MercadoPago, webhooks de pago, estados trial→activo→moroso→suspendido, límites por plan aplicados, facturas/recibos descargables |

---

## 5. Plan de ejecución para el subagente

### 5.0 Metodología de orquestación

- **Orquestador (Fable 5):** mantiene este plan, despacha una tarea a la vez (o tareas paralelas solo si son independientes), revisa cada entrega contra su criterio de terminado, corre verificación independiente, y decide aceptar / devolver / escalar al usuario.
- **Ejecutor:** subagente `general-purpose` con **model: sonnet** por cada tarea. Cada prompt de tarea incluye: contexto del proyecto, la tarea atómica, su criterio de terminado, convenciones del repo y el formato de reporte.
- **Exploraciones/lecturas** (cuando haga falta buscar algo sin modificar): subagente `Explore`.
- Una tarea = un objetivo verificable. Si el subagente detecta que la tarea es más grande de lo previsto, se detiene y reporta en vez de improvisar alcance.
- **Regla $0:** ningún subagente introduce servicios de pago ni registra cuentas; ante cualquier costo potencial, se detiene y reporta 🔴 (§2.6).

**Skills que gobiernan la ejecución** (ya instaladas y verificadas en `~/.claude/skills`):

| Skill | Cuándo se usa |
|---|---|
| `superpowers:test-driven-development` | Toda tarea de implementación: test primero, luego código (los DoD ya lo exigen) |
| `superpowers:subagent-driven-development` + `executing-plans` | Marco del orquestador para despachar tareas y revisar entregas |
| `superpowers:verification-before-completion` | Antes de aceptar cualquier tarea: evidencia real de comandos, no afirmaciones |
| `superpowers:systematic-debugging` | Cuando un test falle o haya comportamiento inesperado |
| `ui-ux-pro-max` (+ `ui-styling`) | Todas las tareas con UI (T1.2, T1.5, T2.2, T2.4, T3.2, T3.3, T6.3): estilos, paletas, accesibilidad y patrones de dashboard/CRM |
| `/security-review` (Anthropic) | Al cerrar F0 (auth/RLS) y en T6.2; opcionalmente como GitHub Action en el CI |
| `/code-review` | Al cierre de cada fase sobre el trabajo acumulado |

**Reporte estándar del subagente (obligatorio al cerrar cada tarea):**
1. Resumen de lo hecho (2–5 líneas).
2. Archivos creados/modificados.
3. Comandos de verificación ejecutados y su salida real (tests, typecheck, lint).
4. Decisiones tomadas dentro de su margen y por qué.
5. Bloqueos o preguntas que requieren decisión del orquestador/usuario (🔴).

### 5.1 Fases y tareas atómicas (ordenadas por dependencia)

> DoD = criterio de "terminado". Todas las tareas exigen además el **gate global** de la sección 6.1. El reporte es el estándar de 5.0; se indica solo lo adicional.

**FASE 0 — Fundaciones** *(sin esto no se construye nada)*

| ID | Tarea | Objetivo | DoD |
|---|---|---|---|
| T0.1 | Inicializar repo + scaffold + `/init` | `git init`, Next.js 15 + TS + Tailwind + shadcn/ui, ESLint/Prettier, estructura de carpetas de §2.5; al terminar el scaffold, correr **`/init`** para generar `CLAUDE.md` con las convenciones del proyecto | `npm run dev` levanta; `typecheck` y `lint` pasan; `CLAUDE.md` y README con comandos existen |
| T0.2 | Proyecto Supabase + conexión | Crear proyecto (🔴 requiere cuenta del usuario), variables `.env`, cliente servidor/browser, Drizzle configurado | Conexión verificada con script de ping a la BD; `.env.example` documentado |
| T0.3 | Esquema núcleo SaaS + RLS | Migraciones: `tenants`, `plans`, `memberships`, `audit_log` + políticas RLS + seeds de planes | Migraciones aplican desde cero; test de aislamiento pasa (JWT tenant A no lee tenant B) |
| T0.4 | Auth completo | Registro (crea tenant + admin), login, invitaciones por email (Resend), claims `tenant_id`/`role` en JWT, middleware por rol | Flujo E2E Playwright: registrar inmobiliaria → invitar agente → agente entra y NO ve config de admin |
| T0.5 | Layout de la app + CI | Shell con navegación por módulos, guard por rol, página de settings del tenant; GitHub Actions (typecheck+lint+tests) | CI verde en PR; navegación funcional con usuario semilla |

🔴 **Checkpoint usuario al cerrar F0:** revisar el scaffold corriendo, el esquema de datos y el flujo de registro antes de construir módulos.

**FASE 1 — Contactos e inventario (M1, M2)**

| ID | Tarea | Objetivo | DoD |
|---|---|---|---|
| T1.1 | Esquema contactos | Migraciones `contacts`, `lead_preferences` + RLS + índices | Migración aplica; test de aislamiento; tipos Drizzle exportados |
| T1.2 | CRUD contactos (UI + servicios) | Listado con filtros/búsqueda, ficha con timeline vacío, formulario con validación Zod, asignación de agente | E2E: crear/editar/filtrar lead; validaciones de teléfono E.164 |
| T1.3 | Preferencias del lead | Sub-formulario de preferencias (operación, zonas, presupuesto...) en la ficha del contacto | E2E: guardar y editar preferencias |
| T1.4 | Esquema propiedades | Migraciones `properties`, `property_media`, `property_documents` + RLS + Storage buckets con políticas por tenant | Test de aislamiento incluye Storage (URL firmada de tenant A inaccesible para B) |
| T1.5 | CRUD propiedades | Formulario por pasos (datos → ubicación → precios), galería con subida/orden de fotos, documentos privados, estados | E2E: crear propiedad con 3 fotos, cambiar estado, filtrar por barrio/precio |
| T1.6 | Ficha pública | Ruta `/p/[slug]/[codigo]` sin auth: fotos, precio, características, botón WhatsApp del agente | Solo muestra propiedades `disponible`; no expone dirección exacta ni datos del propietario |

🔴 **Checkpoint usuario:** revisar UX de contactos y propiedades (nombres de campos, flujo) — es la cara del producto.

**FASE 2 — Pipeline, agenda y actividades (M4, M5)**

| ID | Tarea | Objetivo | DoD |
|---|---|---|---|
| T2.1 | Esquema pipeline + deals | Migraciones `pipelines`, `pipeline_stages`, `deals` (+ historial de etapas) + seeds de etapas por defecto al crear tenant | Test: tenant nuevo nace con pipelines de venta y arriendo |
| T2.2 | Kanban de negocios | Tablero drag & drop, crear negocio desde contacto o propiedad, valor del embudo, motivo de pérdida obligatorio | E2E: mover negocio por 3 etapas; cerrar como perdido exige motivo |
| T2.3 | Esquema visitas + actividades | Migraciones `visits`, `activities` + RLS | Test de aislamiento |
| T2.4 | Agenda de visitas | Calendario semana/día, agendar desde negocio/contacto, estados, feedback post-visita | E2E: agendar → marcar realizada con feedback → aparece en timeline |
| T2.5 | Timeline y "mi día" | Timeline unificado en ficha de contacto/negocio; vista "mi día" (tareas + visitas del agente) | E2E: actividad creada aparece en timeline y en "mi día" |

**FASE 3 — Matching y reportes (M3, M8)**

| ID | Tarea | Objetivo | DoD |
|---|---|---|---|
| T3.1 | Motor de matching | Servicio puro `computeMatches()` (zona+operación+presupuesto±15 %+tipo+habitaciones) con tests unitarios exhaustivos; tabla `matches`; trigger al guardar propiedad/preferencia | 12+ casos unitarios (bordes de presupuesto, multi-zona, sin preferencias) |
| T3.2 | UI de matching | "Propiedades sugeridas" en ficha de lead y "leads sugeridos" en ficha de propiedad; acciones enviar/descartar | E2E: crear preferencia → aparece match → marcar enviado |
| T3.3 | Dashboard y reportes | Métricas de M8 con filtros por rango/agente; queries agregadas eficientes (índices verificados con EXPLAIN) | E2E: dashboards muestran datos del seed; admin ve todo, agente solo lo suyo |

**FASE 4 — WhatsApp y automatizaciones (M6, M7)**

| ID | Tarea | Objetivo | DoD |
|---|---|---|---|
| T4.1 | Click-to-chat + registro | Botón WhatsApp en contacto/negocio/ficha con mensaje pre-llenado (incluye link público); registra actividad automáticamente | E2E: click genera `wa.me` correcto y crea actividad tipo whatsapp |
| T4.2 | Infraestructura de jobs | Vercel Cron + tabla `scheduled_jobs` (outbox con reintentos e idempotencia) | Test: job programado se ejecuta una sola vez aunque el cron corra dos veces |
| T4.3 | WhatsApp Cloud API (opcional por tenant) | 🔴 requiere cuenta Meta Business del usuario y aceptar el micro-costo por plantilla (§2.6). Cliente de envío de plantillas, `integration_settings` por tenant, webhook de estados, plantillas de recordatorio aprobadas. **El canal por defecto de recordatorios es email (Resend, $0)**; WhatsApp saliente se activa por tenant | Envío real de plantilla de prueba verificado en el tier de pruebas de Meta; degradación elegante a email si el tenant no configuró WhatsApp |
| T4.4 | Automatizaciones v1 | Recordatorio de visita (24 h/2 h), alerta lead frío (config. días), notificación de nuevo match; campana in-app; canal: email por defecto, WhatsApp si está activo | Tests de programación/cancelación (si la visita se cancela, el recordatorio no sale) |

**FASE 5 — Billing y super-admin (M9, M10)**

| ID | Tarea | Objetivo | DoD |
|---|---|---|---|
| T5.1 | 🔴 Confirmar precios/planes con usuario y crear cuenta MercadoPago | Precios definitivos y credenciales sandbox | Decisión registrada en docs/ |
| T5.2 | Integración MercadoPago | Suscripciones (preapproval) en sandbox, webhook de pagos firmado, máquina de estados trial→activo→moroso→suspendido | Tests de webhook (pago aprobado, rechazado, cancelación); flujo sandbox completo |
| T5.3 | Límites por plan + UI de suscripción | Enforcement de `max_usuarios`/`max_propiedades`, página "mi plan", upgrade/downgrade, banner de trial | Test: al exceder límite, aviso y bloqueo de creación; upgrade lo desbloquea |
| T5.4 | Panel super-admin | Back-office: tenants, suscripciones, métricas de uso, suspender/reactivar, impersonación solo-lectura auditada | Solo accesible con rol global; toda acción queda en `audit_log` |

**FASE 6 — Endurecimiento y lanzamiento**

| ID | Tarea | Objetivo | DoD |
|---|---|---|---|
| T6.1 | Suite E2E de regresión + seeds demo | Recorrido completo: registro → propiedad → lead → match → visita → negocio ganado; datos demo realistas (tenant de demostración) | Suite verde en CI |
| T6.2 | Auditoría de seguridad | Revisión RLS tabla por tabla, rate limiting en rutas públicas, headers, secretos, validación de webhooks; correr `/security-review` | Hallazgos corregidos o aceptados explícitamente por el usuario |
| T6.3 | Onboarding + landing | Wizard primer uso (crear 1 propiedad y 1 lead guiado), landing comercial con precios y registro | Nuevo tenant llega a "primer match" en <10 min |
| T6.4 | Producción ($0) | Deploy a Vercel Hobby en subdominio `*.vercel.app` + Supabase producción (free tier), monitoreo de errores (Sentry free), backups verificados. 🔴 Dominio propio es opcional y se pregunta (único costo, §2.6) | Smoke test en producción; runbook de incidentes en docs/ |

🔴 **Checkpoint final:** aprobación del usuario para salir a producción.

**Dependencias:** F0 → F1 → F2 → F3 → F4 → F5 → F6 en general; dentro de cada fase, las tareas de esquema (Tx.1) preceden a las de UI. T4.3 y T5.x pueden reordenarse si las cuentas externas (Meta, MercadoPago) se demoran — el orquestador re-planifica sin bloquear el avance.

### 5.2 Protocolo de comunicación

- **Por tarea:** orquestador despacha → subagente ejecuta y entrega el reporte estándar → orquestador valida (§6.1) → *acepta* (siguiente tarea) / *devuelve* (feedback concreto, máx. 2 iteraciones) / *escala* al usuario si tras 2 iteraciones no converge o si surge una decisión 🔴.
- **Al usuario se le reporta:** al cerrar cada fase (resumen + demo de qué se puede probar), en cada checkpoint 🔴, y ante cualquier cambio de alcance, costo nuevo o dependencia externa.
- **Registro:** decisiones importantes quedan en `docs/decisiones.md` (ADRs cortos); el estado de tareas se lleva en `docs/estado.md` (backlog → en curso → hecho) para sobrevivir entre sesiones.

## 6. Criterios de calidad y validación

### 6.1 Gate de aceptación por tarea (lo revisa el orquestador antes de aceptar)

1. `typecheck`, `lint` y **todos** los tests pasan — con salida real en el reporte, no afirmaciones.
2. Tests nuevos cubren la funcionalidad de la tarea (unit para servicios, E2E para flujos de UI); las tareas de esquema incluyen **test de aislamiento multi-tenant**.
3. Migraciones aplican desde cero sobre BD vacía (no solo incrementalmente).
4. Revisión del diff por el orquestador: consistencia con el modelo de datos (§3), convenciones del repo, sin secretos hardcodeados, sin alcance no pedido.
5. En tareas con UI: verificación funcional real (levantar la app y ejercitar el flujo), no solo tests.
6. Al cerrar cada fase: `/code-review` sobre el trabajo acumulado; hallazgos críticos se corrigen antes de abrir la fase siguiente.

### 6.2 Puntos de control con el usuario (🔴)

| Momento | Qué decide el usuario |
|---|---|
| Ahora | Aprobación de este plan |
| T0.2 | Crear/facilitar cuenta Supabase (gratis) |
| Fin F0 | Visto bueno a scaffold, esquema y flujo de registro |
| Fin F1 | Visto bueno a UX de contactos y propiedades |
| Antes T4.3 | Cuenta Meta Business + decidir si activas WhatsApp saliente (micro-costo §2.6) o solo email $0 |
| T5.1 | Precios definitivos + cuenta MercadoPago (sandbox gratis) |
| T6.2 | Aceptación de riesgos de seguridad residuales (si los hay) |
| T6.4 | Luz verde a producción; dominio propio opcional (único costo, se lanza gratis en `*.vercel.app` si prefieres) |
| Siempre | **Cualquier costo, por pequeño que sea**, cambio de alcance o desviación del plan |

## Verificación end-to-end del MVP (definición de "producto terminado")

Con dos tenants semilla (Inmobiliaria A y B):
1. Registrar la Inmobiliaria A, invitar un agente y un asistente; verificar permisos de cada rol.
2. Crear propiedad con fotos → compartir ficha pública → crear lead con preferencias → el match aparece → agendar visita → recibir recordatorio (WhatsApp/email) → registrar feedback → mover el negocio hasta "Cerrado ganado".
3. Verificar con sesión del tenant B que **ningún** dato de A es visible (UI, API y Storage).
4. Dashboard refleja las operaciones anteriores; suite Playwright completa verde en CI.
5. Flujo de suscripción sandbox de MercadoPago: trial → pago → moroso → suspensión → reactivación; límites de plan aplicados.
6. Panel super-admin muestra ambos tenants y su estado de facturación.

## Tras tu aprobación

1. T0.1 se despacha al primer subagente Sonnet: scaffold del proyecto y luego **`/init`** para generar el `CLAUDE.md`; este plan se copia a `docs/` del repo como referencia canónica.
2. Se crea `docs/estado.md` con el backlog completo de tareas para trazabilidad entre sesiones.
3. El orquestador solo te interrumpirá en los checkpoints 🔴, al cierre de cada fase, y **ante cualquier costo potencial** (regla $0 de §2.6).
