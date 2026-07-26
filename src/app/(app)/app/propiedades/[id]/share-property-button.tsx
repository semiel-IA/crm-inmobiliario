"use client";

import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPublicPropertyUrl } from "../property-helpers";

/**
 * "Compartir" button for the property ficha (T1.8): builds the public listing link
 * (`/p/{tenant-slug}/{codigo}` — the page itself is T1.10 and doesn't exist yet, but the link
 * shape is contract) and copies it to the clipboard with a confirmation toast.
 */
export function SharePropertyButton({
  tenantSlug,
  internalCode,
}: {
  tenantSlug: string;
  internalCode: string;
}) {
  async function handleShare() {
    const url = buildPublicPropertyUrl(tenantSlug, internalCode);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace público copiado al portapapeles.", { description: url });
    } catch {
      // Clipboard can be unavailable (permissions, http); show the link so it can be copied by hand.
      toast.info("No se pudo copiar automáticamente. Enlace:", { description: url });
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleShare}>
      <Share2 /> Compartir
    </Button>
  );
}
