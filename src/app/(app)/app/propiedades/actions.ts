"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";
import {
  createProperty,
  deactivateProperty,
  getProperty,
  listProperties,
  PropertyServiceError,
  updateProperty,
  type ListPropertiesFilters,
} from "@/server/services/properties";

/**
 * Thin Server Action wrappers around `src/server/services/properties.ts` for the properties
 * module (T1.7). Every action re-verifies the session (`requireUser` — Server Actions are POST
 * endpoints of their own, not covered by the route-level proxy guard) and passes the tenant id
 * from verified JWT claims, never from client input.
 *
 * These accept plain typed objects rather than `FormData` (unlike `equipo/actions.ts` /
 * `configuracion/actions.ts`): T1.8 (properties UI, not yet built) owns the actual form field
 * layout — a multi-step wizard per the plan — so guessing a `FormData` shape here would likely be
 * thrown away once that UI lands. Server Actions can be called directly with typed arguments from
 * a Client Component, so this stays a real Server Action while staying decoupled from a UI that
 * doesn't exist yet.
 */

export type PropertyActionResult<T> =
  { data: T; error?: undefined } | { data?: undefined; error: string };

function toErrorResult(error: unknown, fallback: string): { error: string } {
  if (error instanceof PropertyServiceError) {
    return { error: error.message };
  }
  console.error(fallback, error);
  return { error: fallback };
}

export async function createPropertyAction(
  input: Record<string, unknown>,
): Promise<PropertyActionResult<{ id: string; internalCode: string }>> {
  const { tenantId, user } = await requireUser();

  try {
    const created = await createProperty({ ...input, tenantId, createdBy: user.id });
    revalidatePath("/app/propiedades");
    return { data: { id: created.id, internalCode: created.internalCode } };
  } catch (error) {
    return toErrorResult(error, "No se pudo crear la propiedad. Intenta de nuevo.");
  }
}

export async function updatePropertyAction(
  id: string,
  input: Record<string, unknown>,
): Promise<PropertyActionResult<{ id: string }>> {
  const { tenantId } = await requireUser();

  try {
    const updated = await updateProperty(id, tenantId, input);
    revalidatePath("/app/propiedades");
    revalidatePath(`/app/propiedades/${id}`);
    return { data: { id: updated.id } };
  } catch (error) {
    return toErrorResult(error, "No se pudo actualizar la propiedad. Intenta de nuevo.");
  }
}

export async function getPropertyAction(
  id: string,
): Promise<PropertyActionResult<Awaited<ReturnType<typeof getProperty>>>> {
  const { tenantId } = await requireUser();

  try {
    const property = await getProperty(id, tenantId);
    return { data: property };
  } catch (error) {
    return toErrorResult(error, "No se pudo cargar la propiedad.");
  }
}

export async function listPropertiesAction(
  filters: ListPropertiesFilters = {},
): Promise<PropertyActionResult<Awaited<ReturnType<typeof listProperties>>>> {
  const { tenantId } = await requireUser();

  try {
    const result = await listProperties(tenantId, filters);
    return { data: result };
  } catch (error) {
    return toErrorResult(error, "No se pudo cargar el listado de propiedades.");
  }
}

export async function deactivatePropertyAction(
  id: string,
): Promise<PropertyActionResult<{ id: string }>> {
  const { tenantId } = await requireUser();

  try {
    await deactivateProperty(id, tenantId);
    revalidatePath("/app/propiedades");
    revalidatePath(`/app/propiedades/${id}`);
    return { data: { id } };
  } catch (error) {
    return toErrorResult(error, "No se pudo desactivar la propiedad.");
  }
}
