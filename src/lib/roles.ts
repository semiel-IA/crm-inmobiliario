/** Membership roles (must match the `memberships_role_check` / `invitations_role_check` CHECKs). */
export type MemberRole = "admin" | "agent" | "assistant";

/** UI labels (es-CO) for each role. Code stays in English; visible text in Spanish. */
export const ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Administrador",
  agent: "Agente",
  assistant: "Asistente",
};
