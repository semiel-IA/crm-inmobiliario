import type { LeadPreferenceOperationType } from "@/lib/validations/lead-preferences";
import type { PropertyType } from "@/lib/validations/properties";
import type { LeadPreference } from "@/server/db/schema";

/**
 * Pure presentation/mapping helpers for the lead-preferences sub-form (T1.5), kept separate from
 * the form component so the non-trivial logic (zones text <-> array, row -> form defaults) is
 * unit-testable without rendering React — same pattern as
 * `src/app/(app)/app/propiedades/property-helpers.ts`.
 */

export const LEAD_PREFERENCE_OPERATION_LABELS: Record<LeadPreferenceOperationType, string> = {
  venta: "Venta",
  arriendo: "Arriendo",
};

/** Splits the free-text "zones" textarea (comma-separated) into the trimmed, non-empty string[]
 * the Zod schema expects. Stray/double commas and surrounding whitespace are tolerated. */
export function parseZonesInput(text: string): string[] {
  return text
    .split(",")
    .map((zone) => zone.trim())
    .filter((zone) => zone.length > 0);
}

/** Joins a zones array back into the comma-separated text shown in the textarea. */
export function formatZonesInput(zones: string[] | undefined): string {
  return (zones ?? []).join(", ");
}

export type LeadPreferenceFormDefaults = {
  operationType: LeadPreferenceOperationType;
  propertyTypes: PropertyType[];
  zones: string[];
  budgetMinCop?: number;
  budgetMaxCop?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minParkingSpots?: number;
  minStratum?: number;
  maxStratum?: number;
};

/** Builds the React Hook Form `defaultValues` for one operation's sub-form: empty defaults when
 * the contact has no row yet for `operationType` (create mode), or the existing row's fields
 * mapped over (edit mode) — nullable DB columns become `undefined` so RHF/Zod treat them as
 * "not set" rather than `null`. */
export function preferenceToFormDefaults(
  operationType: LeadPreferenceOperationType,
  preference: LeadPreference | null,
): LeadPreferenceFormDefaults {
  if (!preference) {
    return { operationType, propertyTypes: [], zones: [] };
  }

  return {
    operationType,
    propertyTypes: (preference.propertyTypes ?? []) as PropertyType[],
    zones: preference.zones ?? [],
    budgetMinCop: preference.budgetMinCop ?? undefined,
    budgetMaxCop: preference.budgetMaxCop ?? undefined,
    minBedrooms: preference.minBedrooms ?? undefined,
    minBathrooms: preference.minBathrooms ?? undefined,
    minParkingSpots: preference.minParkingSpots ?? undefined,
    minStratum: preference.minStratum ?? undefined,
    maxStratum: preference.maxStratum ?? undefined,
  };
}
