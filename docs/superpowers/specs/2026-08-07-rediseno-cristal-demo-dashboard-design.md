# Diseño — Rediseño cristalizado, modo demo y dashboard financiero

Fecha: 2026-08-07
Tareas nuevas: **T1.12** (sistema visual), **T1.13** (modo demo), **T1.14** (dashboard)

---

## Contexto y motivación

El usuario pidió tres cosas que **no estaban en el plan aprobado** (`docs/plan-maestro.md`) y se
intercalan en el backlog de F1/F2:

1. Un diseño "gradiente cristalizado" (glassmorphism) para todo el CRM.
2. Un login de prueba que no exija credenciales reales.
3. Un dashboard con ganancias netas y pérdidas netas del mes, en vivo.

Estas tres piezas son independientes entre sí: pueden implementarse y verificarse por separado, en
cualquier orden. Se numeran T1.12–T1.14 para no colisionar con las tareas pendientes del plan
(T1.9, T1.10, T1.11, T2.1–T2.3).

### Estado del que se parte (verificado 2026-08-07)

- UI: shadcn/ui `base-nova` con `baseColor: neutral`, tokens OKLCH en escala de grises. Sin
  gradientes, sin marca, sin selector de tema. `.dark` está definido en `globals.css` pero **nada
  lo activa**. `layout.tsx` conserva `title: "Create Next App"` por defecto.
- Tailwind v4 con configuración CSS-first (`@theme inline` en `src/app/globals.css`); no existe
  `tailwind.config.*`.
- Auth: Supabase Auth email+password real y funcional. `tenant_id`/`role` se escriben en
  `app_metadata` desde el servidor con `service_role` (ADR-003, ADR-006), viajan en el JWT y
  alimentan las políticas RLS vía `public.current_tenant_id()` / `public.current_member_role()`.
  No hay Custom Access Token Hook.
- Dashboard: **no existe**. `src/app/(app)/app/page.tsx` solo saluda al usuario.
- Datos de dinero: **no existen**. Las tablas `deals`, `pipelines`, `pipeline_stages` (T2.1) y
  `subscriptions`, `payments` (F3) no están creadas. El esquema llega solo hasta la migración
  `0010`, con `tenants`, `plans`, `memberships`, `invitations`, `auditLog`, `contacts`,
  `lead_preferences`, `properties`, `property_media`, `property_documents`.

### Decisiones del usuario en esta sesión

| Pregunta | Elección |
|---|---|
| Login de prueba | **Modo demo temporal** — botón de un clic; el auth real queda intacto |
| Origen de las cifras del dashboard | **Datos de ejemplo (mock)** — placeholder hasta que exista el módulo de negocios |
| Alcance visual | **Completo** — fondo, tarjetas y navegación en todas las páginas |
| Tema base | **Oscuro por defecto** |

---

## T1.12 — Sistema visual cristalizado

### Enfoque

El rediseño se hace **por tokens, no por reescritura de componentes**. Como Tailwind v4 usa
configuración CSS-first y los 17 componentes shadcn ya instalados leen las variables CSS, redefinir
los tokens en `globals.css` propaga el estilo a toda la aplicación sin tocar cada componente.

### Cambios

1. **Activar el tema oscuro por defecto.** Añadir `className="dark"` al `<html>` en
   `src/app/layout.tsx`. No se implementa selector de tema (YAGNI; el usuario eligió oscuro por
   defecto, no ambos).

2. **Paleta.** Redefinir los tokens OKLCH del bloque `.dark` en `src/app/globals.css` a una base
   índigo/violeta/cian sobre fondo oscuro. Se conservan los nombres de token existentes
   (`--background`, `--card`, `--primary`, `--sidebar-*`, `--chart-1..5`) para no romper nada.

3. **Fondo de malla degradada.** Componente nuevo
   `src/components/layout/gradient-background.tsx`: tres blobs radiales difuminados en
   `position: fixed` con `-z-10`, montado una sola vez en el layout raíz. No se repinta por página
   ni participa en el scroll.

4. **Utilidad `.glass`.** Una única clase definida en `globals.css`:
   `backdrop-blur`, fondo semitransparente, borde de 1px translúcido y sombra interior sutil.
   Se aplica a `Card`, `Dialog`, `Popover` y a la barra de navegación.

5. **Metadatos.** Corregir `title`/`description` en `src/app/layout.tsx`, que siguen con el valor
   por defecto de `create-next-app`.

### Restricciones de legibilidad y accesibilidad

- Las tablas densas (contactos, propiedades) llevan el efecto de vidrio **solo en el contenedor**,
  nunca por fila: el blur detrás de texto denso reduce el contraste y cansa la vista.
- Todo texto sobre superficie de vidrio debe cumplir contraste **WCAG AA (4.5:1)**. Se verifica
  antes de dar la tarea por terminada.
- Degradación: bajo `prefers-reduced-transparency` y `prefers-reduced-motion`, las superficies de
  vidrio se vuelven sólidas y los blobs no animan.

### Criterio de terminado

- `npm run typecheck`, `npm run lint` y `npm test` limpios.
- Login, dashboard, contactos y propiedades revisados en `npm run dev` sin regresiones visuales
  (tablas legibles, diálogos utilizables, foco visible).
- Contraste AA confirmado en texto sobre vidrio.

---

## T1.13 — Modo demo

### Principio rector

**El flujo de autenticación real no se modifica.** `signInWithPassword`, el registro con
`registerTenant()` y el flujo de invitaciones quedan exactamente como están. El modo demo es una
puerta lateral adicional, no un reemplazo ni una bifurcación del código de auth.

### Cambios

1. **Botón "Entrar como demo"** en `src/app/(auth)/login/page.tsx`, visualmente separado del
   formulario real (separador + estilo secundario), para que nadie lo confunda con el acceso normal.

2. **Server Action `loginDemo()`** en `src/app/(auth)/login/actions.ts`:
   - Busca el tenant demo por un slug fijo (`demo-inmobiliaria`).
   - Si no existe, lo crea junto con su usuario admin reutilizando `registerTenant()`, con
     credenciales deterministas leídas de variables de entorno
     (`DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`).
   - Inicia sesión con `signInWithPassword` normal y redirige a `/app`.

3. **Interruptor de seguridad.** El botón se renderiza y la acción se ejecuta **solo** si
   `NEXT_PUBLIC_DEMO_MODE === "true"`. Sin esa variable, `loginDemo()` retorna error inmediatamente
   y el botón no aparece. Esto impide que un atajo de pruebas quede expuesto en un despliegue real.

4. **Semillas.** El tenant demo arranca con contactos y propiedades de ejemplo, reutilizando los
   seeds existentes, para que las pantallas no se vean vacías.

### Por qué esta forma y no otra

Reutilizar `registerTenant()` significa que el usuario demo obtiene su `tenant_id` y `role` en
`app_metadata` igual que cualquier otro usuario. Por lo tanto **RLS sigue aplicando sin excepción** y
el aislamiento multi-tenant no se debilita: un tenant demo es simplemente un tenant más. Las
alternativas descartadas (saltarse Supabase Auth, hardcodear un tenant, un bypass en el middleware)
habrían creado una ruta de código que evade RLS — precisamente la garantía que el plan declara
innegociable.

### Riesgo aceptado

Cualquiera que llegue al login con `NEXT_PUBLIC_DEMO_MODE` activo entra al tenant demo con un clic.
Es intencional para poder probar, y por eso la variable debe quedar **desactivada al desplegar a
producción**. Queda anotado en `docs/despliegue.md`.

### Criterio de terminado

- Con `NEXT_PUBLIC_DEMO_MODE=true`: el botón entra a `/app` con datos de ejemplo visibles.
- Con la variable ausente o en `false`: el botón no se renderiza y `loginDemo()` retorna error.
- Login y registro reales siguen funcionando (E2E existentes verdes).
- Test de aislamiento: el tenant demo no ve datos de otros tenants.

---

## T1.14 — Dashboard financiero (datos de ejemplo)

### El riesgo que este diseño ataca

El usuario eligió datos mock. El peligro real no es técnico sino de memoria organizacional: que en
unas semanas nadie recuerde qué cifras son inventadas y alguien tome una decisión sobre ellas, o que
se comparta una demo creyendo que refleja el negocio. El diseño lo mitiga en tres frentes: frontera
única en el código, aviso visible en pantalla, y contrato de datos estable.

### Cambios

1. **Frontera explícita.** Todas las cifras inventadas viven en un único módulo
   `src/server/services/dashboard/mock-data.ts`. Ningún número suelto en los componentes. Cuando
   exista la tabla `deals` (T2.1), se sustituye ese archivo y la UI no cambia.

2. **Contrato estable desde ya.** Se define el tipo:

   ```ts
   type MonthlyFinancials = {
     netGains: number;   // COP
     netLosses: number;  // COP
     net: number;        // netGains - netLosses
     currency: "COP";
     series: { date: string; gains: number; losses: number }[];
   };
   ```

   El servicio real de F2 implementará **este mismo contrato**, de modo que el reemplazo sea un
   cambio de una sola capa.

3. **Aviso visible.** Badge "Datos de demostración" en el encabezado del dashboard. Visible en la
   interfaz, no un comentario escondido en el código.

4. **"En vivo".** Un client component refresca cada 5 segundos con `setInterval`, aplicando una
   variación pequeña y determinista sobre una base fija: los números se mueven sin saltos absurdos.
   No se usan websockets ni polling al servidor — sería infraestructura desperdiciada sobre datos
   falsos, y habría que desmontarla al llegar los datos reales.

5. **Contenido.** Tres tarjetas de vidrio (Ganancias netas / Pérdidas netas / Neto del mes) en COP
   usando `formatCOP` de `src/lib/format.ts`, más un gráfico de línea de los últimos 30 días.

6. **Ubicación.** Ruta nueva `src/app/(app)/app/dashboard/page.tsx`, enlazada desde la navegación.
   `src/app/(app)/app/page.tsx` (el saludo actual) se mantiene como está.

### Dependencia nueva

Instalar el componente `chart` de shadcn/ui, que trae **Recharts**. Es la única dependencia añadida
por este spec. Es gratuita y de código abierto: no afecta la regla $0.

### Criterio de terminado

- El dashboard renderiza las tres tarjetas y el gráfico con formato COP correcto.
- El badge "Datos de demostración" está visible.
- Las cifras se actualizan cada 5s sin parpadeo ni saltos irreales.
- Unit tests sobre el generador mock (determinismo, `net = netGains - netLosses`, longitud de la
  serie) y sobre el formato COP.
- `npm run typecheck`, `npm run lint`, `npm test` limpios.

---

## Verificación global

Al terminar las tres tareas, y antes de declarar nada como completo:

1. `npm run typecheck`
2. `npm run lint`
3. `npm test`
4. `npm run dev` — despliegue local para revisión visual del usuario (**pedido explícito**).

Se reporta la salida real de cada comando. No se afirma que algo pasa sin haberlo ejecutado
(ver memoria `feedback-verificar-antes-de-afirmar`).

## Regla $0

Ninguna de las tres tareas introduce servicios de pago, cuentas nuevas ni despliegues. Recharts es
open source. Se cumple la política del plan §2.6.

---

## Fuera de alcance (explícito)

- Selector de tema claro/oscuro (se eligió oscuro por defecto, no ambos).
- Tablas `deals`/`pipelines` reales — siguen siendo T2.1, sin adelantar.
- Integración con MercadoPago o cifras financieras reales — sigue siendo F3.
- Las tareas pendientes del plan: T1.9, T1.10, T1.11, T2.1–T2.3, F2, F3.
