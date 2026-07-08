"use client";

import { useActionState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameTenantAction, type RenameTenantState } from "./actions";

const initialState: RenameTenantState = {};

export function RenameTenantForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(renameTenantAction, initialState);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="tenant-name-input">Nombre de la inmobiliaria</Label>
          <Input
            key={currentName}
            id="tenant-name-input"
            name="name"
            defaultValue={currentName}
            required
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </form>

      {state.error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{state.error}</AlertTitle>
        </Alert>
      )}

      {state.success && (
        <Alert role="status">
          <AlertTitle>Nombre actualizado.</AlertTitle>
        </Alert>
      )}
    </div>
  );
}
