import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/roles";
import { getInvitationByToken } from "@/server/services/auth";
import { AcceptInvitationForm } from "./accept-form";

const INVALID_STATE_MESSAGES = {
  not_found: {
    title: "Invitación no encontrada",
    description: "El enlace es incorrecto o la invitación fue eliminada.",
  },
  expired: {
    title: "Invitación vencida",
    description: "Este enlace ya venció. Pide al administrador que te envíe una invitación nueva.",
  },
  already_accepted: {
    title: "Invitación ya usada",
    description: "Esta invitación ya fue aceptada. Si es tu cuenta, inicia sesión.",
  },
} as const;

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  const invalidState = !invitation
    ? INVALID_STATE_MESSAGES.not_found
    : invitation.status === "expired"
      ? INVALID_STATE_MESSAGES.expired
      : invitation.status === "already_accepted"
        ? INVALID_STATE_MESSAGES.already_accepted
        : null;

  if (!invitation || invalidState) {
    const { title, description } = invalidState ?? INVALID_STATE_MESSAGES.not_found;
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6">
            <Alert role="alert">
              <AlertTitle>{title}</AlertTitle>
              <AlertDescription>{description}</AlertDescription>
            </Alert>
            <p className="mt-4 text-sm text-muted-foreground">
              <Link href="/login" className="underline">
                Ir a iniciar sesión
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Te invitaron a {invitation.tenantName}</CardTitle>
          <CardDescription>
            Te unirás como <strong>{ROLE_LABELS[invitation.role]}</strong> con el correo{" "}
            <strong>{invitation.email}</strong>. Completa tus datos para crear tu cuenta.
          </CardDescription>
        </CardHeader>
        <AcceptInvitationForm token={token} />
      </Card>
    </main>
  );
}
