"use client";

import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createLeadPreferenceSchema,
  type LeadPreferenceOperationType,
} from "@/lib/validations/lead-preferences";
import { PROPERTY_TYPES } from "@/lib/validations/properties";
import type { LeadPreference } from "@/server/db/schema";
import { createLeadPreferenceAction, updateLeadPreferenceAction } from "./actions";
import { PROPERTY_TYPE_LABELS } from "../propiedades/property-helpers";
import { formatZonesInput, parseZonesInput, preferenceToFormDefaults } from "./lead-preference-helpers";

/**
 * Sub-form for ONE operation's lead preferences ("venta" or "arriendo") — T1.5. `operationType` is
 * fixed by the caller (the tab it's rendered under, see `LeadPreferencesPanel`); it's part of
 * `defaultValues` but never re-registered on an input, so it can't drift from the tab it belongs
 * to. Validates with `createLeadPreferenceSchema` in both create and edit mode, same pattern as
 * `ContactForm` (T1.3): the full-shape schema is a strict superset of `updateLeadPreferenceSchema`
 * (`.partial()`), so passing it always satisfies the update schema too — and reusing it here means
 * we never duplicate T1.4's validation rules (budget/stratum ranges) in the client.
 */

type FormInput = z.input<typeof createLeadPreferenceSchema>;
type FormOutput = z.output<typeof createLeadPreferenceSchema>;

/** `register(...)`-friendly coercion for the optional smallint/bigint number fields: an empty
 * input submits `""`, which must become `undefined` (not `NaN`) so "not set" passes validation. */
function optionalNumberField() {
  return {
    setValueAs: (value: unknown) => {
      if (value === "" || value === null || value === undefined) return undefined;
      const num = Number(value);
      return Number.isNaN(num) ? undefined : num;
    },
  };
}

export function LeadPreferenceForm({
  contactId,
  operationType,
  preference,
  onSaved,
}: {
  contactId: string;
  operationType: LeadPreferenceOperationType;
  preference: LeadPreference | null;
  onSaved: (preference: LeadPreference) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createLeadPreferenceSchema),
    defaultValues: preferenceToFormDefaults(operationType, preference),
  });

  const submitHandler: SubmitHandler<FormOutput> = async (data) => {
    const result = preference
      ? await updateLeadPreferenceAction(preference.id, data)
      : await createLeadPreferenceAction(contactId, data);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.data) {
      toast.success("Preferencias guardadas.");
      onSaved(result.data);
      reset(preferenceToFormDefaults(operationType, result.data));
    }
  };

  return (
    <form onSubmit={handleSubmit(submitHandler)} className="flex flex-col gap-4" noValidate>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tipos de inmueble</legend>
        <Controller
          control={control}
          name="propertyTypes"
          render={({ field }) => (
            <div className="flex flex-wrap gap-4">
              {PROPERTY_TYPES.map((type) => {
                const checked = field.value?.includes(type) ?? false;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`${operationType}-propertyTypes-${type}`}
                      checked={checked}
                      onCheckedChange={(value) => {
                        const current = field.value ?? [];
                        field.onChange(
                          value ? [...current, type] : current.filter((t) => t !== type),
                        );
                      }}
                    />
                    <Label
                      htmlFor={`${operationType}-propertyTypes-${type}`}
                      className="font-normal"
                    >
                      {PROPERTY_TYPE_LABELS[type]}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        />
        {errors.propertyTypes && (
          <p className="text-xs text-destructive" role="alert">
            {errors.propertyTypes.message}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${operationType}-zones`}>Zonas / barrios</Label>
        <Controller
          control={control}
          name="zones"
          render={({ field }) => (
            <Textarea
              id={`${operationType}-zones`}
              rows={2}
              placeholder="El Poblado, Laureles, Envigado…"
              value={formatZonesInput(field.value)}
              onChange={(event) => field.onChange(parseZonesInput(event.target.value))}
            />
          )}
        />
        <p className="text-xs text-muted-foreground">Sepáralas con comas.</p>
        {errors.zones && (
          <p className="text-xs text-destructive" role="alert">
            {errors.zones.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${operationType}-budgetMinCop`}>Presupuesto mínimo (COP)</Label>
          <Input
            id={`${operationType}-budgetMinCop`}
            type="number"
            inputMode="numeric"
            min={0}
            {...register("budgetMinCop", optionalNumberField())}
          />
          {errors.budgetMinCop && (
            <p className="text-xs text-destructive" role="alert">
              {errors.budgetMinCop.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${operationType}-budgetMaxCop`}>Presupuesto máximo (COP)</Label>
          <Input
            id={`${operationType}-budgetMaxCop`}
            type="number"
            inputMode="numeric"
            min={0}
            {...register("budgetMaxCop", optionalNumberField())}
          />
          {errors.budgetMaxCop && (
            <p className="text-xs text-destructive" role="alert">
              {errors.budgetMaxCop.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${operationType}-minBedrooms`}>Habitaciones mín.</Label>
          <Input
            id={`${operationType}-minBedrooms`}
            type="number"
            inputMode="numeric"
            min={0}
            {...register("minBedrooms", optionalNumberField())}
          />
          {errors.minBedrooms && (
            <p className="text-xs text-destructive" role="alert">
              {errors.minBedrooms.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${operationType}-minBathrooms`}>Baños mín.</Label>
          <Input
            id={`${operationType}-minBathrooms`}
            type="number"
            inputMode="numeric"
            min={0}
            {...register("minBathrooms", optionalNumberField())}
          />
          {errors.minBathrooms && (
            <p className="text-xs text-destructive" role="alert">
              {errors.minBathrooms.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${operationType}-minParkingSpots`}>Parqueaderos mín.</Label>
          <Input
            id={`${operationType}-minParkingSpots`}
            type="number"
            inputMode="numeric"
            min={0}
            {...register("minParkingSpots", optionalNumberField())}
          />
          {errors.minParkingSpots && (
            <p className="text-xs text-destructive" role="alert">
              {errors.minParkingSpots.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${operationType}-minStratum`}>Estrato mínimo</Label>
          <Input
            id={`${operationType}-minStratum`}
            type="number"
            inputMode="numeric"
            min={1}
            max={6}
            {...register("minStratum", optionalNumberField())}
          />
          {errors.minStratum && (
            <p className="text-xs text-destructive" role="alert">
              {errors.minStratum.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${operationType}-maxStratum`}>Estrato máximo</Label>
          <Input
            id={`${operationType}-maxStratum`}
            type="number"
            inputMode="numeric"
            min={1}
            max={6}
            {...register("maxStratum", optionalNumberField())}
          />
          {errors.maxStratum && (
            <p className="text-xs text-destructive" role="alert">
              {errors.maxStratum.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando…" : "Guardar preferencias"}
        </Button>
      </div>
    </form>
  );
}
