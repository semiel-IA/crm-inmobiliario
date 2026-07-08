"use client";

import { useActionState, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, type MemberRole } from "@/lib/roles";
import { invite, type InviteState } from "./actions";

const initialState: InviteState = {};

const INVITABLE_ROLES: MemberRole[] = ["admin", "agent", "assistant"];

export function InviteForm() {
  const [state, formAction, pending] = useActionState(invite, initialState);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!state.invitationUrl) return;
    try {
      await navigator.clipboard.writeText(state.invitationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions, http); the link is still selectable by hand.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="invite-email">Correo electrónico</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">Rol</Label>
          <select
            id="invite-role"
            name="role"
            required
            defaultValue="agent"
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {INVITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Invitando…" : "Invitar"}
        </Button>
      </form>

      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{state.error}</AlertTitle>
        </Alert>
      )}

      {state.invitationUrl && (
        <Alert role="status">
          <AlertTitle>Invitación creada para {state.invitedEmail}</AlertTitle>
          <AlertDescription>
            <p>Comparte este enlace (vence en 7 días):</p>
            <div className="mt-2 flex w-full gap-2">
              <Input
                readOnly
                value={state.invitationUrl}
                data-testid="invitation-url"
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={copyLink}>
                {copied ? "¡Copiado!" : "Copiar"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
