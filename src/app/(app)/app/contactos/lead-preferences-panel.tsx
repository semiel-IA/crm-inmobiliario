"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEAD_PREFERENCE_OPERATION_TYPES } from "@/lib/validations/lead-preferences";
import type { LeadPreference } from "@/server/db/schema";
import { LeadPreferenceForm } from "./lead-preference-form";
import { LEAD_PREFERENCE_OPERATION_LABELS } from "./lead-preference-helpers";

/**
 * Ficha de contacto (T1.5): edits both operation types' preferences without one overwriting the
 * other. A contact can have up to two `lead_preferences` rows — one per `operationType` (see
 * `src/server/services/lead-preferences.ts`) — so this renders one tab per operation, each with
 * its own independent `LeadPreferenceForm` bound to its own row (or `null` when the contact has
 * no row yet for that operation, i.e. "create" mode for that tab). Tabs were chosen over two
 * stacked sections to keep the ficha compact — the two forms share every field except
 * `operationType`, so showing both open at once mostly duplicates screen space without adding
 * information.
 */
export function LeadPreferencesPanel({
  contactId,
  preferences: initialPreferences,
}: {
  contactId: string;
  preferences: LeadPreference[];
}) {
  const [preferences, setPreferences] = useState(initialPreferences);

  function byOperation(operationType: (typeof LEAD_PREFERENCE_OPERATION_TYPES)[number]) {
    return preferences.find((preference) => preference.operationType === operationType) ?? null;
  }

  function handleSaved(updated: LeadPreference) {
    setPreferences((current) => [
      ...current.filter((preference) => preference.operationType !== updated.operationType),
      updated,
    ]);
  }

  return (
    <Tabs defaultValue={LEAD_PREFERENCE_OPERATION_TYPES[0]}>
      <TabsList>
        {LEAD_PREFERENCE_OPERATION_TYPES.map((operationType) => {
          const existing = byOperation(operationType);
          return (
            <TabsTrigger key={operationType} value={operationType}>
              {LEAD_PREFERENCE_OPERATION_LABELS[operationType]}
              {!existing && (
                <span className="text-muted-foreground"> (sin registrar)</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {LEAD_PREFERENCE_OPERATION_TYPES.map((operationType) => (
        <TabsContent key={operationType} value={operationType} className="pt-4">
          <LeadPreferenceForm
            contactId={contactId}
            operationType={operationType}
            preference={byOperation(operationType)}
            onSaved={handleSaved}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
