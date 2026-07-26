"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { listContactsAction } from "../contactos/actions";

/**
 * Owner ("propietario") combobox for the property wizard's step 1 — searches the tenant's
 * contacts by name/phone (`listContactsAction`, T1.2, already built) and lets the user pick one
 * as `ownerContactId`. Read-only consumer of the contacts module; does not render or modify
 * anything under the contacts route (T1.3 is being built in parallel by another agent).
 *
 * Label resolution: labels are cached in `labelsById` as options load / get selected — no effect
 * ever syncs state from `value` (react-hooks/set-state-in-effect). For edit mode, where `value`
 * arrives from an existing property, the caller passes `initialLabel` (the ficha already fetched
 * the owner); otherwise an unknown pre-set value renders a generic label until options load.
 */

type OwnerOption = { id: string; label: string };

export type OwnerComboboxProps = {
  value: string | undefined;
  onChange: (value: string) => void;
  /** Label to show for a `value` preset from outside (edit mode) before any options load. */
  initialLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
};

export function OwnerCombobox({
  value,
  onChange,
  initialLabel,
  disabled,
  invalid,
}: OwnerComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<OwnerOption[]>([]);
  const [labelsById, setLabelsById] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const result = await listContactsAction({ search: query || undefined, pageSize: 20 });
      if (result.data) {
        const loaded = result.data.items.map((c) => ({
          id: c.id,
          label: `${c.fullName} · ${c.phone}`,
        }));
        setOptions(loaded);
        setLabelsById((prev) => ({
          ...prev,
          ...Object.fromEntries(loaded.map((o) => [o.id, o.label])),
        }));
      }
    });
  }, [open, query]);

  const selectedLabel = value
    ? (labelsById[value] ?? initialLabel ?? "Propietario seleccionado")
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel ?? "Selecciona un propietario…"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre o teléfono…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {pending && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Buscando…
              </div>
            )}
            {!pending && <CommandEmpty>No se encontraron contactos.</CommandEmpty>}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => {
                    onChange(option.id);
                    setLabelsById((prev) => ({ ...prev, [option.id]: option.label }));
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === option.id ? "opacity-100" : "opacity-0")}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
