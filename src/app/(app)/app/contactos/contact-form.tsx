"use client";

import { useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTACT_SOURCES,
  CONTACT_TYPES,
  LEAD_STATUSES,
  createContactSchema,
} from "@/lib/validations/contacts";
import { CONTACT_SOURCE_LABELS, CONTACT_TYPE_LABELS, LEAD_STATUS_LABELS } from "./labels";

/**
 * Shared create/edit form (T1.3). Validates with `createContactSchema` in both modes — even when
 * editing, the form always collects the full shape, so submitting it always satisfies
 * `updateContactSchema` too (a `.partial()` superset). React Hook Form's `TTransformedValues`
 * generic (RHF ≥7.43) lets `register`/`Controller` work off the pre-coercion input shape (e.g.
 * `consentAt` as the `<input type="date">` string) while `handleSubmit`'s callback receives the
 * post-coercion output shape (`consentAt` as a real `Date`) — no manual conversion needed.
 */

type FormInput = z.input<typeof createContactSchema>;
type FormOutput = z.output<typeof createContactSchema>;

export type ContactFormValues = FormOutput;

const NONE = "__none__";

/** `items` maps so the Base UI Select trigger renders labels (not raw values) when closed. */
const SOURCE_SELECT_ITEMS: Record<string, string> = {
  [NONE]: "Sin especificar",
  ...CONTACT_SOURCE_LABELS,
};
const STATUS_SELECT_ITEMS: Record<string, string> = { ...LEAD_STATUS_LABELS };

function toDateInputValue(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export type ContactFormDefaults = {
  fullName?: string;
  phone?: string;
  email?: string | null;
  documentId?: string | null;
  contactTypes?: string[];
  source?: string | null;
  leadStatus?: string | null;
  notes?: string | null;
  consentAt?: Date | string | null;
  consentChannel?: string | null;
};

export function ContactForm({
  defaultValues,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
}: {
  defaultValues?: ContactFormDefaults;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (data: FormOutput) => Promise<{ error?: string }>;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | undefined>();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createContactSchema),
    defaultValues: {
      fullName: defaultValues?.fullName ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      documentId: defaultValues?.documentId ?? "",
      contactTypes: (defaultValues?.contactTypes as FormInput["contactTypes"]) ?? [],
      source: (defaultValues?.source as FormInput["source"]) ?? undefined,
      leadStatus: (defaultValues?.leadStatus as FormInput["leadStatus"]) ?? "nuevo",
      notes: defaultValues?.notes ?? "",
      consentAt: toDateInputValue(defaultValues?.consentAt ?? null) as FormInput["consentAt"],
      consentChannel: defaultValues?.consentChannel ?? "",
    },
  });

  const submitHandler: SubmitHandler<FormOutput> = async (data) => {
    setFormError(undefined);
    const result = await onSubmit(data).catch(() => ({
      error: "No se pudo guardar el contacto. Intenta de nuevo.",
    }));
    if (result.error) {
      setFormError(result.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(submitHandler)}
      className="flex flex-col gap-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" autoComplete="name" {...register("fullName")} />
          {errors.fullName && (
            <p className="text-xs text-destructive" role="alert">
              {errors.fullName.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            placeholder="+573001234567"
            autoComplete="tel"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-xs text-destructive" role="alert">
              {errors.phone.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="text-xs text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="documentId">Cédula / NIT</Label>
          <Input id="documentId" {...register("documentId")} />
          {errors.documentId && (
            <p className="text-xs text-destructive" role="alert">
              {errors.documentId.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source">Origen</Label>
          <Controller
            control={control}
            name="source"
            render={({ field }) => (
              <Select
                items={SOURCE_SELECT_ITEMS}
                value={field.value ?? NONE}
                onValueChange={(value) => field.onChange(value === NONE ? undefined : value)}
              >
                <SelectTrigger id="source" className="w-full">
                  <SelectValue placeholder="Selecciona un origen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin especificar</SelectItem>
                  {CONTACT_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {CONTACT_SOURCE_LABELS[source]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="leadStatus">Estado del lead</Label>
          <Controller
            control={control}
            name="leadStatus"
            render={({ field }) => (
              <Select
                items={STATUS_SELECT_ITEMS}
                value={field.value ?? NONE}
                onValueChange={(value) => field.onChange(value === NONE ? undefined : value)}
              >
                <SelectTrigger id="leadStatus" className="w-full">
                  <SelectValue placeholder="Selecciona un estado" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {LEAD_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Tipos de contacto</legend>
        <Controller
          control={control}
          name="contactTypes"
          render={({ field }) => (
            <div className="flex flex-wrap gap-4">
              {CONTACT_TYPES.map((type) => {
                const checked = field.value?.includes(type) ?? false;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <Checkbox
                      id={`contactTypes-${type}`}
                      checked={checked}
                      onCheckedChange={(value) => {
                        const current = field.value ?? [];
                        field.onChange(
                          value ? [...current, type] : current.filter((t) => t !== type),
                        );
                      }}
                    />
                    <Label htmlFor={`contactTypes-${type}`} className="font-normal">
                      {CONTACT_TYPE_LABELS[type]}
                    </Label>
                  </div>
                );
              })}
            </div>
          )}
        />
        {errors.contactTypes && (
          <p className="text-xs text-destructive" role="alert">
            {errors.contactTypes.message}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" rows={3} {...register("notes")} />
        {errors.notes && (
          <p className="text-xs text-destructive" role="alert">
            {errors.notes.message}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-medium">Consentimiento habeas data</legend>
        <p className="text-xs text-muted-foreground">
          Registra la fecha y el canal donde el contacto autorizó el tratamiento de sus datos.
          Ambos campos son opcionales, pero deben diligenciarse juntos.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consentAt">Fecha de consentimiento</Label>
            {/* `setValueAs`: an untouched date input submits "", which `z.coerce.date()` turns
                into an Invalid Date (the schema's `emptyToUndefined` preprocess doesn't cover
                `consentAt`) — map it to `undefined` so "no consent" passes validation. */}
            <Input
              id="consentAt"
              type="date"
              {...register("consentAt", {
                setValueAs: (value) => (value === "" ? undefined : value),
              })}
            />
            {errors.consentAt && (
              <p className="text-xs text-destructive" role="alert">
                {errors.consentAt.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consentChannel">Canal</Label>
            <Input
              id="consentChannel"
              placeholder="WhatsApp, formulario web…"
              {...register("consentChannel")}
            />
            {errors.consentChannel && (
              <p className="text-xs text-destructive" role="alert">
                {errors.consentChannel.message}
              </p>
            )}
          </div>
        </div>
      </fieldset>

      {formError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{formError}</AlertTitle>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
