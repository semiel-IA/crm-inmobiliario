import type { ContactSource, ContactType, LeadStatus } from "@/lib/validations/contacts";

/** es-CO display labels for the contacts enums (T1.3 UI layer only — the canonical enum values
 * live in `@/lib/validations/contacts`, shared with the backend). */

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  comprador: "Comprador",
  arrendatario: "Arrendatario",
  propietario: "Propietario",
};

export const CONTACT_SOURCE_LABELS: Record<ContactSource, string> = {
  portal: "Portal inmobiliario",
  referido: "Referido",
  redes: "Redes sociales",
  fachada: "Fachada / aviso",
  whatsapp: "WhatsApp",
  web: "Sitio web",
};

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  inactivo: "Inactivo",
};

/** Badge variant per lead status, so the table/ficha convey state visually (not by color alone —
 * the label text is always shown too). */
export const LEAD_STATUS_BADGE_VARIANT: Record<
  LeadStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  nuevo: "default",
  contactado: "secondary",
  calificado: "secondary",
  inactivo: "outline",
};
