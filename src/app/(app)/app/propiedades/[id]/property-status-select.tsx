"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PropertyStatus } from "@/lib/validations/properties";
import { updatePropertyAction } from "../actions";
import { PROPERTY_STATUS_LABELS, PROPERTY_STATUSES } from "../property-helpers";

/**
 * Status changer for the property ficha (T1.8): a labeled Select over the 5 estados that calls
 * `updatePropertyAction(id, { status })` on change. Optimistic-free by design: the select shows a
 * spinner while pending and reverts (via `router.refresh()` + controlled value) if the action
 * fails, so the UI never lies about the persisted state.
 */
export function PropertyStatusSelect({
  propertyId,
  status,
}: {
  propertyId: string;
  status: PropertyStatus;
}) {
  const router = useRouter();
  const [value, setValue] = useState<PropertyStatus>(status);
  const [pending, startTransition] = useTransition();

  function handleChange(next: PropertyStatus) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const result = await updatePropertyAction(propertyId, { status: next });
      if (result.error) {
        setValue(previous);
        toast.error(result.error);
        return;
      }
      toast.success(`Estado actualizado a «${PROPERTY_STATUS_LABELS[next]}».`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="property-status" className="text-muted-foreground">
        Estado
      </Label>
      <Select
        value={value}
        onValueChange={(v) => handleChange(v as PropertyStatus)}
        disabled={pending}
        items={PROPERTY_STATUSES.map((option) => ({
          value: option,
          label: PROPERTY_STATUS_LABELS[option],
        }))}
      >
        <SelectTrigger id="property-status" className="min-w-36" data-testid="property-status-trigger">
          {pending && <Loader2 className="size-3.5 animate-spin" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROPERTY_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {PROPERTY_STATUS_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
