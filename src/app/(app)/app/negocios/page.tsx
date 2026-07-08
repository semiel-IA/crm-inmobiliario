import { requireUser } from "@/lib/supabase/require-user";
import { ComingSoon } from "../_components/coming-soon";

/** Placeholder for M4 (Pipeline) — arrives en la Fase 2 del plan (T2.1–T2.2). */
export default async function NegociosPage() {
  await requireUser();

  return (
    <ComingSoon
      title="Negocios"
      description="Pipeline de ventas y arriendos: kanban por etapas, valor del embudo e historial de movimientos."
    />
  );
}
