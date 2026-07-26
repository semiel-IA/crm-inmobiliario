import { and, asc, eq } from "drizzle-orm";
import {
  createLeadPreferenceSchema,
  getLeadPreferenceRangeIssues,
  updateLeadPreferenceSchema,
  type LeadPreferenceOperationType,
} from "@/lib/validations/lead-preferences";
import { getDb } from "@/server/db/client";
import { contacts, leadPreferences, type LeadPreference } from "@/server/db/schema";
import type { PropertyType } from "@/lib/validations/properties";

/**
 * Business-logic layer for `lead_preferences` (T1.4). Follows the same pattern as
 * `src/server/services/contacts.ts` (T1.2): pure w.r.t. its injectable `deps.db`, defaults to
 * the real `getDb()`.
 *
 * `db` runs with service-role/`postgres` privileges that bypass RLS, so every query below is
 * explicitly scoped by `tenant_id` as defense-in-depth (plan §2.2), and `createPreference` /
 * `updatePreference` verify the target contact belongs to the tenant before writing — mirroring
 * how `createProperty` verifies the owner in `src/server/services/properties.ts`.
 */

export type LeadPreferenceErrorCode = "validation" | "contact_not_found" | "not_found";

/** Typed business error for the lead-preferences service; `code` drives the es-CO message shown
 * by the Server Action layer. */
export class LeadPreferenceError extends Error {
  readonly code: LeadPreferenceErrorCode;
  /** Every violated-field message, when the error comes from a multi-issue Zod/business check. */
  readonly issues?: string[];

  constructor(message: string, code: LeadPreferenceErrorCode, issues?: string[]) {
    super(message);
    this.name = "LeadPreferenceError";
    this.code = code;
    this.issues = issues;
  }
}

type LeadPreferencesDeps = {
  db?: ReturnType<typeof getDb>;
};

async function findContactInTenant(
  db: ReturnType<typeof getDb>,
  contactId: string,
  tenantId: string,
): Promise<boolean> {
  const [contact] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), eq(contacts.tenantId, tenantId)))
    .limit(1);
  return Boolean(contact);
}

export type CreatePreferenceInput = {
  contactId: string;
  tenantId: string;
  /** `auth.users.id` of whoever is creating this row; omitted for server-side/seed inserts. */
  actorUserId?: string;
  operationType: LeadPreferenceOperationType;
  propertyTypes?: PropertyType[];
  zones?: string[];
  budgetMinCop?: number;
  budgetMaxCop?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minParkingSpots?: number;
  minStratum?: number;
  maxStratum?: number;
};

/** Creates a lead-preference row. Validates with `createLeadPreferenceSchema` (defense-in-depth:
 * the Server Action layer validates too, but this service must never trust a caller that skips
 * it) and verifies `contactId` belongs to `tenantId` before writing. */
export async function createPreference(
  input: CreatePreferenceInput,
  deps: LeadPreferencesDeps = {},
): Promise<LeadPreference> {
  const db = deps.db ?? getDb();

  const parsed = createLeadPreferenceSchema.safeParse(input);
  if (!parsed.success) {
    throw new LeadPreferenceError(
      parsed.error.issues[0]?.message ?? "Datos de preferencias inválidos.",
      "validation",
      parsed.error.issues.map((issue) => issue.message),
    );
  }

  const contactExists = await findContactInTenant(db, input.contactId, input.tenantId);
  if (!contactExists) {
    throw new LeadPreferenceError(
      "El contacto seleccionado no existe en esta inmobiliaria.",
      "contact_not_found",
    );
  }

  const [created] = await db
    .insert(leadPreferences)
    .values({
      tenantId: input.tenantId,
      contactId: input.contactId,
      operationType: parsed.data.operationType,
      propertyTypes: parsed.data.propertyTypes ?? [],
      zones: parsed.data.zones ?? [],
      budgetMinCop: parsed.data.budgetMinCop,
      budgetMaxCop: parsed.data.budgetMaxCop,
      minBedrooms: parsed.data.minBedrooms,
      minBathrooms: parsed.data.minBathrooms,
      minParkingSpots: parsed.data.minParkingSpots,
      minStratum: parsed.data.minStratum,
      maxStratum: parsed.data.maxStratum,
      createdBy: input.actorUserId,
    })
    .returning();

  if (!created) {
    throw new LeadPreferenceError("No se pudieron crear las preferencias.", "validation");
  }
  return created;
}

export type UpdatePreferenceInput = {
  id: string;
  tenantId: string;
  operationType?: LeadPreferenceOperationType;
  propertyTypes?: PropertyType[];
  zones?: string[];
  budgetMinCop?: number;
  budgetMaxCop?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minParkingSpots?: number;
  minStratum?: number;
  maxStratum?: number;
};

/** Strips `undefined`-valued keys so a partial update never overwrites an untouched column with
 * `NULL` just because the caller happened to pass the key with an `undefined` value (same helper
 * as `src/server/services/contacts.ts`). */
function withoutUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Updates a lead-preference row's provided fields (partial) and bumps `updatedAt`. Re-checks the
 * budget-range/stratum-range rule against the MERGED state (new fields over the existing row —
 * Zod alone can't see DB state), mirroring `updateProperty`. Throws `not_found` when no row
 * matches `id` + `tenantId`. */
export async function updatePreference(
  input: UpdatePreferenceInput,
  deps: LeadPreferencesDeps = {},
): Promise<LeadPreference> {
  const db = deps.db ?? getDb();
  const { id, tenantId, ...rest } = input;

  const parsed = updateLeadPreferenceSchema.safeParse(rest);
  if (!parsed.success) {
    throw new LeadPreferenceError(
      parsed.error.issues[0]?.message ?? "Datos de preferencias inválidos.",
      "validation",
      parsed.error.issues.map((issue) => issue.message),
    );
  }

  const [existing] = await db
    .select()
    .from(leadPreferences)
    .where(and(eq(leadPreferences.id, id), eq(leadPreferences.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new LeadPreferenceError("Las preferencias no existen.", "not_found");
  }

  const nextBudgetMinCop =
    "budgetMinCop" in parsed.data ? parsed.data.budgetMinCop : existing.budgetMinCop;
  const nextBudgetMaxCop =
    "budgetMaxCop" in parsed.data ? parsed.data.budgetMaxCop : existing.budgetMaxCop;
  const nextMinStratum =
    "minStratum" in parsed.data ? parsed.data.minStratum : existing.minStratum;
  const nextMaxStratum =
    "maxStratum" in parsed.data ? parsed.data.maxStratum : existing.maxStratum;

  const rangeIssues = getLeadPreferenceRangeIssues(
    nextBudgetMinCop,
    nextBudgetMaxCop,
    nextMinStratum,
    nextMaxStratum,
  );
  if (rangeIssues.length > 0) {
    throw new LeadPreferenceError(
      rangeIssues[0].message,
      "validation",
      rangeIssues.map((issue) => issue.message),
    );
  }

  const [updated] = await db
    .update(leadPreferences)
    .set({ ...withoutUndefined(parsed.data), updatedAt: new Date() })
    .where(and(eq(leadPreferences.id, id), eq(leadPreferences.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new LeadPreferenceError("Las preferencias no existen.", "not_found");
  }
  return updated;
}

/**
 * Fetches a single lead-preference row by its full unique key: `(tenantId, contactId,
 * operationType)`. A mixed buyer+renter contact can legitimately have one row per operation type
 * (see the `lead_preferences` schema doc and its `lead_preferences_tenant_contact_operation_unique_idx`
 * — deliberately NOT unique on `contactId` alone), so `operationType` is a required part of the
 * lookup key, not optional: querying by `contactId` alone could return either row arbitrarily
 * depending on Postgres's (unspecified, since there's no `ORDER BY`) row order. Returns `null`
 * (not an error) when no row matches.
 */
export async function getPreference(
  input: { contactId: string; tenantId: string; operationType: LeadPreferenceOperationType },
  deps: LeadPreferencesDeps = {},
): Promise<LeadPreference | null> {
  const db = deps.db ?? getDb();

  const [preference] = await db
    .select()
    .from(leadPreferences)
    .where(
      and(
        eq(leadPreferences.contactId, input.contactId),
        eq(leadPreferences.tenantId, input.tenantId),
        eq(leadPreferences.operationType, input.operationType),
      ),
    )
    .limit(1);

  return preference ?? null;
}

/**
 * Lists every lead-preference row for a contact (at most two: one per `operationType`, per the
 * schema's unique index) — the API T1.5 uses to render both the venta and arriendo sub-forms for
 * a mixed buyer+renter contact. Ordered by `operationType` ascending (`arriendo` before `venta`)
 * so the result order is stable/deterministic across calls, not left to Postgres's unspecified
 * default. Returns `[]` (not an error) when the contact has no preferences.
 */
export async function listPreferences(
  input: { contactId: string; tenantId: string },
  deps: LeadPreferencesDeps = {},
): Promise<LeadPreference[]> {
  const db = deps.db ?? getDb();

  return db
    .select()
    .from(leadPreferences)
    .where(
      and(eq(leadPreferences.contactId, input.contactId), eq(leadPreferences.tenantId, input.tenantId)),
    )
    .orderBy(asc(leadPreferences.operationType));
}
