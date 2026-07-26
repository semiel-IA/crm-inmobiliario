"use client";

import { cloneElement, useState, type ReactElement } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Contact } from "@/server/db/schema";
import { ContactForm, type ContactFormDefaults, type ContactFormValues } from "./contact-form";
import { createContactAction, updateContactAction } from "./actions";

export type ContactFormDialogProps = {
  mode: "create" | "edit";
  contactId?: string;
  defaultValues?: ContactFormDefaults;
  /** Button-like element that opens the dialog; an `onClick` is injected via `cloneElement`. */
  trigger: ReactElement<{ onClick?: () => void }>;
  onSaved: (contact: Contact) => void;
};

/** Modal wrapper around `ContactForm` (T1.3): "Nuevo contacto" on the listing page, and "Editar"
 * on the ficha, both funnel through the same form + the existing `createContactAction` /
 * `updateContactAction` (T1.2) — no backend changes. */
export function ContactFormDialog({
  mode,
  contactId,
  defaultValues,
  trigger,
  onSaved,
}: ContactFormDialogProps) {
  const [open, setOpen] = useState(false);
  // Remounts the form (and resets its internal state) each time the dialog opens.
  const [instanceKey, setInstanceKey] = useState(0);

  async function handleSubmit(data: ContactFormValues): Promise<{ error?: string }> {
    const result =
      mode === "create"
        ? await createContactAction(data)
        : await updateContactAction(contactId as string, data);

    if (result.error) {
      return { error: result.error };
    }
    if (result.data) {
      onSaved(result.data);
      setOpen(false);
    }
    return {};
  }

  return (
    <>
      {cloneElement(trigger, { onClick: () => setOpen(true) })}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setInstanceKey((k) => k + 1);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nuevo contacto" : "Editar contacto"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Registra un nuevo lead o contacto para tu inmobiliaria."
                : "Actualiza los datos del contacto."}
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            key={instanceKey}
            defaultValues={defaultValues}
            submitLabel={mode === "create" ? "Crear contacto" : "Guardar cambios"}
            pendingLabel={mode === "create" ? "Creando…" : "Guardando…"}
            onSubmit={handleSubmit}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
