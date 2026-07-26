"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";
import { createContactSchema, updateContactSchema } from "@/lib/validations/contacts";
import {
  createLeadPreferenceSchema,
  updateLeadPreferenceSchema,
} from "@/lib/validations/lead-preferences";
import type { Contact, LeadPreference } from "@/server/db/schema";
import {
  assignAgent,
  ContactError,
  createContact,
  deactivateContact,
  getContact,
  listContacts,
  updateContact,
  type ContactWithPreferences,
  type ListContactsFilters,
} from "@/server/services/contacts";
import {
  createPreference,
  getPreference,
  LeadPreferenceError,
  listPreferences,
  updatePreference,
} from "@/server/services/lead-preferences";
import type { LeadPreferenceOperationType } from "@/lib/validations/lead-preferences";

/**
 * Server Actions for the contacts CRUD (T1.2) — thin layer per `CLAUDE.md`/plan §2.4: re-verify
 * the session + resolve `tenantId` from server-trusted claims (never from client input, mirroring
 * `equipo/actions.ts` and `configuracion/actions.ts`), delegate all business logic to
 * `@/server/services/contacts`, and map typed `ContactError`s to es-CO messages for the UI (T1.3).
 *
 * These accept plain objects (not `FormData`): unlike the single-field forms in T0.4/T0.5,
 * contact payloads carry arrays (`contactTypes`) and optional dates (`consentAt`) that don't map
 * cleanly onto `FormData` — the T1.3 UI is expected to call these directly from a client
 * component (React Hook Form's `onSubmit`) rather than via `<form action={...}>`.
 */

export type ContactActionState<T> = {
  error?: string;
  data?: T;
};

/** Maps a thrown error (typed `ContactError` or unknown) to an es-CO message safe to show. */
function toErrorMessage(error: unknown): string {
  if (error instanceof ContactError) {
    return error.message;
  }
  console.error("Acción de contactos falló:", error);
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

function revalidateContacts() {
  revalidatePath("/app/contactos");
}

export async function createContactAction(
  input: unknown,
): Promise<ContactActionState<Contact>> {
  const { tenantId, user } = await requireUser();

  const parsed = createContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const contact = await createContact(
      { ...parsed.data, tenantId, actorUserId: user.id },
      {},
    );
    revalidateContacts();
    return { data: contact };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function updateContactAction(
  id: string,
  input: unknown,
): Promise<ContactActionState<Contact>> {
  const { tenantId } = await requireUser();

  const parsed = updateContactSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const contact = await updateContact({ id, tenantId, ...parsed.data }, {});
    revalidateContacts();
    return { data: contact };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function getContactAction(
  id: string,
): Promise<ContactActionState<ContactWithPreferences | null>> {
  const { tenantId } = await requireUser();

  try {
    const contact = await getContact({ id, tenantId }, {});
    return { data: contact };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export type ListContactsActionInput = Omit<ListContactsFilters, "tenantId">;

export async function listContactsAction(
  filters: ListContactsActionInput = {},
): Promise<ContactActionState<{ items: Contact[]; total: number }>> {
  const { tenantId } = await requireUser();

  try {
    const result = await listContacts({ ...filters, tenantId }, {});
    return { data: result };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function deactivateContactAction(
  id: string,
): Promise<ContactActionState<Contact>> {
  const { tenantId } = await requireUser();

  try {
    const contact = await deactivateContact({ id, tenantId }, {});
    revalidateContacts();
    return { data: contact };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

export async function assignAgentAction(
  contactId: string,
  agentUserId: string,
): Promise<ContactActionState<Contact>> {
  const { tenantId } = await requireUser();

  try {
    const contact = await assignAgent({ contactId, tenantId, agentUserId }, {});
    revalidateContacts();
    return { data: contact };
  } catch (error) {
    return { error: toErrorMessage(error) };
  }
}

/** Maps a thrown error (typed `LeadPreferenceError` or unknown) to an es-CO message safe to show. */
function toLeadPreferenceErrorMessage(error: unknown): string {
  if (error instanceof LeadPreferenceError) {
    return error.message;
  }
  console.error("Acción de preferencias falló:", error);
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

export async function createLeadPreferenceAction(
  contactId: string,
  input: unknown,
): Promise<ContactActionState<LeadPreference>> {
  const { tenantId, user } = await requireUser();

  const parsed = createLeadPreferenceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const preference = await createPreference(
      { ...parsed.data, contactId, tenantId, actorUserId: user.id },
      {},
    );
    revalidateContacts();
    return { data: preference };
  } catch (error) {
    return { error: toLeadPreferenceErrorMessage(error) };
  }
}

export async function updateLeadPreferenceAction(
  id: string,
  input: unknown,
): Promise<ContactActionState<LeadPreference>> {
  const { tenantId } = await requireUser();

  const parsed = updateLeadPreferenceSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    const preference = await updatePreference({ id, tenantId, ...parsed.data }, {});
    revalidateContacts();
    return { data: preference };
  } catch (error) {
    return { error: toLeadPreferenceErrorMessage(error) };
  }
}

export async function getLeadPreferenceAction(
  contactId: string,
  operationType: LeadPreferenceOperationType,
): Promise<ContactActionState<LeadPreference | null>> {
  const { tenantId } = await requireUser();

  try {
    const preference = await getPreference({ contactId, tenantId, operationType }, {});
    return { data: preference };
  } catch (error) {
    return { error: toLeadPreferenceErrorMessage(error) };
  }
}

/** Lists every lead-preference row for a contact (at most one per operation type — venta and/or
 * arriendo). This is what T1.5 should call to render both sub-forms for a mixed buyer+renter
 * contact; `getLeadPreferenceAction` is for looking up a single known operation type. */
export async function listLeadPreferencesAction(
  contactId: string,
): Promise<ContactActionState<LeadPreference[]>> {
  const { tenantId } = await requireUser();

  try {
    const preferences = await listPreferences({ contactId, tenantId }, {});
    return { data: preferences };
  } catch (error) {
    return { error: toLeadPreferenceErrorMessage(error) };
  }
}

// NOTE (T1.3): this file previously re-exported the filter/enum types
// (`export type { Contact, ContactSource, ... }`). That breaks at runtime: the server-actions
// loader evaluates every export of a "use server" module as a server reference, and the
// type-only binding `Contact` doesn't exist at runtime → `ReferenceError: Contact is not
// defined` (HTTP 500 on every action call from a client component). Import those types from
// their source modules (`@/server/db/schema`, `@/lib/validations/contacts`,
// `@/server/services/contacts`) instead.
