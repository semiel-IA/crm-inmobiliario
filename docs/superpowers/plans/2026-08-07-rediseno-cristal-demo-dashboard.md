# Rediseño cristalizado, modo demo y dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al CRM un aspecto de vidrio esmerilado sobre base oscura, un acceso demo de un clic para poder probar sin credenciales, y un dashboard de ganancias/pérdidas del mes alimentado por datos de ejemplo tras un contrato estable.

**Architecture:** Tres subsistemas independientes. T1.12 cambia tokens CSS (los componentes shadcn heredan el estilo, no se reescriben). T1.13 añade una Server Action lateral que reutiliza `registerTenant()` para que RLS siga aplicando. T1.14 aísla todo dato inventado en un módulo único detrás del tipo `MonthlyFinancials`, de modo que sustituirlo por datos reales en T2.1 sea un cambio de una sola capa.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4 (CSS-first), shadcn/ui `base-nova`, Supabase Auth, Drizzle ORM, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-07-rediseno-cristal-demo-dashboard-design.md`

## Global Constraints

- **Idioma:** código e identificadores en inglés; todo texto visible de UI en español (es-CO).
- **Moneda:** COP mediante `formatCOP` de `src/lib/format.ts`. Nunca formatear pesos a mano.
- **Regla $0:** prohibido introducir servicios de pago, crear cuentas o desplegar. La única dependencia nueva permitida por este plan es `recharts` (open source, vía `npx shadcn add chart`).
- **Multi-tenancy:** ninguna ruta de código puede evadir RLS. El usuario demo obtiene `tenant_id`/`role` en `app_metadata` como cualquier otro usuario.
- **TDD:** test primero para servicios y utilidades puras.
- **Commits:** convencionales, en inglés, sobre `main`. Push tras cada commit.
- **Verificación:** `npm run typecheck`, `npm run lint`, `npm test` deben quedar limpios al cerrar cada tarea. Reportar la salida real; no afirmar que pasan sin ejecutarlos.
- **No tocar:** el flujo real de auth (`login`, `registerTenant`, invitaciones) mantiene su comportamiento actual.

---

## File Structure

**T1.12 — Sistema visual**
- Modify: `src/app/globals.css` — tokens `.dark` de la paleta índigo/violeta/cian + utilidad `.glass`
- Modify: `src/app/layout.tsx:16-19` (metadatos) y `:27` (activar `dark`), montar el fondo
- Create: `src/components/layout/gradient-background.tsx` — blobs radiales fijos
- Modify: `src/app/(app)/app/nav.tsx` — aplicar `.glass` a la barra
- Modify: `src/components/ui/card.tsx`, `dialog.tsx`, `popover.tsx` — aplicar `.glass`

**T1.13 — Modo demo**
- Modify: `src/lib/env.ts` — añadir `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`, `NEXT_PUBLIC_DEMO_MODE`
- Create: `src/server/services/auth/demo-tenant.ts` — `ensureDemoTenant()`
- Modify: `src/app/(auth)/login/actions.ts` — `loginDemo()`
- Modify: `src/app/(auth)/login/page.tsx` — botón demo condicional
- Create: `tests/unit/demo-tenant.test.ts`
- Modify: `docs/despliegue.md` — advertencia de apagar la variable en producción

**T1.14 — Dashboard**
- Create: `src/server/services/dashboard/types.ts` — `MonthlyFinancials` (contrato estable)
- Create: `src/server/services/dashboard/mock-data.ts` — **única** fuente de cifras inventadas
- Create: `src/app/(app)/app/dashboard/page.tsx` — Server Component
- Create: `src/app/(app)/app/dashboard/_components/financial-cards.tsx` — client, refresco 5s
- Create: `src/app/(app)/app/dashboard/_components/financial-chart.tsx` — gráfico de línea
- Create: `tests/unit/dashboard-mock-data.test.ts`
- Modify: `src/app/(app)/app/nav.tsx` — enlace al dashboard

---

## Task 1: Fundación visual — tokens, fondo degradado y utilidad `.glass`

**Files:**
- Modify: `src/app/globals.css:86-118` (bloque `.dark`), añadir capa de utilidades al final
- Modify: `src/app/layout.tsx:16-19, 27-31`
- Create: `src/components/layout/gradient-background.tsx`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: la clase CSS `.glass` (usable con `className="glass"`), el componente
  `<GradientBackground />` (export default, sin props), y el tema oscuro activo en `<html>`.

- [ ] **Step 1: Repintar los tokens del tema oscuro**

En `src/app/globals.css`, reemplazar **íntegramente** el bloque `.dark` (líneas 86-118) por:

```css
.dark {
  --background: oklch(0.16 0.03 275);
  --foreground: oklch(0.97 0.01 275);
  --card: oklch(0.23 0.04 275 / 55%);
  --card-foreground: oklch(0.97 0.01 275);
  --popover: oklch(0.21 0.04 275 / 92%);
  --popover-foreground: oklch(0.97 0.01 275);
  --primary: oklch(0.72 0.17 292);
  --primary-foreground: oklch(0.16 0.03 275);
  --secondary: oklch(0.32 0.05 275 / 70%);
  --secondary-foreground: oklch(0.97 0.01 275);
  --muted: oklch(0.30 0.04 275 / 60%);
  --muted-foreground: oklch(0.78 0.03 275);
  --accent: oklch(0.36 0.07 285 / 70%);
  --accent-foreground: oklch(0.98 0.01 275);
  --destructive: oklch(0.70 0.19 22);
  --border: oklch(1 0 0 / 14%);
  --input: oklch(1 0 0 / 18%);
  --ring: oklch(0.72 0.17 292);
  --chart-1: oklch(0.72 0.17 292);
  --chart-2: oklch(0.75 0.15 200);
  --chart-3: oklch(0.70 0.16 155);
  --chart-4: oklch(0.78 0.16 85);
  --chart-5: oklch(0.70 0.19 22);
  --sidebar: oklch(0.20 0.04 275 / 70%);
  --sidebar-foreground: oklch(0.97 0.01 275);
  --sidebar-primary: oklch(0.72 0.17 292);
  --sidebar-primary-foreground: oklch(0.16 0.03 275);
  --sidebar-accent: oklch(0.36 0.07 285 / 70%);
  --sidebar-accent-foreground: oklch(0.98 0.01 275);
  --sidebar-border: oklch(1 0 0 / 14%);
  --sidebar-ring: oklch(0.72 0.17 292);
}
```

Nota: `--muted-foreground` es `0.78` (no el `0.708` original) a propósito — sobre el fondo
translúcido el valor anterior no alcanza contraste AA 4.5:1.

- [ ] **Step 2: Añadir la utilidad `.glass` y el respeto por las preferencias de accesibilidad**

Añadir al **final** de `src/app/globals.css`:

```css
@layer utilities {
  .glass {
    background-color: color-mix(in oklch, var(--card) 100%, transparent);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
    border: 1px solid var(--border);
    box-shadow:
      inset 0 1px 0 0 oklch(1 0 0 / 8%),
      0 8px 32px oklch(0 0 0 / 24%);
  }

  /* Sin transparencia: superficie sólida y legible. */
  @media (prefers-reduced-transparency: reduce) {
    .glass {
      background-color: oklch(0.23 0.04 275);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }
  }
}
```

- [ ] **Step 3: Crear el fondo de malla degradada**

Crear `src/components/layout/gradient-background.tsx`:

```tsx
/**
 * Fondo de malla degradada fijo para toda la app. Se monta una sola vez en el layout raíz y vive
 * detrás del contenido (`-z-10`), así que no participa del scroll ni se repinta por página.
 * `aria-hidden`: es decoración pura, no debe anunciarse a lectores de pantalla.
 */
export default function GradientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 -left-32 h-[38rem] w-[38rem] rounded-full bg-[oklch(0.55_0.20_292/35%)] blur-[120px]" />
      <div className="absolute top-1/3 -right-40 h-[34rem] w-[34rem] rounded-full bg-[oklch(0.60_0.16_200/30%)] blur-[120px]" />
      <div className="absolute -bottom-48 left-1/4 h-[32rem] w-[32rem] rounded-full bg-[oklch(0.50_0.18_320/28%)] blur-[130px]" />
    </div>
  );
}
```

- [ ] **Step 4: Activar el tema oscuro, montar el fondo y corregir los metadatos**

En `src/app/layout.tsx`: importar el componente, corregir `metadata` y añadir `dark` al `<html>`.

Reemplazar el bloque de metadatos (líneas 16-19):

```tsx
export const metadata: Metadata = {
  title: "CRM Inmobiliario",
  description: "CRM para inmobiliarias y agentes independientes en Colombia.",
};
```

Añadir el import junto a los existentes:

```tsx
import GradientBackground from "@/components/layout/gradient-background";
```

Reemplazar el cuerpo del return (líneas 26-33):

```tsx
  return (
    <html
      lang="es-CO"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GradientBackground />
        {children}
        <Toaster />
      </body>
    </html>
  );
```

Nota: `lang` pasa de `en` a `es-CO` — la UI está en español y el valor anterior era incorrecto
para lectores de pantalla.

- [ ] **Step 5: Verificar que compila y no hay regresiones**

```bash
npm run typecheck && npm run lint && npm test
```

Esperado: los tres limpios. `npm test` debe seguir en 185/185 (esta tarea no añade tests: es CSS
y un componente de presentación sin lógica).

- [ ] **Step 6: Revisar en el navegador**

```bash
npm run dev
```

Abrir `http://localhost:3000/login` y `http://localhost:3000/app`. Confirmar: fondo oscuro con
blobs de color, texto legible, foco visible al tabular. Detener el server con Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx src/components/layout/gradient-background.tsx
git commit -m "feat(ui): add dark glass theme tokens and gradient background (T1.12)"
git push origin main
```

---

## Task 2: Aplicar el vidrio a superficies y navegación

**Files:**
- Modify: `src/components/ui/card.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/popover.tsx`
- Modify: `src/app/(app)/app/nav.tsx`

**Interfaces:**
- Consumes: la clase `.glass` de Task 1.
- Produces: superficies de vidrio en toda la app. Ningún cambio de API de componentes.

- [ ] **Step 1: Aplicar `.glass` a Card**

En `src/components/ui/card.tsx`, localizar el `className` del componente `Card` (la lista de
clases que incluye `bg-card` y `rounded-xl`). Reemplazar la clase `bg-card` por `glass` y eliminar
la clase `shadow-sm` si está presente (`.glass` ya aporta su propia sombra). Conservar el resto
—`text-card-foreground`, `flex`, `flex-col`, `gap-*`, `rounded-xl`, `py-*`— sin cambios.

- [ ] **Step 2: Aplicar `.glass` a Dialog y Popover**

En `src/components/ui/dialog.tsx`, en el `className` de `DialogContent`, reemplazar `bg-background`
por `glass`.

En `src/components/ui/popover.tsx`, en el `className` de `PopoverContent`, reemplazar `bg-popover`
por `glass`.

En ambos casos conservar las clases de posicionamiento, animación (`data-[state=...]`), `z-*`,
`rounded-*` y `p-*` intactas.

- [ ] **Step 3: Aplicar el vidrio a la barra de navegación**

En `src/app/(app)/app/nav.tsx`, añadir `glass` al `className` del elemento contenedor `<nav>` (o
`<header>`), y añadir también `sticky top-0 z-40` si no los tiene, para que el efecto se aprecie al
hacer scroll. **No** aplicar `glass` a los enlaces individuales.

- [ ] **Step 4: Verificar**

```bash
npm run typecheck && npm run lint && npm test
```

Esperado: los tres limpios, 185/185.

- [ ] **Step 5: Revisar legibilidad en las tablas densas**

```bash
npm run dev
```

Abrir `http://localhost:3000/app/contactos` y `http://localhost:3000/app/propiedades`. Confirmar:
la tabla vive dentro de **un** contenedor de vidrio y **las filas no llevan blur propio**; el texto
de cada fila se lee sin esfuerzo. Abrir un diálogo de creación y confirmar que el formulario es
legible sobre el fondo. Detener con Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/card.tsx src/components/ui/dialog.tsx src/components/ui/popover.tsx "src/app/(app)/app/nav.tsx"
git commit -m "feat(ui): apply frosted glass surfaces to cards, dialogs and nav (T1.12)"
git push origin main
```

---

## Task 3: Variables de entorno del modo demo

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `tests/unit/env.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `parseEnv`, `parseClientEnv`, `getEnv` existentes.
- Produces: `Env` gana `DEMO_USER_EMAIL?: string`, `DEMO_USER_PASSWORD?: string`; `ClientEnv` gana
  `NEXT_PUBLIC_DEMO_MODE?: string`. Nueva función exportada `isDemoModeEnabled(raw): boolean`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `tests/unit/env.test.ts` (dentro del `describe` existente o en uno nuevo):

```ts
import { isDemoModeEnabled } from "@/lib/env";

describe("isDemoModeEnabled", () => {
  it("está habilitado solo con el valor exacto 'true'", () => {
    expect(isDemoModeEnabled({ NEXT_PUBLIC_DEMO_MODE: "true" })).toBe(true);
  });

  it("está deshabilitado cuando la variable falta", () => {
    expect(isDemoModeEnabled({})).toBe(false);
  });

  it("está deshabilitado con 'false' o cualquier otro valor", () => {
    expect(isDemoModeEnabled({ NEXT_PUBLIC_DEMO_MODE: "false" })).toBe(false);
    expect(isDemoModeEnabled({ NEXT_PUBLIC_DEMO_MODE: "1" })).toBe(false);
    expect(isDemoModeEnabled({ NEXT_PUBLIC_DEMO_MODE: "TRUE" })).toBe(false);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

```bash
npx vitest run tests/unit/env.test.ts
```

Esperado: FALLA con un error de importación — `isDemoModeEnabled` no existe todavía.

- [ ] **Step 3: Implementar**

En `src/lib/env.ts`, añadir los tres campos a los schemas. En `clientEnvSchema`:

```ts
  NEXT_PUBLIC_DEMO_MODE: z.string().optional(),
```

En `envSchema` (dentro del `.extend({...})`):

```ts
  /** Credenciales del usuario demo (T1.13). Solo se usan si NEXT_PUBLIC_DEMO_MODE === "true". */
  DEMO_USER_EMAIL: z.string().email().optional(),
  DEMO_USER_PASSWORD: z.string().min(8).optional(),
```

Y añadir al final del archivo:

```ts
/**
 * El modo demo abre un acceso de un clic sin credenciales, así que se exige el valor exacto
 * `"true"`: cualquier otro valor (incluido `"TRUE"` o `"1"`) lo deja apagado. Debe quedar
 * desactivado en producción — ver docs/despliegue.md.
 */
export function isDemoModeEnabled(raw: Record<string, string | undefined>): boolean {
  return raw.NEXT_PUBLIC_DEMO_MODE === "true";
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

```bash
npx vitest run tests/unit/env.test.ts
```

Esperado: PASA, incluidos los tests preexistentes del archivo.

- [ ] **Step 5: Documentar las variables**

Añadir a `.env.example`:

```bash
# Modo demo (T1.13) — botón "Entrar como demo" en el login.
# DEBE quedar sin definir (o en cualquier valor distinto de "true") en producción.
NEXT_PUBLIC_DEMO_MODE=true
DEMO_USER_EMAIL=demo@crm-inmobiliario.test
DEMO_USER_PASSWORD=demo-crm-2026
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/env.ts tests/unit/env.test.ts .env.example
git commit -m "feat(auth): add demo mode env flag and credentials (T1.13)"
git push origin main
```

---

## Task 4: Servicio del tenant demo

**Files:**
- Create: `src/server/services/auth/demo-tenant.ts`
- Create: `tests/unit/demo-tenant.test.ts`

**Interfaces:**
- Consumes: `registerTenant(input, deps)`, `RegisterTenantError` (código `email_taken`) de
  `src/server/services/auth/register-tenant.ts`; `getDb()` de `src/server/db/client.ts`; la tabla
  `tenants` de `src/server/db/schema`.
- Produces:
  ```ts
  export const DEMO_TENANT_SLUG = "demo-inmobiliaria";
  export type DemoCredentials = { email: string; password: string };
  export async function ensureDemoTenant(
    credentials: DemoCredentials,
    deps?: { db?: ReturnType<typeof getDb>; register?: typeof registerTenant },
  ): Promise<void>;
  ```

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unit/demo-tenant.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { ensureDemoTenant, DEMO_TENANT_SLUG } from "@/server/services/auth/demo-tenant";
import { RegisterTenantError } from "@/server/services/auth/register-tenant";

const credentials = { email: "demo@crm.test", password: "demo-crm-2026" };

/**
 * Simula el `db` de Drizzle solo en la cadena que usa ensureDemoTenant: select/from/where/limit.
 * El doble no necesita más superficie, así que se castea a `never` en vez de reconstruir el tipo
 * completo de Drizzle.
 */
function fakeDb(existingRows: { id: string }[]) {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => existingRows,
        }),
      }),
    }),
  } as never;
}

describe("ensureDemoTenant", () => {
  it("registra el tenant demo cuando todavía no existe", async () => {
    const register = vi.fn().mockResolvedValue({ tenantId: "t1", userId: "u1", slug: DEMO_TENANT_SLUG });

    await ensureDemoTenant(credentials, { db: fakeDb([]), register });

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({ email: credentials.email, password: credentials.password }),
    );
  });

  it("no vuelve a registrar si el tenant demo ya existe", async () => {
    const register = vi.fn();

    await ensureDemoTenant(credentials, { db: fakeDb([{ id: "t1" }]), register });

    expect(register).not.toHaveBeenCalled();
  });

  it("tolera una carrera: si el correo ya fue tomado, no propaga el error", async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new RegisterTenantError("Este correo ya está registrado.", "email_taken"));

    await expect(ensureDemoTenant(credentials, { db: fakeDb([]), register })).resolves.toBeUndefined();
  });

  it("propaga cualquier otro error de registro", async () => {
    const register = vi
      .fn()
      .mockRejectedValue(new RegisterTenantError("Falló la base de datos.", "unknown"));

    await expect(ensureDemoTenant(credentials, { db: fakeDb([]), register })).rejects.toThrow(
      "Falló la base de datos.",
    );
  });
});
```

Nota para el implementador: lo único que importa del doble es que responda a la cadena
`select().from().where().limit()`. Si ESLint objeta el `as never`, usa
`as unknown as ReturnType<typeof getDb>` importando `getDb` de `@/server/db/client`.

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

```bash
npx vitest run tests/unit/demo-tenant.test.ts
```

Esperado: FALLA — el módulo `demo-tenant` no existe.

- [ ] **Step 3: Implementar el servicio**

Crear `src/server/services/auth/demo-tenant.ts`:

```ts
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { tenants } from "@/server/db/schema";
import { RegisterTenantError, registerTenant } from "./register-tenant";

/** Slug fijo del tenant de demostración; es la clave por la que se detecta si ya fue creado. */
export const DEMO_TENANT_SLUG = "demo-inmobiliaria";

const DEMO_TENANT_NAME = "Inmobiliaria Demo";
const DEMO_USER_FULL_NAME = "Usuario Demo";

export type DemoCredentials = { email: string; password: string };

type EnsureDemoTenantDeps = {
  db?: ReturnType<typeof getDb>;
  register?: typeof registerTenant;
};

/**
 * Garantiza que exista el tenant de demostración con su usuario admin, creándolo la primera vez.
 * Reutiliza `registerTenant` a propósito: así el usuario demo recibe `tenant_id`/`role` en
 * `app_metadata` igual que cualquier otro, y las políticas RLS siguen aplicando sin excepción —
 * el tenant demo es simplemente un tenant más, no una ruta que evade el aislamiento.
 *
 * Idempotente: si el tenant ya existe no hace nada. Si dos peticiones corren a la vez y la otra
 * gana la carrera, `registerTenant` falla con `email_taken`, que aquí se trata como éxito.
 */
export async function ensureDemoTenant(
  credentials: DemoCredentials,
  deps: EnsureDemoTenantDeps = {},
): Promise<void> {
  const db = deps.db ?? getDb();
  const register = deps.register ?? registerTenant;

  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, DEMO_TENANT_SLUG))
    .limit(1);

  if (existing) {
    return;
  }

  try {
    await register({
      tenantName: DEMO_TENANT_NAME,
      fullName: DEMO_USER_FULL_NAME,
      email: credentials.email,
      password: credentials.password,
    });
  } catch (error) {
    if (error instanceof RegisterTenantError && error.code === "email_taken") {
      return;
    }
    throw error;
  }
}
```

Advertencia sobre el slug: `registerTenant` genera el slug con `buildSlug(tenantName)`. Para que
`"Inmobiliaria Demo"` produzca exactamente `"demo-inmobiliaria"` haría falta que coincidieran, y
**no coinciden**. En el Step 4 se verifica y corrige.

- [ ] **Step 4: Alinear el slug generado con el slug buscado**

Comprobar qué produce `buildSlug("Inmobiliaria Demo")`:

```bash
npx tsx -e "import {buildSlug} from './src/server/services/auth/helpers'; console.log(buildSlug('Inmobiliaria Demo'))"
```

Esperado: imprime `inmobiliaria-demo`. Como `DEMO_TENANT_SLUG` decía `demo-inmobiliaria`, la
detección de "ya existe" nunca acertaría y se intentaría registrar en cada clic. Corregir la
constante en `src/server/services/auth/demo-tenant.ts` para que coincida con la salida real:

```ts
export const DEMO_TENANT_SLUG = "inmobiliaria-demo";
```

Si la salida del comando difiere de `inmobiliaria-demo`, usar exactamente el valor impreso.

- [ ] **Step 5: Ejecutar los tests y verificar que pasan**

```bash
npx vitest run tests/unit/demo-tenant.test.ts
```

Esperado: PASA, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/auth/demo-tenant.ts tests/unit/demo-tenant.test.ts
git commit -m "feat(auth): add idempotent demo tenant provisioning service (T1.13)"
git push origin main
```

---

## Task 5: Server Action y botón de acceso demo

**Files:**
- Modify: `src/app/(auth)/login/actions.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `docs/despliegue.md`

**Interfaces:**
- Consumes: `ensureDemoTenant`, `DemoCredentials` (Task 4); `isDemoModeEnabled`, `getEnv`
  (Task 3); `createClient` de `@/lib/supabase/server`; el tipo `LoginState` ya exportado por
  `actions.ts`.
- Produces: `loginDemo(prevState: LoginState, formData: FormData): Promise<LoginState>` — misma
  firma que `login`, para poder usarse con `useActionState`.

- [ ] **Step 1: Implementar la Server Action**

Añadir al final de `src/app/(auth)/login/actions.ts` (conservando `login` intacta):

```ts
import { getEnv, isDemoModeEnabled } from "@/lib/env";
import { ensureDemoTenant } from "@/server/services/auth/demo-tenant";

/**
 * Acceso de un clic al tenant de demostración. Puerta lateral para poder probar la app sin
 * credenciales: NO sustituye ni modifica el login real. Solo funciona con
 * `NEXT_PUBLIC_DEMO_MODE === "true"`; en cualquier otro caso devuelve error, de modo que el atajo
 * no quede expuesto si la variable no se define al desplegar.
 */
export async function loginDemo(
  _prevState: LoginState,
  _formData: FormData,
): Promise<LoginState> {
  if (!isDemoModeEnabled(process.env)) {
    return { error: "El modo demo no está habilitado." };
  }

  const env = getEnv();
  if (!env.DEMO_USER_EMAIL || !env.DEMO_USER_PASSWORD) {
    return { error: "Faltan las credenciales del usuario demo." };
  }

  const credentials = { email: env.DEMO_USER_EMAIL, password: env.DEMO_USER_PASSWORD };

  try {
    await ensureDemoTenant(credentials);
  } catch (error) {
    console.error("No se pudo preparar el tenant demo:", error);
    return { error: "No se pudo preparar la cuenta de demostración." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);

  if (error) {
    return { error: "No se pudo iniciar sesión en la cuenta de demostración." };
  }

  redirect("/app");
}
```

Importante: `redirect()` lanza una excepción interna de Next.js por diseño. Como está **fuera** del
`try/catch`, no queda atrapada — si se moviera dentro, la redirección se rompería.

- [ ] **Step 2: Añadir el botón al login**

En `src/app/(auth)/login/page.tsx`:

1. Cambiar el import de acciones a: `import { login, loginDemo, type LoginState } from "./actions";`
2. Añadir, junto al `useActionState` existente:

```tsx
  const [demoState, demoAction, demoPending] = useActionState(loginDemo, initialState);
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
```

3. Cambiar la condición del `Alert` de error para que muestre también el error del demo:

```tsx
            {(state.error || demoState.error) && (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{state.error ?? demoState.error}</AlertTitle>
              </Alert>
            )}
```

4. Insertar el bloque demo **después** del `</form>` que cierra el formulario real y antes de
   `</Card>` — un formulario separado, para no interferir con el submit del login real:

```tsx
        {demoEnabled && (
          <form action={demoAction} className="border-t px-6 pt-4 pb-6">
            <Button
              type="submit"
              variant="secondary"
              className="w-full"
              disabled={demoPending}
            >
              {demoPending ? "Entrando…" : "Entrar como demo"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Acceso de prueba con datos de ejemplo, sin credenciales.
            </p>
          </form>
        )}
```

Nota: `process.env.NEXT_PUBLIC_DEMO_MODE` se lee en un componente cliente. Next.js sustituye las
variables `NEXT_PUBLIC_*` en tiempo de build, así que esto funciona en el navegador — pero exige
**reiniciar `npm run dev`** tras cambiar el `.env` para que el nuevo valor se incruste.

- [ ] **Step 3: Verificar**

```bash
npm run typecheck && npm run lint && npm test
```

Esperado: los tres limpios.

- [ ] **Step 4: Probar el flujo completo en el navegador**

Confirmar que `.env` (no solo `.env.example`) tiene las tres variables del Task 3, Step 5. Luego:

```bash
npm run dev
```

En `http://localhost:3000/login`: pulsar "Entrar como demo" → debe entrar a `/app` mostrando
"Inmobiliaria Demo". Cerrar sesión y repetir el clic: debe volver a entrar **sin** crear un tenant
duplicado (la idempotencia de Task 4). Detener con Ctrl+C.

- [ ] **Step 5: Verificar el interruptor de seguridad**

Poner `NEXT_PUBLIC_DEMO_MODE=false` en `.env`, reiniciar `npm run dev` y recargar `/login`.
Esperado: el botón demo **no aparece**. Restaurar el valor a `true` y reiniciar.

- [ ] **Step 6: Documentar la advertencia de despliegue**

Añadir a `docs/despliegue.md`, en la sección de variables de entorno:

```markdown
### ⚠️ Modo demo — apagar en producción

`NEXT_PUBLIC_DEMO_MODE` habilita un botón que entra al tenant de demostración **sin credenciales**.
Es una herramienta de prueba: cualquiera con acceso a la URL podría usarlo. Al desplegar, dejar la
variable **sin definir** en Vercel (o en cualquier valor distinto de `"true"`), y no configurar
`DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`.
```

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/login/actions.ts" "src/app/(auth)/login/page.tsx" docs/despliegue.md
git commit -m "feat(auth): add one-click demo login behind NEXT_PUBLIC_DEMO_MODE (T1.13)"
git push origin main
```

---

## Task 6: Contrato de datos y generador mock del dashboard

**Files:**
- Create: `src/server/services/dashboard/types.ts`
- Create: `src/server/services/dashboard/mock-data.ts`
- Create: `tests/unit/dashboard-mock-data.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  // types.ts
  export type DailyFinancials = { date: string; gains: number; losses: number };
  export type MonthlyFinancials = {
    netGains: number;
    netLosses: number;
    net: number;
    currency: "COP";
    series: DailyFinancials[];
  };
  // mock-data.ts
  export function getMockMonthlyFinancials(seed?: number): MonthlyFinancials;
  export const IS_MOCK_DATA = true;
  ```

- [ ] **Step 1: Escribir los tests que fallan**

Crear `tests/unit/dashboard-mock-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getMockMonthlyFinancials } from "@/server/services/dashboard/mock-data";

describe("getMockMonthlyFinancials", () => {
  it("devuelve una serie de 30 días", () => {
    expect(getMockMonthlyFinancials(1).series).toHaveLength(30);
  });

  it("mantiene net = netGains - netLosses", () => {
    const data = getMockMonthlyFinancials(7);
    expect(data.net).toBe(data.netGains - data.netLosses);
  });

  it("los totales coinciden con la suma de la serie", () => {
    const data = getMockMonthlyFinancials(3);
    const gains = data.series.reduce((sum, day) => sum + day.gains, 0);
    const losses = data.series.reduce((sum, day) => sum + day.losses, 0);
    expect(data.netGains).toBe(gains);
    expect(data.netLosses).toBe(losses);
  });

  it("es determinista: la misma semilla da el mismo resultado", () => {
    expect(getMockMonthlyFinancials(42)).toEqual(getMockMonthlyFinancials(42));
  });

  it("semillas distintas dan resultados distintos", () => {
    expect(getMockMonthlyFinancials(1).net).not.toBe(getMockMonthlyFinancials(2).net);
  });

  it("usa COP y valores enteros no negativos", () => {
    const data = getMockMonthlyFinancials(5);
    expect(data.currency).toBe("COP");
    for (const day of data.series) {
      expect(Number.isInteger(day.gains)).toBe(true);
      expect(Number.isInteger(day.losses)).toBe(true);
      expect(day.gains).toBeGreaterThanOrEqual(0);
      expect(day.losses).toBeGreaterThanOrEqual(0);
    }
  });

  it("fecha en formato YYYY-MM-DD y días en orden ascendente", () => {
    const dates = getMockMonthlyFinancials(9).series.map((day) => day.date);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    expect([...dates].sort()).toEqual(dates);
  });
});
```

- [ ] **Step 2: Ejecutar los tests y verificar que fallan**

```bash
npx vitest run tests/unit/dashboard-mock-data.test.ts
```

Esperado: FALLA — el módulo `mock-data` no existe.

- [ ] **Step 3: Definir el contrato**

Crear `src/server/services/dashboard/types.ts`:

```ts
/** Cifras de un día concreto. `date` en formato ISO corto (`YYYY-MM-DD`). */
export type DailyFinancials = {
  date: string;
  gains: number;
  losses: number;
};

/**
 * Resumen financiero del mes que consume el dashboard. **Este es el contrato estable**: hoy lo
 * llena un generador de datos de ejemplo (`mock-data.ts`) porque las tablas `deals`/`payments`
 * todavía no existen. Cuando lleguen (T2.1), el servicio real debe implementar exactamente este
 * tipo y la UI no cambiará.
 *
 * Todos los montos son pesos colombianos enteros; formatearlos siempre con `formatCOP`.
 */
export type MonthlyFinancials = {
  netGains: number;
  netLosses: number;
  /** Invariante: siempre `netGains - netLosses`. Puede ser negativo. */
  net: number;
  currency: "COP";
  series: DailyFinancials[];
};
```

- [ ] **Step 4: Implementar el generador**

Crear `src/server/services/dashboard/mock-data.ts`:

```ts
import type { DailyFinancials, MonthlyFinancials } from "./types";

/**
 * ⚠️ DATOS DE EJEMPLO — NO SON CIFRAS REALES DEL NEGOCIO.
 *
 * Este archivo es la ÚNICA fuente de cifras inventadas del dashboard. Existe porque las tablas
 * `deals` y `payments` aún no están construidas (T2.1 y F3 siguen pendientes).
 *
 * Para conectar datos reales: implementar una función con la misma firma que
 * `getMockMonthlyFinancials` que consulte la base filtrando por `tenant_id`, y sustituir la
 * importación en `src/app/(app)/app/dashboard/page.tsx`. La UI no necesita cambios.
 */
export const IS_MOCK_DATA = true;

const DAYS = 30;
const BASE_GAINS = 12_000_000;
const BASE_LOSSES = 4_500_000;

/**
 * PRNG determinista (mulberry32). Se usa en vez de `Math.random()` para que la misma semilla
 * produzca siempre las mismas cifras: así el refresco "en vivo" del dashboard varía de forma
 * predecible en lugar de saltar a valores absurdos en cada tick.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fecha `YYYY-MM-DD` de hace `daysAgo` días, en hora local. */
function isoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Genera el resumen financiero de ejemplo de los últimos 30 días. `seed` controla la variación:
 * el dashboard la incrementa en cada refresco para simular movimiento en vivo.
 */
export function getMockMonthlyFinancials(seed = 1): MonthlyFinancials {
  const random = createRandom(seed);
  const series: DailyFinancials[] = [];

  for (let index = DAYS - 1; index >= 0; index -= 1) {
    series.push({
      date: isoDate(index),
      gains: Math.round((BASE_GAINS * (0.55 + random() * 0.9)) / DAYS),
      losses: Math.round((BASE_LOSSES * (0.4 + random() * 1.2)) / DAYS),
    });
  }

  const netGains = series.reduce((sum, day) => sum + day.gains, 0);
  const netLosses = series.reduce((sum, day) => sum + day.losses, 0);

  return { netGains, netLosses, net: netGains - netLosses, currency: "COP", series };
}
```

- [ ] **Step 5: Ejecutar los tests y verificar que pasan**

```bash
npx vitest run tests/unit/dashboard-mock-data.test.ts
```

Esperado: PASA, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/server/services/dashboard/ tests/unit/dashboard-mock-data.test.ts
git commit -m "feat(dashboard): add MonthlyFinancials contract and deterministic mock generator (T1.14)"
git push origin main
```

---

## Task 7: Página del dashboard con tarjetas en vivo y gráfico

**Files:**
- Create: `src/app/(app)/app/dashboard/page.tsx`
- Create: `src/app/(app)/app/dashboard/_components/financial-cards.tsx`
- Create: `src/app/(app)/app/dashboard/_components/financial-chart.tsx`
- Modify: `src/app/(app)/app/nav.tsx`

**Interfaces:**
- Consumes: `getMockMonthlyFinancials`, `MonthlyFinancials`, `DailyFinancials` (Task 6);
  `formatCOP` de `@/lib/format`; `requireUser` de `@/lib/supabase/require-user`; la clase `.glass`
  (Task 1); `Card`/`CardHeader`/`CardTitle`/`CardContent` y `Badge` de `@/components/ui/*`.
- Produces: la ruta `/app/dashboard`.

- [ ] **Step 1: Instalar el componente de gráficos**

```bash
npx shadcn@latest add chart
```

Esperado: crea `src/components/ui/chart.tsx` y añade `recharts` a `package.json`. Es la única
dependencia nueva del plan; es open source y no afecta la regla $0.

- [ ] **Step 2: Crear las tarjetas con refresco en vivo**

Crear `src/app/(app)/app/dashboard/_components/financial-cards.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";
import { getMockMonthlyFinancials } from "@/server/services/dashboard/mock-data";
import type { MonthlyFinancials } from "@/server/services/dashboard/types";

const REFRESH_MS = 5000;

/**
 * Tarjetas de ganancias/pérdidas con refresco "en vivo". Al ser datos de ejemplo, el movimiento se
 * simula en el cliente incrementando la semilla del generador determinista: no hay polling al
 * servidor ni websockets, que serían infraestructura desperdiciada sobre cifras inventadas (y
 * habría que desmontarla al llegar los datos reales de T2.1).
 */
export default function FinancialCards({ initialData }: { initialData: MonthlyFinancials }) {
  const [data, setData] = useState(initialData);
  const [seed, setSeed] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeed((previous) => {
        const next = previous + 1;
        setData(getMockMonthlyFinancials(next));
        return next;
      });
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const isPositive = data.net >= 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ganancias netas del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-[var(--chart-3)]">{formatCOP(data.netGains)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Pérdidas netas del mes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold text-[var(--chart-5)]">{formatCOP(data.netLosses)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Neto del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-3xl font-semibold ${
              isPositive ? "text-[var(--chart-3)]" : "text-[var(--chart-5)]"
            }`}
          >
            {formatCOP(data.net)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Crear el gráfico**

Crear `src/app/(app)/app/dashboard/_components/financial-chart.tsx`:

```tsx
"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { DailyFinancials } from "@/server/services/dashboard/types";

const chartConfig = {
  gains: { label: "Ganancias", color: "var(--chart-3)" },
  losses: { label: "Pérdidas", color: "var(--chart-5)" },
};

/** Evolución diaria de los últimos 30 días. Eje Y en millones para no saturar de ceros. */
export default function FinancialChart({ series }: { series: DailyFinancials[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución de los últimos 30 días</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart data={series} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => value.slice(8)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(value: number) => `${Math.round(value / 1_000_000)}M`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="gains"
              type="monotone"
              stroke="var(--color-gains)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="losses"
              type="monotone"
              stroke="var(--color-losses)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Crear la página**

Crear `src/app/(app)/app/dashboard/page.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/supabase/require-user";
import { getMockMonthlyFinancials } from "@/server/services/dashboard/mock-data";
import FinancialCards from "./_components/financial-cards";
import FinancialChart from "./_components/financial-chart";

export default async function DashboardPage() {
  await requireUser();
  const data = getMockMonthlyFinancials(1);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Badge variant="secondary">Datos de demostración</Badge>
      </header>
      <p className="text-sm text-muted-foreground">
        Las cifras de esta página son de ejemplo y no reflejan negocios reales. Se conectarán a
        datos reales cuando exista el módulo de negocios.
      </p>
      <FinancialCards initialData={data} />
      <FinancialChart series={data.series} />
    </main>
  );
}
```

Nota: `requireUser()` protege la ruta igual que el resto de páginas de `(app)`. Si su firma real
difiere (por ejemplo, si devuelve un objeto que aquí no se usa), basta con invocarla; no hace falta
desestructurar nada.

- [ ] **Step 5: Enlazar desde la navegación**

En `src/app/(app)/app/nav.tsx`, añadir una entrada al array/lista de enlaces existente, como
**primer** elemento, siguiendo exactamente el formato que ya usan los demás (`href` + etiqueta):
`href: "/app/dashboard"`, etiqueta `"Dashboard"`.

- [ ] **Step 6: Verificar**

```bash
npm run typecheck && npm run lint && npm test
```

Esperado: los tres limpios.

- [ ] **Step 7: Revisar en el navegador**

```bash
npm run dev
```

Entrar con el botón demo y abrir `http://localhost:3000/app/dashboard`. Confirmar:
- Las tres tarjetas muestran montos en formato `$ 12.345.678`.
- El badge "Datos de demostración" es visible.
- Las cifras cambian cada 5 segundos sin saltos absurdos.
- El gráfico dibuja dos líneas (ganancias en verde, pérdidas en rojo).

Detener con Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(app)/app/dashboard/" "src/app/(app)/app/nav.tsx" src/components/ui/chart.tsx package.json package-lock.json
git commit -m "feat(dashboard): add live monthly financials dashboard on mock data (T1.14)"
git push origin main
```

---

## Task 8: Verificación final y actualización del estado

**Files:**
- Modify: `docs/estado.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: documentación del estado actualizada.

- [ ] **Step 1: Ejecutar la suite completa**

```bash
npm run typecheck && npm run lint && npm test
```

Esperado: los tres limpios. `npm test` debe reportar los 185 tests previos más los nuevos
(3 de env + 4 de demo-tenant + 7 de dashboard ≈ 199). Registrar el número real.

- [ ] **Step 2: Verificar que el build de producción pasa**

```bash
npm run build
```

Esperado: build exitoso, con `/app/dashboard` entre las rutas listadas (antes eran 13).

- [ ] **Step 3: Ejecutar los E2E existentes para descartar regresiones**

```bash
npm run test:e2e
```

Esperado: verdes. Si fallan **todos** los tests de registro a la vez, revisar
`docs/estado.md` § "Notas de operación": suele ser Supabase pausado o el pool agotado, no una
regresión del código. Diagnosticar con `npm run db:ping` antes de tocar nada.

- [ ] **Step 4: Actualizar el estado del proyecto**

En `docs/estado.md`, dentro de la sección de Fase 1, añadir tras la entrada de T1.8:

```markdown
### Tarea T1.12 — Sistema visual cristalizado

- [hecho] — Tema oscuro por defecto con paleta índigo/violeta/cian en los tokens `.dark` de
  `globals.css`, utilidad `.glass` (blur + borde translúcido + sombra interior) aplicada a `Card`,
  `Dialog`, `Popover` y la barra de navegación, y fondo de malla degradada fijo
  (`gradient-background.tsx`). Rediseño por tokens: los 17 componentes shadcn heredan el estilo sin
  reescribirse. Las tablas densas llevan vidrio solo en el contenedor, nunca por fila. Degrada a
  superficie sólida bajo `prefers-reduced-transparency`. De paso se corrigieron el `title` por
  defecto de `create-next-app` y el `lang="en"` del `<html>` (la UI es es-CO).

### Tarea T1.13 — Modo demo

- [hecho] — Botón "Entrar como demo" en el login que entra al tenant de demostración sin
  credenciales. `ensureDemoTenant()` es idempotente y **reutiliza `registerTenant()`**, de modo que
  el usuario demo recibe `tenant_id`/`role` en `app_metadata` como cualquier otro y **RLS sigue
  aplicando**: el tenant demo es un tenant más, no una ruta que evade el aislamiento. El flujo de
  auth real (login, registro, invitaciones) quedó intacto.
- ⚠️ **`NEXT_PUBLIC_DEMO_MODE` debe quedar apagada en producción** — con ella activa cualquiera
  entra con un clic. Ver `docs/despliegue.md`.

### Tarea T1.14 — Dashboard financiero (datos de ejemplo)

- [hecho] — `/app/dashboard` con tres tarjetas (ganancias netas, pérdidas netas, neto del mes) en
  COP y gráfico de línea de 30 días. Refresco cada 5 s en el cliente sobre un PRNG determinista
  (sin polling al servidor: sería infraestructura desperdiciada sobre datos falsos).
- ⚠️ **Las cifras son inventadas.** Toda cifra sale de
  `src/server/services/dashboard/mock-data.ts`, la única frontera de datos falsos, detrás del
  contrato estable `MonthlyFinancials`. Para conectar datos reales tras T2.1: implementar ese mismo
  tipo consultando `deals` con filtro por `tenant_id` y cambiar la importación en `page.tsx`; la UI
  no cambia. El badge "Datos de demostración" es visible en pantalla.
```

- [ ] **Step 5: Commit final**

```bash
git add docs/estado.md
git commit -m "docs: record T1.12-T1.14 completion and demo mode caveat"
git push origin main
```

- [ ] **Step 6: Dejar el servidor local corriendo para revisión del usuario**

```bash
npm run dev
```

Informar al usuario: `http://localhost:3000/login` → botón "Entrar como demo" → `/app/dashboard`.
Reportar la salida real de typecheck/lint/test/build de los pasos anteriores, sin afirmar que algo
pasa sin haberlo ejecutado.

---

## Notas para quien implemente

- **Si `npm run dev` devuelve 500 con `Jest worker encountered 2 child process exceptions`:** es el
  worker de Turbopack corrupto tras errores de BD, no un bug de producto. Reiniciar el dev server
  antes de investigar el código (`docs/estado.md` § Notas de operación).
- **Si fallan de golpe todos los tests que tocan la BD:** Supabase se pausa por inactividad y el
  pool tiene 15 conexiones. `npm run db:ping` distingue el entorno de una regresión.
- **Los componentes shadcn de `src/components/ui/` son código del proyecto**, no dependencias:
  editarlos (Task 2) es la forma prevista de personalizarlos.
