"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, loginDemo, type LoginState } from "./actions";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);
  const [demoState, demoAction, demoPending] = useActionState(loginDemo, initialState);
  // `NEXT_PUBLIC_*` se sustituye en tiempo de build, así que hay que reiniciar el dev server
  // tras cambiar el .env para que el nuevo valor quede incrustado en el bundle del cliente.
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Entra a tu cuenta de CRM Inmobiliario.</CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            {(state.error ?? demoState.error) && (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{state.error ?? demoState.error}</AlertTitle>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
          </CardContent>
          <CardFooter className="mt-4 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Entrando…" : "Entrar"}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿No tienes cuenta?{" "}
              <Link href="/registro" className="underline">
                Registra tu inmobiliaria
              </Link>
            </p>
          </CardFooter>
        </form>

        {demoEnabled && (
          <form action={demoAction} className="border-t px-6 pt-4 pb-6">
            <Button type="submit" variant="secondary" className="w-full" disabled={demoPending}>
              {demoPending ? "Entrando…" : "Entrar como demo"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Acceso de prueba con datos de ejemplo, sin credenciales.
            </p>
          </form>
        )}
      </Card>
    </main>
  );
}
