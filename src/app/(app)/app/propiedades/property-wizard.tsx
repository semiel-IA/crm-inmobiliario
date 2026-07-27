"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import {
  createPropertySchema,
  OPERATION_TYPES,
  PROPERTY_TYPES,
  type OperationType,
  type PropertyType,
} from "@/lib/validations/properties";
import type { z } from "zod";
import type { Property } from "@/server/db/schema";
import { createPropertyAction, updatePropertyAction } from "./actions";
import { OwnerCombobox } from "./owner-combobox";
import {
  OPERATION_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  formatPropertyPrice,
} from "./property-helpers";

/**
 * Multi-step creation/edit wizard for properties (T1.8): step 1 (datos básicos), step 2
 * (ubicación), step 3 (características), step 4 (confirmar) → submit. Uses React Hook Form +
 * `zodResolver(createPropertySchema)` (T1.7's existing schema, including the venta/arriendo/ambas
 * pricing `superRefine`) — every step's "Siguiente" button runs `form.trigger` scoped to that
 * step's fields so pricing/enum errors surface as soon as possible, not only on final submit.
 *
 * Two fields the plan-fase-1 brief mentions for step 3 — "antigüedad" (age) — has no backing
 * column in `createPropertySchema`/`updatePropertySchema` (`src/lib/validations/properties.ts`
 * only validates the fields listed in `propertyObjectSchema`, which omits `ageYears` even though
 * the `properties` table has the column). Since T1.8 must not change the T1.7 backend, this field
 * is intentionally left out of the form rather than silently collected-and-dropped — see the task
 * report for the "ageYears backend gap" note.
 */

type StepId = "basico" | "ubicacion" | "caracteristicas" | "confirmar";

const STEPS: { id: StepId; title: string; fields: (keyof FormInput)[] }[] = [
  {
    id: "basico",
    title: "Datos básicos",
    fields: ["propertyType", "operationType", "ownerContactId", "salePriceCop", "monthlyRentCop"],
  },
  {
    id: "ubicacion",
    title: "Ubicación",
    fields: ["privateAddress", "neighborhood", "city", "department", "stratum"],
  },
  {
    id: "caracteristicas",
    title: "Características",
    fields: [
      "areaM2",
      "bedrooms",
      "bathrooms",
      "parkingSpots",
      "exclusivity",
      "exclusivityUntil",
      "commissionPercentage",
      "description",
    ],
  },
  { id: "confirmar", title: "Confirmar", fields: [] },
];

const STRATA = [1, 2, 3, 4, 5, 6];

export type PropertyForEdit = Property;

export type PropertyWizardProps =
  | { mode: "create"; property?: undefined; ownerLabel?: undefined; onSuccess?: (id: string) => void }
  | {
      mode: "edit";
      property: PropertyForEdit;
      /** "Nombre · teléfono" of the current owner, shown in the combobox before options load. */
      ownerLabel?: string;
      onSuccess?: (id: string) => void;
    };

/**
 * The schema preprocesses blank optional text fields to `undefined`, so its input and output
 * shapes differ (`z.input` has `unknown` where `z.output` has `string | undefined`). The form
 * therefore holds the INPUT shape and `handleSubmit` receives the OUTPUT shape — same
 * three-type-parameter `useForm` pattern as `contactos/contact-form.tsx`.
 */
type FormInput = z.input<typeof createPropertySchema>;
type FormOutput = z.output<typeof createPropertySchema>;

function toDefaultValues(property: PropertyForEdit | undefined): Partial<FormInput> {
  if (!property) {
    return { propertyType: "apartamento", operationType: "venta", exclusivity: false };
  }
  return {
    propertyType: property.propertyType as PropertyType,
    operationType: property.operationType as OperationType,
    ownerContactId: property.ownerContactId,
    salePriceCop: property.salePriceCop ?? undefined,
    monthlyRentCop: property.monthlyRentCop ?? undefined,
    areaM2: property.areaM2 ?? undefined,
    bedrooms: property.bedrooms ?? undefined,
    bathrooms: property.bathrooms ?? undefined,
    parkingSpots: property.parkingSpots ?? undefined,
    stratum: property.stratum ?? undefined,
    privateAddress: property.privateAddress ?? undefined,
    neighborhood: property.neighborhood ?? undefined,
    city: property.city ?? undefined,
    department: property.department ?? undefined,
    exclusivity: property.exclusivity ?? false,
    exclusivityUntil: property.exclusivityUntil ?? undefined,
    commissionPercentage:
      property.commissionPercentage != null ? Number(property.commissionPercentage) : undefined,
    description: property.description ?? undefined,
  };
}

export function PropertyWizard(props: PropertyWizardProps) {
  const { mode, onSuccess } = props;
  const property = mode === "edit" ? props.property : undefined;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | undefined>(undefined);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: toDefaultValues(property),
  });

  const { control, handleSubmit, trigger, getValues, reset, formState } = form;
  // `useWatch` instead of `form.watch`: same reactivity, but compatible with React Compiler
  // memoization (react-hooks/incompatible-library).
  const operationType = useWatch({ control, name: "operationType" });
  const exclusivity = useWatch({ control, name: "exclusivity" });

  /** Resets the whole wizard every time the dialog opens (event handler, not an effect). */
  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(toDefaultValues(property));
      setStep(0);
      setServerError(undefined);
    }
  }

  async function goNext() {
    const fields = STEPS[step].fields;
    const valid = fields.length === 0 || (await trigger(fields));
    if (valid) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  /**
   * A multi-step wizard must never submit from an intermediate step, so native form submission is
   * only honored on the last one. This covers pressing Enter inside a text input; the footer's
   * submit button is additionally a plain `type="button"` (see its comment) because by the time a
   * native submit fires, `goNext`'s `await` has already advanced `step`, making a step check alone
   * insufficient. See the E2E regression in `tests/e2e/properties.spec.ts`.
   */
  function handleFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (step !== STEPS.length - 1) {
      event.preventDefault();
      return;
    }
    void handleSubmit(onSubmit)(event);
  }

  async function onSubmit(values: FormOutput) {
    setServerError(undefined);

    if (mode === "create") {
      const result = await createPropertyAction(values);
      if (!result.data) {
        const message = result.error ?? "No se pudo crear la propiedad. Intenta de nuevo.";
        setServerError(message);
        toast.error(message);
        return;
      }
      toast.success(`Propiedad creada — código ${result.data.internalCode}.`);
      setOpen(false);
      router.refresh();
      onSuccess?.(result.data.id);
      return;
    }

    const result = await updatePropertyAction(property!.id, values);
    if (!result.data) {
      const message = result.error ?? "No se pudo actualizar la propiedad. Intenta de nuevo.";
      setServerError(message);
      toast.error(message);
      return;
    }
    toast.success("Propiedad actualizada.");
    setOpen(false);
    router.refresh();
    onSuccess?.(result.data.id);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button type="button" variant={mode === "create" ? "default" : "outline"} />}
      >
        {mode === "create" ? (
          <>
            <Plus /> Nueva propiedad
          </>
        ) : (
          "Editar"
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva propiedad" : "Editar propiedad"}</DialogTitle>
          <DialogDescription>
            Paso {step + 1} de {STEPS.length}: {STEPS[step].title}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex items-center gap-2" aria-label="Progreso del formulario">
          {STEPS.map((s, index) => (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  index === step
                    ? "bg-primary text-primary-foreground"
                    : index < step
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
                aria-current={index === step ? "step" : undefined}
              >
                {index + 1}
              </span>
              {index < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>

        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-property-type">Tipo de propiedad</Label>
                <Controller
                  control={control}
                  name="propertyType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={PROPERTY_TYPES.map((type) => ({
                        value: type,
                        label: PROPERTY_TYPE_LABELS[type],
                      }))}
                    >
                      <SelectTrigger id="wizard-property-type" className="w-full">
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {PROPERTY_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {formState.errors.propertyType && (
                  <p className="text-xs text-destructive">{formState.errors.propertyType.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-operation-type">Operación</Label>
                <Controller
                  control={control}
                  name="operationType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      items={OPERATION_TYPES.map((type) => ({
                        value: type,
                        label: OPERATION_TYPE_LABELS[type],
                      }))}
                    >
                      <SelectTrigger id="wizard-operation-type" className="w-full">
                        <SelectValue placeholder="Selecciona una operación" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {OPERATION_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {formState.errors.operationType && (
                  <p className="text-xs text-destructive">{formState.errors.operationType.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-owner">Propietario</Label>
                <Controller
                  control={control}
                  name="ownerContactId"
                  render={({ field }) => (
                    <OwnerCombobox
                      id="wizard-owner"
                      value={field.value}
                      onChange={field.onChange}
                      initialLabel={props.ownerLabel}
                      invalid={Boolean(formState.errors.ownerContactId)}
                    />
                  )}
                />
                {formState.errors.ownerContactId && (
                  <p className="text-xs text-destructive">{formState.errors.ownerContactId.message}</p>
                )}
              </div>

              {(operationType === "venta" || operationType === "ambas") && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-sale-price">Precio de venta (COP)</Label>
                  <Controller
                    control={control}
                    name="salePriceCop"
                    render={({ field }) => (
                      <Input
                        id="wizard-sale-price"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-invalid={Boolean(formState.errors.salePriceCop) || undefined}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    )}
                  />
                  {formState.errors.salePriceCop && (
                    <p className="text-xs text-destructive">{formState.errors.salePriceCop.message}</p>
                  )}
                </div>
              )}

              {(operationType === "arriendo" || operationType === "ambas") && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-rent-price">Canon de arriendo mensual (COP)</Label>
                  <Controller
                    control={control}
                    name="monthlyRentCop"
                    render={({ field }) => (
                      <Input
                        id="wizard-rent-price"
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-invalid={Boolean(formState.errors.monthlyRentCop) || undefined}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    )}
                  />
                  {formState.errors.monthlyRentCop && (
                    <p className="text-xs text-destructive">{formState.errors.monthlyRentCop.message}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-address">Dirección privada</Label>
                <Input id="wizard-address" {...form.register("privateAddress")} />
                <p className="text-xs text-muted-foreground">
                  Nunca se muestra en la ficha pública ni a otros tenants.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-neighborhood">Barrio</Label>
                <Input id="wizard-neighborhood" {...form.register("neighborhood")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-city">Ciudad</Label>
                <Input id="wizard-city" {...form.register("city")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-department">Departamento</Label>
                <Input id="wizard-department" {...form.register("department")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-stratum">Estrato</Label>
                <Controller
                  control={control}
                  name="stratum"
                  render={({ field }) => (
                    <Select
                      value={field.value ? String(field.value) : undefined}
                      onValueChange={(v) => field.onChange(Number(v))}
                      items={STRATA.map((s) => ({ value: String(s), label: `Estrato ${s}` }))}
                    >
                      <SelectTrigger id="wizard-stratum" className="w-full">
                        <SelectValue placeholder="Selecciona un estrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {STRATA.map((s) => (
                          <SelectItem key={s} value={String(s)}>
                            Estrato {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {formState.errors.stratum && (
                  <p className="text-xs text-destructive">{formState.errors.stratum.message}</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-area">Área (m²)</Label>
                  <Controller
                    control={control}
                    name="areaM2"
                    render={({ field }) => (
                      <Input
                        id="wizard-area"
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-bedrooms">Habitaciones</Label>
                  <Controller
                    control={control}
                    name="bedrooms"
                    render={({ field }) => (
                      <Input
                        id="wizard-bedrooms"
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-bathrooms">Baños</Label>
                  <Controller
                    control={control}
                    name="bathrooms"
                    render={({ field }) => (
                      <Input
                        id="wizard-bathrooms"
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    )}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-parking">Parqueaderos</Label>
                  <Controller
                    control={control}
                    name="parkingSpots"
                    render={({ field }) => (
                      <Input
                        id="wizard-parking"
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                        }
                      />
                    )}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="exclusivity"
                  render={({ field }) => (
                    <Checkbox
                      id="wizard-exclusivity"
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="wizard-exclusivity" className="font-normal">
                  Contrato de exclusividad
                </Label>
              </div>

              {exclusivity && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-exclusivity-until">Exclusividad vigente hasta</Label>
                  <Controller
                    control={control}
                    name="exclusivityUntil"
                    render={({ field }) => (
                      <Input
                        id="wizard-exclusivity-until"
                        type="date"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                      />
                    )}
                  />
                  {formState.errors.exclusivityUntil && (
                    <p className="text-xs text-destructive">
                      {formState.errors.exclusivityUntil.message}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-commission">Comisión (%)</Label>
                <Controller
                  control={control}
                  name="commissionPercentage"
                  render={({ field }) => (
                    <Input
                      id="wizard-commission"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(e.target.value === "" ? undefined : Number(e.target.value))
                      }
                    />
                  )}
                />
                {formState.errors.commissionPercentage && (
                  <p className="text-xs text-destructive">
                    {formState.errors.commissionPercentage.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="wizard-description">Descripción</Label>
                <Textarea id="wizard-description" rows={4} {...form.register("description")} />
              </div>
            </div>
          )}

          {step === 3 &&
            (() => {
              // Non-subscribing read is enough: on the confirm step no field is editable, and the
              // step switch itself re-renders this block with fresh values.
              const values = getValues();
              return (
                <div className="flex flex-col gap-2 text-sm">
                  <SummaryRow
                    label="Tipo"
                    value={PROPERTY_TYPE_LABELS[values.propertyType as PropertyType]}
                  />
                  <SummaryRow
                    label="Operación"
                    value={OPERATION_TYPE_LABELS[values.operationType as OperationType]}
                  />
                  <SummaryRow
                    label="Precio"
                    value={formatPropertyPrice({
                      operationType: values.operationType,
                      salePriceCop: values.salePriceCop ?? null,
                      monthlyRentCop: values.monthlyRentCop ?? null,
                    })}
                  />
                  <SummaryRow
                    label="Ubicación"
                    value={[values.neighborhood, values.city].filter(Boolean).join(", ") || "—"}
                  />
                  <SummaryRow
                    label="Área"
                    value={values.areaM2 != null ? `${values.areaM2} m²` : "—"}
                  />
                  <SummaryRow
                    label="Hab. / baños / parq."
                    value={`${values.bedrooms ?? "—"} / ${values.bathrooms ?? "—"} / ${values.parkingSpots ?? "—"}`}
                  />

                  {serverError && (
                    <Alert variant="destructive" role="alert" className="mt-2">
                      <AlertTitle>{serverError}</AlertTitle>
                    </Alert>
                  )}
                </div>
              );
            })()}

          <DialogFooter className="items-center sm:justify-between">
            <div>
              {step > 0 && (
                <Button type="button" variant="outline" onClick={goBack}>
                  <ChevronLeft /> Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={goNext}>
                  Siguiente <ChevronRight />
                </Button>
              ) : (
                /* Deliberately `type="button"` + explicit onClick rather than `type="submit"`:
                   React reuses this DOM node when "Siguiente" turns into this button on the last
                   step, and a native submit button would let the browser complete the default
                   submit for the very click that advanced the step — creating the property and
                   closing the dialog without ever showing the confirm step. A non-submit button
                   has no default action, so the only way to submit is a real click here. */
                <Button
                  type="button"
                  onClick={() => void handleSubmit(onSubmit)()}
                  disabled={formState.isSubmitting}
                >
                  {formState.isSubmitting && <Loader2 className="animate-spin" />}
                  {mode === "create" ? "Crear propiedad" : "Guardar cambios"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
