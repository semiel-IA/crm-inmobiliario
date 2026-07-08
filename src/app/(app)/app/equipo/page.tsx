import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/roles";
import { requireAdmin } from "@/lib/supabase/require-user";
import { getTeamOverview } from "@/server/services/auth";
import { revokeInvitationAction } from "./actions";
import { InviteForm } from "./invite-form";

const dateFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium" });

/** Team management (admin only, enforced by proxy + `requireAdmin`). Real layout lands in T0.5. */
export default async function EquipoPage() {
  const { tenantId } = await requireAdmin();
  const { members, pendingInvitations } = await getTeamOverview({ tenantId });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Equipo</h1>
        <p className="text-sm text-muted-foreground">
          <Link href="/app" className="underline">
            ← Volver al inicio
          </Link>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Invitar a alguien</CardTitle>
          <CardDescription>
            Crea una invitación y comparte el enlace por WhatsApp o correo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Miembros</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2" data-testid="members-list">
            {members.map((member) => (
              <li key={member.userId} className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {member.fullName || member.email}{" "}
                  <span className="text-muted-foreground">({member.email})</span>
                </span>
                <span className="text-muted-foreground">{ROLE_LABELS[member.role]}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitaciones pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="pending-invitations">
              {pendingInvitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>{invitation.email}</span>
                  <span className="text-muted-foreground">
                    {ROLE_LABELS[invitation.role]} · vence{" "}
                    {dateFormatter.format(invitation.expiresAt)}
                  </span>
                  <form action={revokeInvitationAction}>
                    <input type="hidden" name="invitationId" value={invitation.id} />
                    <Button type="submit" variant="outline" size="sm">
                      Revocar
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
