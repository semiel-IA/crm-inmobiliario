import { requireUser } from "@/lib/supabase/require-user";
import { ComingSoon } from "../_components/coming-soon";

/** Placeholder for M2 (Inventario de propiedades) — arrives en la Fase 1 del plan (T1.4–T1.6). */
export default async function PropiedadesPage() {
  await requireUser();

  return (
    <ComingSoon
      title="Propiedades"
      description="Inventario de propiedades: galería de fotos, documentos privados, estados y ficha pública compartible."
    />
  );
}
