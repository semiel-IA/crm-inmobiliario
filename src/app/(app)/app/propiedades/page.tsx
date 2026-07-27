import Link from "next/link";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
/**
 * Links that look like buttons are styled `<Link>`s, not `<Button render={<Link/>}>`: Base UI's
 * Button either keeps `role="button"` on the anchor (destroying link semantics for assistive tech
 * and for "open in new tab") or warns that a non-`<button>` was rendered. `buttonVariants` gives
 * the same visuals while the element stays a real link.
 */
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/supabase/require-user";
import {
  OPERATION_TYPES,
  PROPERTY_STATUSES,
  PROPERTY_TYPES,
  type OperationType,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/validations/properties";
import { listProperties, type ListPropertiesFilters } from "@/server/services/properties";
import type { Property } from "@/server/db/schema";
import { PropertiesToolbar } from "./properties-toolbar";
import { PropertyWizard } from "./property-wizard";
import {
  OPERATION_TYPE_LABELS,
  PROPERTY_STATUS_BADGE_CLASS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_LABELS,
  formatPropertyLocation,
  formatPropertyPrice,
} from "./property-helpers";

const PAGE_SIZE = 10;

/**
 * Free-text search ceiling: the T1.7 service has no combined código/barrio/ciudad search filter
 * (`ListPropertiesFilters` only exposes separate `neighborhood`/`city` substrings, and nothing for
 * `internalCode`), and T1.8 must not modify the backend. So when `q` is present the page fetches
 * up to this many (already filter-narrowed) rows and matches the three fields in memory —
 * correct for MVP tenant sizes; flagged in the task report as a backend gap for a follow-up
 * `search` filter in `listProperties`.
 */
const SEARCH_SCAN_LIMIT = 200;

type SearchParams = {
  q?: string;
  tipo?: string;
  operacion?: string;
  estado?: string;
  precioMin?: string;
  precioMax?: string;
  pagina?: string;
};

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function matchesSearch(property: Property, q: string): boolean {
  const term = q.toLowerCase();
  return [property.internalCode, property.neighborhood, property.city].some((field) =>
    field?.toLowerCase().includes(term),
  );
}

export default async function PropiedadesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tenantId } = await requireUser();
  const params = await searchParams;

  const q = params.q?.trim() ?? "";
  const page = Math.max(parsePositiveInt(params.pagina) ?? 1, 1);

  const baseFilters: ListPropertiesFilters = {
    propertyType: parseEnum<PropertyType>(params.tipo, PROPERTY_TYPES),
    operationType: parseEnum<OperationType>(params.operacion, OPERATION_TYPES),
    status: parseEnum<PropertyStatus>(params.estado, PROPERTY_STATUSES),
    minPriceCop: parsePositiveInt(params.precioMin),
    maxPriceCop: parsePositiveInt(params.precioMax),
  };

  let items: Property[];
  let total: number;

  if (q) {
    const result = await listProperties(tenantId, {
      ...baseFilters,
      page: 1,
      pageSize: SEARCH_SCAN_LIMIT,
    });
    const matched = result.items.filter((property) => matchesSearch(property, q));
    total = matched.length;
    items = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    const result = await listProperties(tenantId, { ...baseFilters, page, pageSize: PAGE_SIZE });
    items = result.items;
    total = result.total;
  }

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function pageHref(target: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "pagina") next.set(key, value);
    }
    if (target > 1) next.set("pagina", String(target));
    const qs = next.toString();
    return qs ? `/app/propiedades?${qs}` : "/app/propiedades";
  }

  const hasActiveFilters = q !== "" || Object.values(baseFilters).some((v) => v !== undefined);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Propiedades</h1>
          <p className="text-sm text-muted-foreground">
            Inventario de tu inmobiliaria: {total} {total === 1 ? "propiedad" : "propiedades"}.
          </p>
        </div>
        <PropertyWizard mode="create" />
      </header>

      <PropertiesToolbar />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <Building2 className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No hay propiedades que coincidan.</p>
          <p className="text-sm text-muted-foreground">
            {hasActiveFilters
              ? "Ajusta la búsqueda o los filtros para ver más resultados."
              : "Crea tu primera propiedad con el botón «Nueva propiedad»."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl ring-1 ring-foreground/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((property) => (
                <TableRow key={property.id} data-testid={`property-row-${property.internalCode}`}>
                  <TableCell className="font-mono text-xs">{property.internalCode}</TableCell>
                  <TableCell>
                    {PROPERTY_TYPE_LABELS[property.propertyType as PropertyType]}
                  </TableCell>
                  <TableCell>
                    {OPERATION_TYPE_LABELS[property.operationType as OperationType]}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatPropertyPrice({
                      operationType: property.operationType as OperationType,
                      salePriceCop: property.salePriceCop,
                      monthlyRentCop: property.monthlyRentCop,
                    })}
                  </TableCell>
                  <TableCell>{formatPropertyLocation(property)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={PROPERTY_STATUS_BADGE_CLASS[property.status as PropertyStatus]}
                    >
                      {PROPERTY_STATUS_LABELS[property.status as PropertyStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/app/propiedades/${property.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Ver ficha
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between" aria-label="Paginación">
          <p className="text-sm text-muted-foreground">
            Mostrando {from}–{to} de {total}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Anterior
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Anterior
              </Button>
            )}
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Siguiente
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Siguiente
              </Button>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}
