"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getEnv } from "@/lib/env";
import { requireAdmin } from "@/lib/supabase/require-user";
import { inviteSchema } from "@/lib/validations/auth";
import { createInvitation, InvitationError, revokeInvitation } from "@/server/services/auth";

export type InviteState = {
  error?: string;
  invitationUrl?: string;
  invitedEmail?: string;
};

/**
 * Resolves the origin (scheme + host) used to build the invitation link. Prefers the trusted
 * `APP_URL` env var; only falls back to the request's `x-forwarded-host`/`host` headers — which
 * are client-controllable and spoofable behind a misconfigured proxy — when `APP_URL` is unset
 * (local dev without a fixed domain yet).
 */
async function resolveAppOrigin(): Promise<string | undefined> {
  const { APP_URL } = getEnv();
  if (APP_URL) {
    // `.origin` normalizes away any path or trailing slash (e.g. `https://x.com/sub` →
    // `https://x.com`) so the link is always `<scheme>://<host>/invitacion/<token>`.
    return new URL(APP_URL).origin;
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  return host ? `${protocol}://${host}` : undefined;
}

export async function invite(_prevState: InviteState, formData: FormData): Promise<InviteState> {
  // Defense in depth: the proxy already gates /app/equipo, but Server Actions are POST
  // endpoints of their own and must re-verify session + role.
  const { tenantId, user } = await requireAdmin();

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const appOrigin = await resolveAppOrigin();
  if (!appOrigin) {
    return { error: "No se pudo determinar la URL de la aplicación." };
  }

  try {
    const { invitationUrl } = await createInvitation({
      tenantId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: user.id,
      appOrigin,
    });

    revalidatePath("/app/equipo");
    return { invitationUrl, invitedEmail: parsed.data.email };
  } catch (error) {
    if (error instanceof InvitationError && error.code === "invitation_pending") {
      return { error: "Ya hay una invitación pendiente para este correo." };
    }
    console.error("createInvitation falló:", error);
    return { error: "No se pudo crear la invitación. Intenta de nuevo." };
  }
}

/** Revokes a pending invitation. Server Action bound to a hidden-input form per row in the UI. */
export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const { tenantId, user } = await requireAdmin();

  const invitationId = formData.get("invitationId");
  if (typeof invitationId !== "string" || !invitationId) {
    return;
  }

  try {
    await revokeInvitation({ invitationId, tenantId, revokedBy: user.id });
  } catch (error) {
    console.error("revokeInvitation falló:", error);
  }

  revalidatePath("/app/equipo");
}
