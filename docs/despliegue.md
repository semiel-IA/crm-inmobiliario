# Despliegue a Vercel (plan Hobby, $0)

Estado: preparado el 2026-07-26, **sin desplegar todavía** — falta que el usuario cree la cuenta de
Vercel y conecte el repo. La regla $0 del plan exige aprobación explícita antes de registrar
cuentas o desplegar.

El repo ya compila en producción (`npm run build`, 13 rutas) y no versiona ningún secreto
(`.gitignore` cubre `.env*` salvo `.env.example`).

---

## 1. Importar el repo en Vercel

1. Entrar a vercel.com y crear la cuenta (plan **Hobby**, gratis) con la misma cuenta de GitHub
   dueña de `semiel-IA/crm-inmobiliario`.
2. **Add New → Project → Import** ese repositorio.
3. Framework: Vercel detecta Next.js solo. No hay que tocar build command ni output directory, y
   **no hace falta `vercel.json`** — la configuración por defecto sirve.
4. **No desplegar todavía**: primero cargar las variables del paso 2, o el primer build fallará al
   validar el entorno (`src/lib/env.ts` valida con Zod al arrancar).

---

## 2. Variables de entorno

En **Project Settings → Environment Variables**, para los tres entornos (Production, Preview,
Development). Los valores salen del dashboard de Supabase; son los mismos del `.env` local salvo
`DATABASE_URL` y `APP_URL`.

| Variable | Dónde sacarla | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Keys → `anon` / publishable | pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Keys → `service_role` / secret | 🔒 **secreta**, bypassa RLS |
| `DATABASE_URL` | ver abajo — **no** la misma que en local | 🔒 secreta |
| `APP_URL` | la URL que asigne Vercel, ej. `https://crm-inmobiliario.vercel.app` | sin barra final |

### ⚠️ Modo demo — NO configurar en producción

`NEXT_PUBLIC_DEMO_MODE` habilita el botón "Entrar como demo" del login, que entra al tenant de
demostración **sin pedir credenciales**. Es una herramienta de prueba: cualquiera que llegue a la
URL podría usarlo.

Al desplegar, dejar `NEXT_PUBLIC_DEMO_MODE` **sin definir** (o en cualquier valor distinto de
`"true"`) y **no** configurar `DEMO_USER_EMAIL` ni `DEMO_USER_PASSWORD`. Sin la variable, el botón
no se renderiza y la Server Action `loginDemo` rechaza cualquier intento.

### ⚠️ `DATABASE_URL` debe usar el *transaction pooler*

La cadena de conexión directa (`db.<ref>.supabase.co:5432`) **no sirve en Vercel**: los proyectos
nuevos de Supabase solo la exponen por IPv6 y las funciones serverless de Vercel son IPv4.

Usar la del **transaction pooler**, puerto **6543** (Supabase → Project Settings → Database →
Connection string → *Transaction pooler*):

```
postgresql://postgres.<ref>:<password>@aws-1-sa-east-1.pooler.supabase.com:6543/postgres
```

Ojo con dos detalles:
- El usuario lleva el ref pegado: `postgres.<ref>`, no `postgres` a secas.
- URL-encodear la contraseña si tiene caracteres especiales (`#` → `%23`).

`src/server/db/client.ts` ya está configurado para este modo (`max: 1`, `prepare: false`): el
pooler multiplexa conexiones y no admite sentencias preparadas, y el plan gratuito de Supabase
solo permite 15 conexiones simultáneas en total.

---

## 3. Configurar Supabase Auth para el dominio nuevo

En **Supabase → Authentication → URL Configuration**:

- **Site URL**: la URL de Vercel.
- **Redirect URLs**: añadir `https://<tu-dominio>.vercel.app/**`.

Sin esto, el registro y la aceptación de invitaciones redirigen mal.

---

## 4. Desplegar y verificar

Tras el primer deploy, comprobar a mano:

1. `/registro` — crear una inmobiliaria nueva y aterrizar en `/app`.
2. `/app/contactos` — el listado carga (prueba que `DATABASE_URL` y el pooler funcionan).
3. `/app/propiedades` — crear una propiedad con el wizard de 4 pasos.
4. Invitar a alguien desde `/app/equipo` y revisar que el enlace del correo apunte al dominio de
   Vercel y no a `localhost` (eso valida `APP_URL`).

---

## Qué NO está listo para producción todavía

- **Módulos vacíos:** "Negocios" y "Agenda" muestran "Próximamente" (T2.1–T2.3 y F2 pendientes).
- **Sin fotos de propiedades:** T1.9 no está hecho; la galería de la ficha sale vacía.
- **Sin ficha pública:** T1.10 pendiente, así que el botón "Compartir" aún no lleva a una página
  visible sin sesión.
- **Base de datos compartida con desarrollo:** hay tenants de prueba (`Probe Inmo`, `Diag Props`,
  `E2E Props`, `Seed smoke test`) conviviendo con los datos reales. Antes de enseñárselo a un
  cliente conviene limpiarlos o crear un proyecto Supabase aparte para producción.
- **Correo de Supabase con límites bajos:** el servicio de correo por defecto tiene un tope de
  envíos por hora; para uso real hay que conectar un SMTP propio.
