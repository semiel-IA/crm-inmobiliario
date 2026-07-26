"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CONTACT_SOURCES,
  CONTACT_TYPES,
  LEAD_STATUSES,
  type ContactSource,
  type ContactType,
  type LeadStatus,
} from "@/lib/validations/contacts";
import type { Contact } from "@/server/db/schema";
import { listContactsAction } from "./actions";
import { ContactFormDialog } from "./contact-form-dialog";
import {
  CONTACT_SOURCE_LABELS,
  CONTACT_TYPE_LABELS,
  LEAD_STATUS_BADGE_VARIANT,
  LEAD_STATUS_LABELS,
} from "./labels";

const PAGE_SIZE = 10;
const ALL = "__all__";

/** `items` maps for the Base UI Selects so the closed trigger renders the label, not the raw
 * value (without `items`, Base UI shows the value string, e.g. `__all__`). */
const SOURCE_SELECT_ITEMS: Record<string, string> = {
  [ALL]: "Todos",
  ...CONTACT_SOURCE_LABELS,
};
const STATUS_SELECT_ITEMS: Record<string, string> = {
  [ALL]: "Todos",
  ...LEAD_STATUS_LABELS,
};

export type MemberOption = { userId: string; fullName: string; email: string };

/** Listing page for contacts (T1.3): search + filters + pagination, all driven client-side by
 * calling `listContactsAction` (T1.2) directly — no separate API route needed since Server
 * Actions are callable straight from a client component. */
type ListSnapshot = {
  /** Query key this snapshot answers — compared against the current key to derive `loading`. */
  queryKey: string;
  items: Contact[];
  total: number;
  error?: string;
};

export function ContactsList({ members }: { members: MemberOption[] }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [contactTypes, setContactTypes] = useState<ContactType[]>([]);
  const [source, setSource] = useState<ContactSource | undefined>();
  const [leadStatus, setLeadStatus] = useState<LeadStatus | undefined>();
  const [page, setPage] = useState(1);

  // Single snapshot state, only ever set from async callbacks (never synchronously inside an
  // effect body — see react-hooks/set-state-in-effect). `loading` is derived, not stored.
  const [snapshot, setSnapshot] = useState<ListSnapshot | null>(null);

  const queryKey = useMemo(
    () => JSON.stringify([debouncedSearch, contactTypes, source, leadStatus, page]),
    [debouncedSearch, contactTypes, source, leadStatus, page],
  );

  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of members) {
      map.set(member.userId, member.fullName || member.email);
    }
    return map;
  }, [members]);

  // Debounce the search box (300ms) so we don't fire an action on every keystroke. The page
  // reset lives in the same async callback: a new search term always restarts at page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch((previous) => {
        const next = search.trim();
        if (next !== previous) setPage(1);
        return next;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    listContactsAction({
      search: debouncedSearch || undefined,
      contactTypes: contactTypes.length > 0 ? contactTypes : undefined,
      source,
      leadStatus,
      page,
      pageSize: PAGE_SIZE,
    }).then((result) => {
      if (cancelled) return;
      setSnapshot({
        queryKey,
        items: result.data?.items ?? [],
        total: result.data?.total ?? 0,
        error: result.error,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [queryKey, debouncedSearch, contactTypes, source, leadStatus, page]);

  const loading = snapshot === null || snapshot.queryKey !== queryKey;
  const items = snapshot?.items ?? [];
  const total = snapshot?.total ?? 0;
  const error = snapshot?.queryKey === queryKey ? snapshot.error : undefined;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters =
    debouncedSearch !== "" || contactTypes.length > 0 || Boolean(source) || Boolean(leadStatus);

  function toggleContactType(type: ContactType, checked: boolean) {
    setContactTypes((current) =>
      checked ? [...current, type] : current.filter((t) => t !== type),
    );
    setPage(1);
  }

  function upsertItem(contact: Contact) {
    setSnapshot((current) => {
      if (!current) return current;
      const exists = current.items.some((item) => item.id === contact.id);
      if (exists) {
        return {
          ...current,
          items: current.items.map((item) => (item.id === contact.id ? contact : item)),
        };
      }
      // Newly created contact: bump the count and prepend when looking at page 1 with no
      // filters (otherwise the new row may not belong on the currently visible page).
      return {
        ...current,
        total: current.total + 1,
        items:
          page === 1 && !hasFilters
            ? [contact, ...current.items].slice(0, PAGE_SIZE)
            : current.items,
      };
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Contactos</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona tus leads y contactos: alta rápida, tipos múltiples y asignación a agentes.
          </p>
        </div>
        <ContactFormDialog
          mode="create"
          trigger={
            <Button type="button">
              <Plus data-icon="inline-start" />
              Nuevo contacto
            </Button>
          }
          onSaved={upsertItem}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Buscar y filtrar</CardTitle>
          <CardDescription>Busca por nombre o teléfono, o combina los filtros.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Buscar por nombre o teléfono…"
              aria-label="Buscar contactos por nombre o teléfono"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-8"
            />
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Tipo de contacto</legend>
              <div className="flex flex-wrap gap-4">
                {CONTACT_TYPES.map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`filter-type-${type}`}
                      checked={contactTypes.includes(type)}
                      onCheckedChange={(checked) => toggleContactType(type, Boolean(checked))}
                    />
                    <Label htmlFor={`filter-type-${type}`} className="font-normal">
                      {CONTACT_TYPE_LABELS[type]}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-source">Origen</Label>
              <Select
                items={SOURCE_SELECT_ITEMS}
                value={source ?? ALL}
                onValueChange={(value) => {
                  setSource(value === ALL ? undefined : (value as ContactSource));
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-source" className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {CONTACT_SOURCES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {CONTACT_SOURCE_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filter-status">Estado del lead</Label>
              <Select
                items={STATUS_SELECT_ITEMS}
                value={leadStatus ?? ALL}
                onValueChange={(value) => {
                  setLeadStatus(value === ALL ? undefined : (value as LeadStatus));
                  setPage(1);
                }}
              >
                <SelectTrigger id="filter-status" className="w-48">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {LEAD_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LEAD_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {!loading && items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
              <p className="text-sm font-medium">
                {hasFilters ? "No hay contactos con estos filtros." : "No hay contactos todavía."}
              </p>
              <p className="text-sm text-muted-foreground">
                {hasFilters
                  ? "Ajusta la búsqueda o los filtros para ver más resultados."
                  : "Crea tu primer contacto con el botón “Nuevo contacto”."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Tipos</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Cargando contactos…
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/app/contactos/${contact.id}`}
                          className="hover:underline focus-visible:underline"
                        >
                          {contact.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{contact.phone}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.contactTypes.map((type) => (
                            <Badge key={type} variant="outline">
                              {CONTACT_TYPE_LABELS[type as ContactType] ?? type}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.source
                          ? (CONTACT_SOURCE_LABELS[contact.source as ContactSource] ??
                            contact.source)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={LEAD_STATUS_BADGE_VARIANT[contact.leadStatus as LeadStatus]}>
                          {LEAD_STATUS_LABELS[contact.leadStatus as LeadStatus] ??
                            contact.leadStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {contact.assignedAgentId
                          ? (memberName.get(contact.assignedAgentId) ?? "—")
                          : "Sin asignar"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/app/contactos/${contact.id}`} />}
                          >
                            Ver
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "contacto" : "contactos"} · página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
