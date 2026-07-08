import { requireUser } from "@/lib/supabase/require-user";
import { ComingSoon } from "../_components/coming-soon";

/** Placeholder for M1 (Leads y contactos) — arrives in la Fase 1 del plan (T1.1–T1.3). */
export default async function ContactosPage() {
  await requireUser();

  return (
    <ComingSoon
      title="Contactos"
      description="Gestión de leads y contactos: alta rápida, tipos múltiples, asignación a agentes y timeline de actividades."
    />
  );
}
