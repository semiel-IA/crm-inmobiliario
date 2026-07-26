import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { getContact } from "@/server/services/contacts";
import { getTeamOverview } from "@/server/services/auth";
import { ContactDetail } from "./contact-detail";

/** Ficha de contacto (T1.3): datos básicos, consentimiento, preferencias (solo lectura — el
 * formulario editable llega en T1.5), asignación de agente, editar y desactivar. */
export default async function ContactoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireUser();

  const [contact, { members }] = await Promise.all([
    getContact({ id, tenantId }),
    getTeamOverview({ tenantId }),
  ]);

  if (!contact) {
    notFound();
  }

  const activeMembers = members
    .filter((member) => member.status === "active")
    .map((member) => ({ userId: member.userId, fullName: member.fullName, email: member.email }));

  return <ContactDetail contact={contact} members={activeMembers} />;
}
