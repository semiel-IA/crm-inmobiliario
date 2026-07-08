"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/require-user";
import { renameTenantSchema } from "@/lib/validations/tenant";
import { renameTenant } from "@/server/services/tenants";

export type RenameTenantState = {
  error?: string;
  success?: boolean;
};

/** Renames the current admin's tenant. Re-verifies session + admin role (Server Actions are POST
 * endpoints of their own, the proxy's route guard doesn't cover them). */
export async function renameTenantAction(
  _prevState: RenameTenantState,
  formData: FormData,
): Promise<RenameTenantState> {
  const { tenantId, user } = await requireAdmin();

  const parsed = renameTenantSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await renameTenant({ tenantId, name: parsed.data.name, actorUserId: user.id });
  } catch (error) {
    console.error("renameTenant falló:", error);
    return { error: "No se pudo actualizar el nombre. Intenta de nuevo." };
  }

  revalidatePath("/app/configuracion");
  revalidatePath("/app");
  return { success: true };
}
