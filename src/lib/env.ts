import { z } from "zod";

/**
 * Literal placeholder used for `DATABASE_URL` until the Supabase Postgres database password is
 * available (see docs/estado.md, T0.2). While present, direct Postgres connections must not be
 * attempted.
 */
export const DATABASE_URL_PENDING_PLACEHOLDER = "[DB_PASSWORD_PENDIENTE]";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const envSchema = clientEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export type Env = z.infer<typeof envSchema> & {
  /** False while `DATABASE_URL` is missing or still holds the pending-password placeholder. */
  databaseUrlReady: boolean;
};

/**
 * Validates only the browser-safe (`NEXT_PUBLIC_*`) variables. Pure function, safe to call from
 * client code: it never requires server-only variables like `SUPABASE_SERVICE_ROLE_KEY`, which
 * Next.js never exposes to the browser bundle.
 */
export function parseClientEnv(raw: Record<string, string | undefined>): ClientEnv {
  return clientEnvSchema.parse(raw);
}

/**
 * Validates the raw process environment against the variables this app requires. Server-only:
 * requires `SUPABASE_SERVICE_ROLE_KEY`, so it must not be called from code that runs in the
 * browser (use `parseClientEnv` there). Pure function: takes a record of raw values (typically
 * `process.env`) and either returns a parsed, typed environment or throws a Zod error describing
 * what is missing/invalid.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const parsed = envSchema.parse(raw);
  const databaseUrlReady =
    parsed.DATABASE_URL !== undefined &&
    !parsed.DATABASE_URL.includes(DATABASE_URL_PENDING_PLACEHOLDER);

  return { ...parsed, databaseUrlReady };
}

let cachedEnv: Env | undefined;

/** Parses `process.env` once and memoizes the result for the lifetime of the process. */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = parseEnv(process.env);
  }
  return cachedEnv;
}
