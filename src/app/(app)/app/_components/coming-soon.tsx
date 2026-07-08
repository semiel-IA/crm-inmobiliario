import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Minimal placeholder for modules not built yet (Contactos, Propiedades, Negocios, Agenda — see
 * `docs/plan-maestro.md` §4). The `_components` folder is excluded from routing by Next.js's
 * leading-underscore convention.
 */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Próximamente</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
