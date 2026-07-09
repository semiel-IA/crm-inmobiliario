import { and, arrayOverlaps, count, desc, eq, ilike, or } from "drizzle-orm";
import {
  createContactSchema,
  updateContactSchema,
  type ContactSource,
  type ContactType,
  type LeadStatus,
} from "@/lib/validations/contacts";
import { getDb } from "@/server/db/client";
import { contacts, leadPreferences, memberships, type Contact } from "@/server/db/schema";

/**
 * Business-logic layer for `contacts` (T1.2). Every function is pure w.r.t. its `deps.db`
 * injection (defaults to the real `getDb()`), following the pattern established by
 * `src/server/services/tenants/rename-tenant.ts` / `src/server/services/auth/invitations.ts`.
 *
 * `db` here runs with service-role/`postgres` privileges that bypass RLS (see `getDb`), so RLS
 * alone cannot be relied on — every query below is explicitly scoped by `tenant_id` as
 * defense-in-depth, per `docs/plan-maestro.md` §2.2. RLS itself (cross-tenant isolation at the
 * Postgres level) is covered by the live suite in `tests/rls/properties-isolation.test.ts`.
 */

export type ContactErrorCode = "validation" | "not_found" | "invalid_agent";

/** Typed business error for the contacts service; `code` drives the es-CO message shown by the
 * Server Action layer. */
export class ContactError extends Error {
  readonly code: ContactErrorCode;

  constructor(message: string, code: ContactErrorCode) {
    super(message);
    this.name = "ContactError";
    this.code = code;
  }
}

type ContactsDeps = {
  db?: ReturnType<typeof getDb>;
};

const DEFAULT_PAGE_SIZE = 10;

export type CreateContactInput = {
  tenantId: string;
  /** `auth.users.id` of whoever is creating this contact; omitted for server-side/seed inserts. */
  actorUserId?: string;
  fullName: string;
  phone: string;
  email?: string;
  documentId?: string;
  contactTypes: ContactType[];
  source?: ContactSource;
  leadStatus?: LeadStatus;
  notes?: string;
  consentAt?: Date | string;
  consentChannel?: string;
};

/** Runs the shared Zod schema and normalizes its error into a typed `ContactError`. */
function parseOrThrow<T>(
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: unknown } },
  input: unknown,
): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error as { issues?: Array<{ message: string }> } | undefined;
    const message = issues?.issues?.[0]?.message ?? "Datos de contacto inválidos.";
    throw new ContactError(message, "validation");
  }
  return parsed.data as T;
}

/** Creates a contact. Validates with `createContactSchema` (defense-in-depth: the Server Action
 * layer validates too, but this service must never trust a caller that skips it). */
export async function createContact(
  input: CreateContactInput,
  deps: ContactsDeps = {},
): Promise<Contact> {
  const db = deps.db ?? getDb();
  const data = parseOrThrow(createContactSchema, input);

  const [created] = await db
    .insert(contacts)
    .values({
      tenantId: input.tenantId,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      documentId: data.documentId,
      contactTypes: data.contactTypes,
      source: data.source,
      leadStatus: data.leadStatus ?? "nuevo",
      notes: data.notes,
      consentAt: data.consentAt,
      consentChannel: data.consentChannel,
      createdBy: input.actorUserId,
    })
    .returning();

  if (!created) {
    throw new ContactError("No se pudo crear el contacto.", "validation");
  }
  return created;
}

export type UpdateContactInput = {
  id: string;
  tenantId: string;
  fullName?: string;
  phone?: string;
  email?: string;
  documentId?: string;
  contactTypes?: ContactType[];
  source?: ContactSource;
  leadStatus?: LeadStatus;
  notes?: string;
  consentAt?: Date | string;
  consentChannel?: string;
};

/** Strips `undefined`-valued keys so a partial update never overwrites an untouched column with
 * `NULL` just because the caller happened to pass the key with an `undefined` value. */
function withoutUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Updates a contact's provided fields (partial) and bumps `updatedAt`. Throws `not_found` when
 * no row matches `id` + `tenantId` (already-deleted, or belongs to another tenant). */
export async function updateContact(
  input: UpdateContactInput,
  deps: ContactsDeps = {},
): Promise<Contact> {
  const db = deps.db ?? getDb();
  const { id, tenantId, ...rest } = input;
  const data = parseOrThrow(updateContactSchema, rest);

  const [updated] = await db
    .update(contacts)
    .set({ ...withoutUndefined(data), updatedAt: new Date() })
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new ContactError("El contacto no existe.", "not_found");
  }
  return updated;
}

export type ContactWithPreferences = Contact & {
  leadPreferences: (typeof leadPreferences.$inferSelect)[];
};

/** Fetches a contact with its nested `lead_preferences` rows. Returns `null` (not an error) when
 * nothing matches `id` + `tenantId` — the Server Action layer maps that to a 404-style state. */
export async function getContact(
  input: { id: string; tenantId: string },
  deps: ContactsDeps = {},
): Promise<ContactWithPreferences | null> {
  const db = deps.db ?? getDb();

  const [contact] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.id, input.id), eq(contacts.tenantId, input.tenantId)))
    .limit(1);

  if (!contact) {
    return null;
  }

  const preferences = await db
    .select()
    .from(leadPreferences)
    .where(and(eq(leadPreferences.tenantId, input.tenantId), eq(leadPreferences.contactId, input.id)));

  return { ...contact, leadPreferences: preferences };
}

export type ListContactsFilters = {
  tenantId: string;
  /** Case-insensitive match against `fullName` OR `phone`. */
  search?: string;
  /** Contacts having ANY of these types (array overlap, not "must have all"). */
  contactTypes?: ContactType[];
  source?: ContactSource;
  leadStatus?: LeadStatus;
  assignedAgentId?: string;
  /** 1-based. Defaults to 1. */
  page?: number;
  /** Defaults to 10. */
  pageSize?: number;
};

export type ListContactsResult = {
  items: Contact[];
  total: number;
};

/** Lists a tenant's contacts with search/filters and pagination (default 10/page), newest first.
 * Always scoped by `tenantId` (required, never optional) — defense-in-depth per §2.2. */
export async function listContacts(
  filters: ListContactsFilters,
  deps: ContactsDeps = {},
): Promise<ListContactsResult> {
  const db = deps.db ?? getDb();

  const page = filters.page && filters.page > 0 ? Math.floor(filters.page) : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? Math.floor(filters.pageSize) : DEFAULT_PAGE_SIZE;

  const conditions = [eq(contacts.tenantId, filters.tenantId)];

  const search = filters.search?.trim();
  if (search) {
    const term = `%${search}%`;
    conditions.push(or(ilike(contacts.fullName, term), ilike(contacts.phone, term))!);
  }
  if (filters.contactTypes && filters.contactTypes.length > 0) {
    conditions.push(arrayOverlaps(contacts.contactTypes, filters.contactTypes));
  }
  if (filters.source) {
    conditions.push(eq(contacts.source, filters.source));
  }
  if (filters.leadStatus) {
    conditions.push(eq(contacts.leadStatus, filters.leadStatus));
  }
  if (filters.assignedAgentId) {
    conditions.push(eq(contacts.assignedAgentId, filters.assignedAgentId));
  }

  const whereClause = and(...conditions)!;

  const items = await db
    .select()
    .from(contacts)
    .where(whereClause)
    .orderBy(desc(contacts.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [totalRow] = await db.select({ total: count() }).from(contacts).where(whereClause);

  return { items, total: Number(totalRow?.total ?? 0) };
}

/** Soft delete: sets `leadStatus = 'inactivo'`. Rows are never removed from the table — every
 * business table in this app is append/update-only for contacts (plan §2.4). */
export async function deactivateContact(
  input: { id: string; tenantId: string },
  deps: ContactsDeps = {},
): Promise<Contact> {
  const db = deps.db ?? getDb();

  const [updated] = await db
    .update(contacts)
    .set({ leadStatus: "inactivo", updatedAt: new Date() })
    .where(and(eq(contacts.id, input.id), eq(contacts.tenantId, input.tenantId)))
    .returning();

  if (!updated) {
    throw new ContactError("El contacto no existe.", "not_found");
  }
  return updated;
}

export type AssignAgentInput = {
  contactId: string;
  tenantId: string;
  agentUserId: string;
};

/** Assigns a contact to an agent. Validates `agentUserId` is an ACTIVE member of `tenantId` first
 * — this is the one place in this service where cross-tenant leakage could otherwise happen
 * silently (assigning a contact to a user from another tenant), so the check is mandatory and
 * unconditional, not just "if provided". */
export async function assignAgent(
  input: AssignAgentInput,
  deps: ContactsDeps = {},
): Promise<Contact> {
  const db = deps.db ?? getDb();

  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.tenantId, input.tenantId),
        eq(memberships.userId, input.agentUserId),
        eq(memberships.status, "active"),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new ContactError(
      "El agente no pertenece a este equipo o no está activo.",
      "invalid_agent",
    );
  }

  const [updated] = await db
    .update(contacts)
    .set({ assignedAgentId: input.agentUserId, updatedAt: new Date() })
    .where(and(eq(contacts.id, input.contactId), eq(contacts.tenantId, input.tenantId)))
    .returning();

  if (!updated) {
    throw new ContactError("El contacto no existe.", "not_found");
  }
  return updated;
}
