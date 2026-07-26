"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContactSource, ContactType, LeadStatus } from "@/lib/validations/contacts";
import type { ContactWithPreferences } from "@/server/services/contacts";
import { assignAgentAction, deactivateContactAction } from "../actions";
import { ContactFormDialog } from "../contact-form-dialog";
import { LeadPreferencesPanel } from "../lead-preferences-panel";
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_TYPE_LABELS,
  LEAD_STATUS_BADGE_VARIANT,
  LEAD_STATUS_LABELS,
} from "../labels";
import type { MemberOption } from "../contacts-list";

const dateFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

export function ContactDetail({
  contact: initialContact,
  members,
}: {
  contact: ContactWithPreferences;
  members: MemberOption[];
}) {
  const router = useRouter();
  const [contact, setContact] = useState(initialContact);
  const [assigning, setAssigning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(contact.assignedAgentId ?? "");
  const [deactivating, setDeactivating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const assignedMember = members.find((m) => m.userId === contact.assignedAgentId);

  // `items` map so the Base UI Select trigger renders the member's name (not the raw user id)
  // when closed.
  const agentSelectItems: Record<string, string> = Object.fromEntries(
    members.map((member) => [member.userId, member.fullName || member.email]),
  );

  async function handleAssign() {
    if (!selectedAgent) return;
    setAssigning(true);
    try {
      const result = await assignAgentAction(contact.id, selectedAgent);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data) {
        setContact((current) => ({ ...current, assignedAgentId: result.data!.assignedAgentId }));
        toast.success("Agente asignado.");
      }
    } finally {
      setAssigning(false);
    }
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      const result = await deactivateContactAction(contact.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Contacto desactivado.");
      setConfirmOpen(false);
      router.refresh();
      if (result.data) {
        setContact((current) => ({ ...current, leadStatus: result.data!.leadStatus }));
      }
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
      <div>
        <Link
          href="/app/contactos"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al listado
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{contact.fullName}</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            {contact.contactTypes.map((type) => (
              <Badge key={type} variant="outline">
                {CONTACT_TYPE_LABELS[type as ContactType] ?? type}
              </Badge>
            ))}
            <Badge variant={LEAD_STATUS_BADGE_VARIANT[contact.leadStatus as LeadStatus]}>
              {LEAD_STATUS_LABELS[contact.leadStatus as LeadStatus] ?? contact.leadStatus}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ContactFormDialog
            mode="edit"
            contactId={contact.id}
            defaultValues={{
              fullName: contact.fullName,
              phone: contact.phone,
              email: contact.email,
              documentId: contact.documentId,
              contactTypes: contact.contactTypes,
              source: contact.source,
              leadStatus: contact.leadStatus,
              notes: contact.notes,
              consentAt: contact.consentAt,
              consentChannel: contact.consentChannel,
            }}
            trigger={<Button type="button">Editar</Button>}
            onSaved={(updated) => setContact((current) => ({ ...current, ...updated }))}
          />

          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
              Desactivar
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Desactivar este contacto?</AlertDialogTitle>
                <AlertDialogDescription>
                  {contact.fullName} pasará a estado “Inactivo”. Podrás seguir viendo su ficha,
                  pero no aparecerá en las búsquedas activas por defecto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deactivating}
                  onClick={handleDeactivate}
                >
                  {deactivating ? "Desactivando…" : "Desactivar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos básicos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Teléfono</dt>
              <dd className="text-sm">{contact.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Correo</dt>
              <dd className="text-sm">{contact.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cédula / NIT</dt>
              <dd className="text-sm">{contact.documentId || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Origen</dt>
              <dd className="text-sm">
                {contact.source
                  ? (CONTACT_SOURCE_LABELS[contact.source as ContactSource] ?? contact.source)
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Notas</dt>
              <dd className="text-sm whitespace-pre-wrap">{contact.notes || "Sin notas."}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Consentimiento habeas data</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.consentAt && contact.consentChannel ? (
            <p className="text-sm">
              Autorizado el {dateFormatter.format(new Date(contact.consentAt))} vía{" "}
              {contact.consentChannel}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sin registrar.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferencias</CardTitle>
          <CardDescription>
            Lo que este contacto busca: operación, tipos de inmueble, zonas, presupuesto y
            requisitos mínimos. Un contacto comprador+arrendatario puede tener preferencias
            separadas para venta y arriendo — cámbialas de pestaña.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadPreferencesPanel contactId={contact.id} preferences={contact.leadPreferences} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agente asignado</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            {assignedMember ? assignedMember.fullName || assignedMember.email : "Sin asignar"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              items={agentSelectItems}
              value={selectedAgent || null}
              onValueChange={(value: string | null) => setSelectedAgent(value ?? "")}
            >
              <SelectTrigger aria-label="Elegir agente" className="w-56">
                <SelectValue placeholder="Elegir agente…" />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.fullName || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedAgent || assigning || selectedAgent === contact.assignedAgentId}
              onClick={handleAssign}
            >
              {assigning ? "Asignando…" : "Asignar agente"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
