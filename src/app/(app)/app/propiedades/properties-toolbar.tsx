"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  OPERATION_TYPE_LABELS,
  OPERATION_TYPES,
  PROPERTY_STATUS_LABELS,
  PROPERTY_STATUSES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
} from "./property-helpers";

/**
 * Search + filter toolbar for the properties list (T1.8). All state lives in the URL's
 * searchParams (deep-linkable, survives back navigation); the server component re-queries via
 * `listProperties` on each change. Search input is debounced 400ms so typing doesn't fire a
 * navigation per keystroke.
 */

const ALL = "todos";

export function PropertiesToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("precioMin") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("precioMax") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function setParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "" || value === ALL) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("pagina"); // any filter change resets pagination
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  // Debounced text inputs → URL.
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      const currentMin = searchParams.get("precioMin") ?? "";
      const currentMax = searchParams.get("precioMax") ?? "";
      if (search !== current || minPrice !== currentMin || maxPrice !== currentMax) {
        setParams({ q: search, precioMin: minPrice, precioMax: maxPrice });
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, minPrice, maxPrice]);

  const tipo = searchParams.get("tipo") ?? ALL;
  const operacion = searchParams.get("operacion") ?? ALL;
  const estado = searchParams.get("estado") ?? ALL;

  const hasFilters =
    Boolean(searchParams.get("q")) ||
    tipo !== ALL ||
    operacion !== ALL ||
    estado !== ALL ||
    Boolean(searchParams.get("precioMin")) ||
    Boolean(searchParams.get("precioMax"));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="properties-search">Buscar</Label>
          <div className="relative">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="properties-search"
              type="search"
              placeholder="Código, barrio o ciudad…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:flex md:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-tipo">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setParams({ tipo: v as string })}
              items={[
                { value: ALL, label: "Todos" },
                ...PROPERTY_TYPES.map((type) => ({ value: type, label: PROPERTY_TYPE_LABELS[type] })),
              ]}
            >
              <SelectTrigger id="filter-tipo" className="w-full md:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {PROPERTY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {PROPERTY_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-operacion">Operación</Label>
            <Select
              value={operacion}
              onValueChange={(v) => setParams({ operacion: v as string })}
              items={[
                { value: ALL, label: "Todas" },
                ...OPERATION_TYPES.map((type) => ({
                  value: type,
                  label: OPERATION_TYPE_LABELS[type],
                })),
              ]}
            >
              <SelectTrigger id="filter-operacion" className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {OPERATION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {OPERATION_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-estado">Estado</Label>
            <Select
              value={estado}
              onValueChange={(v) => setParams({ estado: v as string })}
              items={[
                { value: ALL, label: "Todos" },
                ...PROPERTY_STATUSES.map((status) => ({
                  value: status,
                  label: PROPERTY_STATUS_LABELS[status],
                })),
              ]}
            >
              <SelectTrigger id="filter-estado" className="w-full md:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                {PROPERTY_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {PROPERTY_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-precio-min">Precio desde (COP)</Label>
          <Input
            id="filter-precio-min"
            type="number"
            min={0}
            inputMode="numeric"
            className="w-40"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-precio-max">Precio hasta (COP)</Label>
          <Input
            id="filter-precio-max"
            type="number"
            min={0}
            inputMode="numeric"
            className="w-40"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setMinPrice("");
              setMaxPrice("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            <X /> Limpiar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
