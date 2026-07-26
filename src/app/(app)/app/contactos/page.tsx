import { requireUser } from "@/lib/supabase/require-user";
import { getTeamOverview } from "@/server/services/auth";
import { ContactsList } from "./contacts-list";

/** Listing page for contacts (T1.3) — search, filters, pagination and "Nuevo contacto". Replaces
 * the T0.5 `ComingSoon` placeholder now that T1.1–T1.2 (schema + backend) are done. */
export default async function ContactosPage() {
  const { tenantId } = await requireUser();

  // Active members resolve the "agente asignado" column/dropdown by id → name. Read-only,
  // server-side reuse of the T0.5 team service (not the admin-only `/app/equipo` action) — see
  // `docs/plan-fase-1-mvp.md` §T1.3.
  const { members } = await getTeamOverview({ tenantId });
  const activeMembers = members
    .filter((member) => member.status === "active")
    .map((member) => ({ userId: member.userId, fullName: member.fullName, email: member.email }));

  return <ContactsList members={activeMembers} />;
}
