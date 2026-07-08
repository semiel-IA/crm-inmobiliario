"use client";

import { useActionState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accept, type AcceptInvitationState } from "./actions";

const initialState: AcceptInvitationState = {};

export function AcceptInvitationForm({ token }: { token: string }) {
  const acceptWithToken = accept.bind(null, token);
  const [state, formAction, pending] = useActionState(acceptWithToken, initialState);

  return (
    <form action={formAction}>
      <CardContent className="flex flex-col gap-4">
        {state.error && (
          <Alert variant="destructive" role="alert">
            <AlertTitle>{state.error}</AlertTitle>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Tu nombre completo</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Crea una contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
      </CardContent>
      <CardFooter className="mt-4">
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Uniéndote…" : "Unirme al equipo"}
        </Button>
      </CardFooter>
    </form>
  );
}
