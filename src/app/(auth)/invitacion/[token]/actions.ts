"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitationSchema } from "@/lib/validations/auth";
import { acceptInvitation, InvitationError } from "@/server/services/auth";

export type AcceptInvitationState = {
  error?: string;
};

const INVITATION_ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "La invitación no existe o el enlace es incorrecto.",
  expired: "La invitación venció. Pide al administrador que te envíe una nueva.",
  already_accepted: "Esta invitación ya fue usada.",
  email_taken: "Este correo ya tiene una cuenta. Inicia sesión en su lugar.",
};

export async function accept(
  token: string,
  _prevState: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const parsed = acceptInvitationSchema.safeParse({
    fullName: formData.get("fullName"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  let email: string;
  try {
    const result = await acceptInvitation({
      token,
      fullName: parsed.data.fullName,
      password: parsed.data.password,
    });
    email = result.email;
  } catch (error) {
    if (error instanceof InvitationError) {
      return {
        error:
          INVITATION_ERROR_MESSAGES[error.code] ??
          "No se pudo aceptar la invitación. Intenta de nuevo.",
      };
    }
    console.error("acceptInvitation falló:", error);
    return { error: "No se pudo aceptar la invitación. Intenta de nuevo." };
  }

  // Auto-login with the just-created credentials (user is created confirmed, ADR-006).
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (signInError) {
    redirect("/login");
  }

  redirect("/app");
}
