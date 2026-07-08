import { requireUser } from "@/lib/supabase/require-user";
import { ComingSoon } from "../_components/coming-soon";

/** Placeholder for M5 (Agenda y actividades) — arrives en la Fase 2 del plan (T2.3–T2.5). */
export default async function AgendaPage() {
  await requireUser();

  return (
    <ComingSoon
      title="Agenda"
      description="Calendario de visitas, tareas con vencimiento y el resumen de 'mi día' por agente."
    />
  );
}
