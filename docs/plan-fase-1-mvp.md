# FASE 1 — Núcleo CRM (Contactos + Inventario + Pipeline Kanban)

**Objetivo:** Producto vendible mínimo para inmobiliarias — gestionar contactos, propiedades y seguimiento en kanban.

**Visión:** Un usuario registra su inmobiliaria, crea propiedades con fotos, captura leads, ve matches básicos en la UI, y mueve los negocios por el pipeline kanban. Sin automatizaciones complejas, sin calendario de visitas avanzado.

**Estimación:** 4–5 semanas  
**Entrada:** Fase 0 (F0) completada ✓ — auth, multi-tenancy, RLS funcional.  
**Salida:** MVP core funcionando; F2 (WhatsApp + calendario simple) listo para entrar.

---

## Cambios respecto al plan maestro

| Funcionalidad | Plan original | Fase 1 recortada | Razón |
|---|---|---|---|
| **Matching** | Motor automático con 12+ casos, tabla `matches`, UI de sugerencias | ❌ CORTADO | Matching manual inicial suficiente para MVP; usuario ve contactos + propiedades, elige qué conectar |
| **Timeline de actividades** | Timeline unificado en fichas de contacto/negocio | ⏸️ Reducido | Solo campo "próxima actividad" (fecha); timeline completo queda para F2+ |
| **Agenda de visitas** | Calendario semana/día, visitas programadas, feedback estructurado | ⏸️ Reducido | Solo vista simple "próximas actividades" (tabla); calendario completo queda para F2+ |
| **Búsqueda** | Búsqueda avanzada con filtros complejos | Simplificada | Búsqueda por nombre, teléfono, tipo de contacto; filtros básicos en propiedades (zona, precio, tipo) |
| **Reportes (M8)** | Dashboard completo: leads, embudo, tiempo por etapa, actividad | ❌ CORTADO | MVP sin reportes; users pueden exportar CSV manualmente si necesitan |

---

## Desglose de tareas atómicas

**Dependencias:** T1.1 → T1.2 → T1.3 (en paralelo), T1.4 → T1.5 → T1.6 (en paralelo), T2.1 → T2.2 (con T1.2+T1.5 completadas).

### **T1.1 — Esquema y migraciones: contactos y preferencias**

**Objetivo:** Crear tablas `contacts`, `lead_preferences` con RLS, índices y seed de datos de prueba.

**Subtareas:**
1. Migración `000X_contacts.sql`: tabla `contacts` con campos (nombre, teléfono E.164, email, cédula/NIT, tipos[], origen, estado lead, notas, agente asignado, consentimiento, tenant_id, timestamps).
2. Migración `000X_lead_preferences.sql`: tabla `lead_preferences` (contacto, operación, tipos inmueble[], zonas[], presupuesto min–max, hab/baños/parqueos mín., estrato, tenant_id, timestamps).
3. Políticas RLS en ambas tablas: `SELECT/INSERT/UPDATE/DELETE` limitados a `tenant_id = auth.jwt() -> 'app_metadata' -> 'tenant_id'`.
4. Índices: `(tenant_id, id)`, `(tenant_id, created_at DESC)`, `(tenant_id, estado)`.
5. Types Drizzle exportados en `src/server/db/schema.ts`.
6. Seed de 10 contactos de prueba por tenant (variedad de tipos/orígenes).

**DoD:**
- ✓ Migraciones aplican desde cero (`npm run db:migrate`)
- ✓ `npm run db:seed` genera datos de prueba
- ✓ Test de aislamiento pasa: tenant A no ve contactos de tenant B (Vitest)
- ✓ `npm run typecheck` limpio
- ✓ Archivo `CHANGESET.md` con cambios de schema

**Duración:** 2–3 días

---

### **T1.2 — Servicio y CRUD contactos (backend + API)**

**Objetivo:** Lógica de negocio pura en `src/server/services/contacts.ts` + Server Actions.

**Subtareas:**
1. Servicio `ContactService` con funciones:
   - `createContact(data, tenantId)` — validar E.164, tipos válidos, consentimiento, insertar
   - `updateContact(id, data, tenantId)` — editar, validaciones iguales
   - `getContact(id, tenantId)` — ficha completa con preferencias anidadas
   - `listContacts(tenantId, filters)` — búsqueda por nombre/teléfono, filtro por tipo/origen/estado, paginación
   - `deleteContact(id, tenantId)` — soft delete (marcar inactivo)
   - Validaciones Zod en `src/lib/schemas.ts` (nombre, teléfono E.164, tipos, origen)
2. Server Action `createContactAction()` → servicio → Response
3. Server Action `updateContactAction()` → servicio → Response
4. Server Action `listContactsAction()` → servicio → Response
5. Unit tests (Vitest): cobertura de validaciones, funciones servicio, casos de error
6. Tipos TypeScript derivados de Drizzle

**DoD:**
- ✓ `npm run test` — tests unitarios ≥90% cobertura de servicios
- ✓ Server Actions responden JSON correcto
- ✓ Validaciones Zod rechazan teléfono inválido, tipo no soportado, etc.
- ✓ Queries devuelven solo datos del tenant autenticado (verificable con test que cambia JWT)
- ✓ `npm run typecheck` limpio

**Duración:** 2–3 días

---

### **T1.3 — CRUD contactos (UI: listado y ficha)**

**Objetivo:** Interfaz para crear, editar, buscar y ver contactos.

**Subtareas:**
1. Ruta `(app)/contacts/page.tsx` — listado con:
   - Tabla con columnas: nombre, teléfono, tipo, origen, estado, agente, acciones (ver, editar, eliminar)
   - Búsqueda por nombre/teléfono (field de búsqueda conectado a `listContactsAction`)
   - Filtros: tipo (multi-select), origen, estado (desplegables)
   - Paginación (10 por página)
   - Botón "Nuevo contacto" → modal o página de creación
2. Ruta `(app)/contacts/[id]/page.tsx` — ficha del contacto:
   - Información básica (nombre, teléfono, email, cédula, tipos, origen, estado)
   - Sub-sección "Preferencias" (T1.4 lo expande, por ahora mostrar que existe)
   - Campo "Próxima actividad" (fecha, de T1.7)
   - Notas (textarea)
   - Botón "Asignar a agente" (dropdown de usuarios del tenant)
   - Historial de cambios (mini-timeline si existe, por ahora omitir)
   - Botón "Editar"
   - Botón "Ver negocios" → enlace a T2.2 (kanban filtrado por este contacto)
3. Modal/página de creación/edición: formulario con validación in-situ (Zod + React Hook Form)
4. Componente `ContactSearch` reutilizable (búsqueda + filtros)
5. Integración con shadcn/ui: `DataTable`, `Dialog`, `Select`, `Input`, `Button`

**Estilos:**
- Usar paleta de `references/palette.md` (si existe) o neutral shadcn/ui
- Responsive: tabla scrolleable en móvil
- Accesibilidad: labels, focus visible, atributos ARIA

**DoD:**
- ✓ E2E Playwright: crear contacto → aparece en listado → click "ver" → ficha cargada
- ✓ Búsqueda filtra en tiempo real (input → API → UI actualizada)
- ✓ Editar contacto: cambiar nombre → guardar → refrescarse en listado
- ✓ Filtros funcionan (seleccionar tipo "comprador" → solo muestra compradores)
- ✓ Validación: campo teléfono rechaza entrada inválida con mensaje
- ✓ `npm run lint` limpio; Tailwind clases OK

**Duración:** 3–4 días

---

### **T1.4 — Servicio y CRUD preferencias del lead**

**Objetivo:** Gestionar preferencias de cada contacto (zona, presupuesto, tipo inmueble, etc.).

**Subtareas:**
1. Migración (si falta): confirmar que `lead_preferences` ya existe de T1.1
2. Servicio `LeadPreferencesService`:
   - `createPreference(contactId, data, tenantId)`
   - `updatePreference(id, data, tenantId)`
   - `getPreference(contactId, tenantId)` — una per contacto
   - Validación Zod (operación en [venta|arriendo], presupuesto min<max, zonas no vacías si operación=venta, etc.)
3. Server Actions para las tres operaciones anteriores
4. Unit tests

**DoD:**
- ✓ Tests unitarios validación Zod
- ✓ Server Actions funcionan
- ✓ `npm run typecheck` limpio

**Duración:** 1–2 días

---

### **T1.5 — Sub-formulario "Preferencias" en ficha de contacto (UI)**

**Objetivo:** Dentro de la ficha de contacto, sección plegable o tab para editar preferencias.

**Subtareas:**
1. Componente `LeadPreferencesForm` — formulario con:
   - Operación: radio o select (venta | arriendo)
   - Tipos de inmueble: checkboxes (apartamento, casa, lote, etc.)
   - Zonas/barrios: input multi-select o combobox
   - Presupuesto: dos inputs (min, max) con formato COP
   - Habitaciones mín., baños mín., parqueaderos mín.: inputs número
   - Estrato: select (1–6) o rango
   - Botón "Guardar" → Server Action → UI actualiza
2. Integración en ficha de contacto (T1.3)
3. Validación in-situ

**DoD:**
- ✓ E2E: ir a contacto → abrir "Preferencias" → llenar formulario → guardar → volver a abrir, datos persisten
- ✓ Validación: presupuesto min ≥ 0, min < max
- ✓ Responsive, accesible

**Duración:** 2–3 días

---

### **T1.6 — Esquema y migraciones: propiedades, media y documentos**

**Objetivo:** Tablas `properties`, `property_media`, `property_documents` con RLS e índices.

**Subtareas:**
1. Migración `000X_properties.sql`:
   - Tabla `properties` (código interno, tipo, operación, estado, propietario/contacto, precio venta, canon, área, hab/baños/parqueos, estrato, dirección privada, barrio/ciudad/depto públicos, lat/lng, matrícula, exclusividad, % comisión, descripción, tenant_id, timestamps)
   - Código interno: generado como `${tenant_id.slice(0,8)}-${secuencial}` (único por tenant)
2. Migración `000X_property_media.sql`:
   - `property_media` (propiedad, url en Storage, tipo [foto|video], orden, portada, tenant_id, timestamps)
3. Migración `000X_property_documents.sql`:
   - `property_documents` (propiedad, nombre/tipo, url en Storage, tenant_id, timestamps)
4. RLS en las tres tablas (filtro por `tenant_id`)
5. Índices: `(tenant_id, id)`, `(tenant_id, estado)`, `(tenant_id, tipo, operacion)`, `(tenant_id, created_at DESC)`
6. Seeds: 5 propiedades de prueba por tenant (variedad de tipos/estados)
7. Bucket de Storage `property-photos-{tenant_id}` + policy RLS simple (solo lectura pública si propiedad `estado='disponible'`, escritura restringida)

**DoD:**
- ✓ Migraciones aplican
- ✓ Seeds con propiedades de prueba
- ✓ Test de aislamiento (tenant A no ve propiedades de B)
- ✓ `npm run typecheck` limpio
- ✓ Archivo CHANGESET.md

**Duración:** 2–3 días

---

### **T1.7 — Servicio CRUD propiedades (backend + API)**

**Objetivo:** Lógica de gestión de propiedades en `src/server/services/properties.ts`.

**Subtareas:**
1. Servicio `PropertyService`:
   - `createProperty(data, tenantId)` — validar tipo/operación/estado, generar código interno, insertar
   - `updateProperty(id, data, tenantId)` — permitir cambio de estado (disponible → reservada, etc.), validaciones
   - `getProperty(id, tenantId)` — propiedad + media + documentos
   - `listProperties(tenantId, filters)` — filtrar por estado, tipo, operación, rango precio, barrio/ciudad; paginación
   - `deleteProperty(id, tenantId)` — soft delete
   - `generatePropertyCode(tenantId)` — código único
2. Server Actions (create, update, list, get)
3. Validaciones Zod en `src/lib/schemas.ts`
4. Unit tests ≥90% cobertura

**DoD:**
- ✓ Tests unitarios
- ✓ Server Actions responden correctamente
- ✓ Generación de código único verificada
- ✓ `npm run test` y `npm run typecheck` limpios

**Duración:** 2–3 días

---

### **T1.8 — CRUD propiedades (UI: listado y ficha)**

**Objetivo:** Interfaz para crear, editar, buscar y ver propiedades.

**Subtareas:**
1. Ruta `(app)/properties/page.tsx` — listado con:
   - Tabla: código, tipo, operación, precio/canon, ubicación (barrio), estado, acciones
   - Búsqueda: por código, barrio, ciudad
   - Filtros: tipo, operación, estado, rango precio
   - Botón "Nueva propiedad" → wizard o página
2. Ruta `(app)/properties/[id]/page.tsx` — ficha de propiedad:
   - Información básica (tipo, precio, ubicación, características, matrícula, comisión)
   - Galería de fotos (mostrar, no editar en MVP — edición queda para después)
   - Documentos (lista descargable)
   - Botón "Compartir" → genera `wa.me` con link a ficha pública
   - Botón "Editar"
   - (Opcional en F1) Sub-sección "Negociosasociados" (leads que vieron esta propiedad)
3. Wizard de creación: paso 1 (datos básicos) → paso 2 (ubicación) → paso 3 (precios) → confirmar
4. Componente de galería (lectura de `property_media`)
5. Integración shadcn/ui

**Estilos:**
- Neutral, responsive, accesible (con referencias/palette.md si existe)

**DoD:**
- ✓ E2E: crear propiedad con 3 fotos (upload) → aparece en listado → ficha carga correctamente
- ✓ Filtros funcionan
- ✓ Botón "Compartir" copia link wa.me al portapapeles
- ✓ Editar propiedad: cambiar estado → guardar → refrescarse
- ✓ Responsive, accesible

**Duración:** 4–5 días (incluye manejo de upload de fotos)

---

### **T1.9 — Upload y almacenamiento de fotos (propiedades)**

**Objetivo:** Permitir al usuario subir fotos de propiedades y almacenarlas en Supabase Storage.

**Subtareas:**
1. Endpoint POST `/api/upload/property-photo` (o Server Action):
   - Recibe `file` (FormData), `propertyId`, `tenantId`
   - Validar: file es imagen (JPEG, PNG, WebP), <5MB
   - Generar nombre único: `${propertyId}/${uuid}.ext`
   - Subir a bucket `property-photos-{tenant_id}`
   - Retornar URL pública/firmada + registrar en `property_media`
   - Manejar errores (cuota de Storage, permissions)
2. Componente de drop-zone o input file en el wizard de creación
3. Preview de fotos tras upload
4. Reordenamiento (drag-drop): actualizar campo `orden` en `property_media`
5. Botón para marcar portada (actualizar `portada` en `property_media`)

**Validaciones:**
- Tipo MIME válido
- Tamaño <5 MB
- Máximo N fotos por propiedad (ej. 20 en MVP)
- Tamaño total por tenant respeta cuota (1 GB Supabase free)

**DoD:**
- ✓ E2E: seleccionar 3 fotos → preview inmediato → guardar propiedad → fotos en Storage verificables
- ✓ Reordenamiento funciona (cambiar orden → guardar → recargar, orden persiste)
- ✓ Portada marcada correctamente
- ✓ Error handling: foto demasiado grande → mensaje amable
- ✓ Unit test de validación MIME

**Duración:** 2–3 días

---

### **T1.10 — Ficha pública de propiedad (`/p/[tenant]/[codigo]`)**

**Objetivo:** Ruta pública (sin auth) para compartir propiedad por WhatsApp.

**Subtareas:**
1. Ruta `(public)/p/[tenantSlug]/[propertyCode]/page.tsx`:
   - Parámetro dinámico: tenant slug + código de propiedad
   - Query: obtener propiedad + media (RLS: solo si `estado='disponible'`)
   - Layout: galería de fotos, resumen (tipo, precio, ubicación, características)
   - **NO mostrar:** dirección exacta, documentos privados, nombre del propietario (solo agente)
   - Botón "Contactar por WhatsApp" → genera link `wa.me/+57XXXXXXX?text=...` (teléfono del agente + mensaje template)
   - SEO: meta tags (Open Graph para preview en WhatsApp), canonicals
2. Metadata dinámica (title, description, image) basada en propiedad
3. Responsive, carga rápida (caché estática si es posible)

**DoD:**
- ✓ E2E Playwright: navegar a URL pública → galería carga → botón WhatsApp genera link correcto
- ✓ Verificar: no expone dirección exacta ni propietario
- ✓ Propiedades con `estado != disponible` retornan 404
- ✓ Open Graph tags presentes (verificable en dev tools o wa.me preview)
- ✓ Responsive

**Duración:** 2 días

---

### **T2.1 — Esquema pipeline, stages y deals**

**Objetivo:** Tablas `pipelines`, `pipeline_stages`, `deals` con RLS e índices, seeds de defaults.

**Subtareas:**
1. Migración `000X_pipelines.sql`:
   - `pipelines` (nombre, operación [venta|arriendo], tenant_id, timestamps)
2. Migración `000X_pipeline_stages.sql`:
   - `pipeline_stages` (pipeline, nombre, orden, tenant_id, timestamps)
3. Migración `000X_deals.sql`:
   - `deals` (contacto, propiedad, pipeline, etapa actual, agente, valor estimado, motivo pérdida [si está cerrado], fechas de entrada por etapa [JSONB], tenant_id, timestamps)
4. Migración `000X_deal_stage_history.sql` (o usar JSONB en `deals.stage_history`):
   - Historial: quién movió a qué etapa y cuándo
5. RLS en las tres tablas
6. Índices: `(tenant_id, id)`, `(tenant_id, pipeline)`, `(tenant_id, etapa_actual)`, `(tenant_id, agente)`, `(tenant_id, created_at DESC)`
7. Seed: crear automáticamente 2 pipelines (Venta y Arriendo) con sus etapas estándar al crear tenant
   - Venta: Prospecto → Calificado → Visita agendada → Oferta → Negociación → Promesa → Escrituración → Cerrado ganado / Cerrado perdido
   - Arriendo: Prospecto → Calificado → Solicitud/estudio → Aprobado → Contrato → Cerrado ganado / Cerrado perdido
8. Catálogo de motivos de pérdida (JSONB o tabla separada): bajo presupuesto, zona no preferida, inmueble no gusto, etc.

**DoD:**
- ✓ Migraciones aplican
- ✓ Al crear tenant, se crean automáticamente pipelines + stages default
- ✓ Test de aislamiento
- ✓ `npm run typecheck` limpio
- ✓ CHANGESET.md

**Duración:** 2–3 días

---

### **T2.2 — Servicio deals (backend + Kanban API)**

**Objetivo:** Lógica de negociosy movimiento entre etapas.

**Subtareas:**
1. Servicio `DealsService`:
   - `createDeal(contacto, propiedad, pipeline, tenantId)` → inserta en etapa inicial
   - `updateDealStage(dealId, newStage, tenantId)` → valida transición, actualiza, registra en historial
   - `closeDeal(dealId, won|lost, motivo?, tenantId)` → marca como ganado/perdido, registra motivo
   - `getDeal(id, tenantId)` → deal + historial
   - `listDealsByStage(pipeline, stage, tenantId)` → para kanban
   - `listDealsByAgent(agente, tenantId)` → deals del agente
2. Server Actions
3. Validaciones: solo etapas válidas en pipeline, motivo requerido si está cerrando perdido
4. Unit tests

**DoD:**
- ✓ Tests unitarios ≥90%
- ✓ Validación de etapas correcta
- ✓ Historial se registra al mover
- ✓ `npm run test` y `npm run typecheck` limpios

**Duración:** 2–3 días

---

### **T2.3 — Kanban de deals (UI)**

**Objetivo:** Interfaz visual drag-and-drop para mover negocios entre etapas.

**Subtareas:**
1. Ruta `(app)/deals/page.tsx` o `(app)/pipelines/[id]/page.tsx` — kanban con:
   - Selector de pipeline/operación (Venta o Arriendo)
   - Columnas por cada etapa del pipeline elegido
   - Tarjetas de deals en cada columna (mostrar: contacto, propiedad, valor, agente, fecha entrada etapa)
   - Drag-and-drop entre columnas → Server Action `updateDealStage()` → UI refrescar
   - Click en tarjeta → modal o drawer con detalles del deal
   - Botón para crear nuevo deal (modal: seleccionar contacto + propiedad → pipeline detectado automáticamente)
   - Stats: valor total del embudo, count de deals por etapa
   - Filtro por agente (opcional en MVP)
2. Componentes de tarjeta y columna (puede usar librería `@hello-pangea/dnd` o `react-beautiful-dnd`)
3. Modal de detalles: botón "Cerrar como perdido" (dropdown + motivo obligatorio) o "Cerrar como ganado"
4. Responsive: en mobile, mostrar como lista scrolleable o tabs por etapa

**Estilos:**
- Colores por etapa (usar referencias/palette.md)
- Tipografía clara, valores en COP formateados

**DoD:**
- ✓ E2E: crear deal en "Prospecto" → arrastrarlo a "Calificado" → deal aparece en nueva etapa
- ✓ Click deal → detalles modal → historial de etapas visible
- ✓ Cerrar como perdido: exige motivo, lo guarda, el deal desaparece del kanban
- ✓ Valores agregados (embudo) actualizados en tiempo real
- ✓ Responsive (mobile muestra tabs por etapa)
- ✓ Accesible (navegación por teclado en kanban, focus visible)

**Duración:** 3–4 días

---

### **T1.11 — Campo "Próxima actividad" en contactos y deals (T1.7)**

**Objetivo:** Agregar campo de fecha simple para rastrear próxima fecha de seguimiento, sin calendar completo.

**Subtareas:**
1. Migración: agregar columna `next_activity_date` (nullable) a `contacts` y `deals`
2. Actualizar Drizzle schema
3. En ficha de contacto (T1.3): campo de fecha (date input) + botón "Establecer próxima actividad"
4. En detalle de deal (dentro de modal T2.3): mismo campo
5. En listado de contactos/deals: mostrar "Próxima actividad" en columna si existe

**DoD:**
- ✓ Migración aplica
- ✓ E2E: establecer fecha → recarga → persiste
- ✓ `npm run typecheck` limpio

**Duración:** 1 día

---

## Cronograma sugerido F1

| Semana | Tareas | Notas |
|---|---|---|
| 1 | T1.1 (schema contactos), T1.6 (schema propiedades) | Parallelizable: no dependen una de otra |
| 2–3 | T1.2 (servicio contactos) + T1.7 (servicio propiedades) en paralelo | Ambas independientes |
| 3–4 | T1.3 (UI contactos) + T1.8 (UI propiedades) en paralelo | Requieren T1.2 + T1.7 respectivamente |
| 4 | T1.4–T1.5 (preferencias backend + UI) | Depende de T1.2 |
| 4 | T1.9 (upload fotos) | Depende parcialmente de T1.8 |
| 4 | T1.10 (ficha pública) | Depende de T1.8 (propiedades) |
| 5 | T2.1 (schema pipeline/deals) | Parallelizable, no depende de T1.x |
| 5–6 | T2.2 (servicio deals) + T2.3 (UI kanban) | T2.2 debe estar listo antes de T2.3 |
| 5–6 | T1.11 (próxima actividad) | Pequeña, puede hacerse en paralelo con T2.2 |

**Total esperado:** 4–5 semanas si se ejecutan en paralelo.

---

## Criterios de aceptación por tarea (gate F1)

1. **Código:**
   - `npm run typecheck` — 100% limpio
   - `npm run lint` — 100% limpio
   - `npm run test` — ≥90% cobertura en servicios; E2E green
   - Sin hardcodes de secretos, variables `.env` documentadas

2. **Base de datos:**
   - Migraciones aplican desde cero (`npm run db:migrate`)
   - RLS verificado: test de aislamiento tenant A ↔ B pasan
   - Índices presentes (verifiable con `\d table_name` en psql)

3. **UI/UX:**
   - Funcionalidad verificada end-to-end en navegador real
   - Responsive en móvil (Chrome DevTools mobile view)
   - Accesibilidad: labels, focus visible, contrast ≥4.5:1

4. **Documentación:**
   - Archivo CHANGESET.md por tarea (qué tablas/campos nuevos, qué cambios)
   - Comments en código solo si lógica es no-obvia
   - README.md actualizado con instrucciones de desarrollo

---

## Entrada a F2

Una vez F1 sea aceptada por el usuario:
- Demo en vivo: crear propiedad + lead + mover deal por kanban
- Todos los tests verdes en CI
- Checkpoint con usuario: visto bueno a UX antes de proseguir

Luego: F2 (WhatsApp click-to-chat + calendario simple) — 1–2 semanas.
