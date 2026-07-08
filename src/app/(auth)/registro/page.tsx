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
import { register, type RegisterState } from "./actions";

const initialState: RegisterState = {};

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState(register, initialState);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Registra tu inmobiliaria</CardTitle>
          <CardDescription>
            Crea tu cuenta de administrador y empieza tu prueba de 14 días.
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
          <CardContent className="flex flex-col gap-4">
            {state.error && (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{state.error}</AlertTitle>
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="tenantName">Nombre de la inmobiliaria</Label>
              <Input id="tenantName" name="tenantName" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName">Tu nombre completo</Label>
              <Input id="fullName" name="fullName" autoComplete="name" required />
            </div>
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
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="mt-4 flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Creando cuenta…" : "Crear cuenta"}
            </Button>
            <p className="text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link href="/login" className="underline">
                Inicia sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
