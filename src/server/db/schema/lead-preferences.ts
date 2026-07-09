import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers, tenants } from "./core";
import { contacts } from "./contacts";

/**
 * What a lead (contact) is looking for: one row per operation a contact is interested in. A
 * "mixed" contact (`contacts.contactTypes` containing both `comprador` and `arrendatario`) may
 * have up to two rows here — one per `operationType` — since a lead can want to buy and rent at
 * the same time (see the T1.1 seed data). No uniqueness constraint on `contactId` alone is
 * enforced for that reason; `(tenant_id, contact_id, operation_type)` is unique instead.
 *
 * `propertyTypes` reuses the exact same Spanish enum tokens as `properties.propertyType` (see
 * `src/server/db/schema/properties.ts`) so a lead's preferences can be compared against listing
 * types without a translation layer, even though matching itself is manual in the F1 MVP (see
 * `docs/plan-fase-1-mvp.md`, "Matching" cut from scope).
 */
export const leadPreferences = pgTable(
  "lead_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    operationType: text("operation_type").notNull(),
    propertyTypes: text("property_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    zones: text("zones")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** COP, whole pesos. `bigint`/`mode: "number"` mirrors `properties.salePriceCop` — a plain
     * `integer` (as the task brief suggested) would overflow above ~2.1B COP, which luxury
     * listings can exceed. */
    budgetMinCop: bigint("budget_min_cop", { mode: "number" }),
    budgetMaxCop: bigint("budget_max_cop", { mode: "number" }),
    minBedrooms: smallint("min_bedrooms"),
    minBathrooms: smallint("min_bathrooms"),
    minParkingSpots: smallint("min_parking_spots"),
    /** Colombian socioeconomic stratum range, 1–6. */
    minStratum: smallint("min_stratum"),
    maxStratum: smallint("max_stratum"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Nullable: rows seeded/backfilled server-side have no creating user. */
    createdBy: uuid("created_by").references(() => authUsers.id),
  },
  (table) => [
    index("lead_preferences_tenant_id_idx").on(table.tenantId, table.id),
    index("lead_preferences_tenant_contact_idx").on(table.tenantId, table.contactId),
    check(
      "lead_preferences_operation_type_check",
      sql`${table.operationType} in ('venta', 'arriendo')`,
    ),
    check(
      "lead_preferences_property_types_check",
      sql`${table.propertyTypes} <@ ARRAY['apartamento', 'casa', 'lote', 'local', 'oficina', 'bodega', 'finca']::text[]`,
    ),
    check(
      "lead_preferences_budget_range_check",
      sql`${table.budgetMinCop} is null or ${table.budgetMaxCop} is null or ${table.budgetMinCop} < ${table.budgetMaxCop}`,
    ),
    check(
      "lead_preferences_budget_non_negative_check",
      sql`(${table.budgetMinCop} is null or ${table.budgetMinCop} >= 0) and (${table.budgetMaxCop} is null or ${table.budgetMaxCop} >= 0)`,
    ),
    check(
      "lead_preferences_min_bedrooms_non_negative_check",
      sql`${table.minBedrooms} is null or ${table.minBedrooms} >= 0`,
    ),
    check(
      "lead_preferences_min_bathrooms_non_negative_check",
      sql`${table.minBathrooms} is null or ${table.minBathrooms} >= 0`,
    ),
    check(
      "lead_preferences_min_parking_non_negative_check",
      sql`${table.minParkingSpots} is null or ${table.minParkingSpots} >= 0`,
    ),
    check(
      "lead_preferences_stratum_range_check",
      sql`(${table.minStratum} is null or (${table.minStratum} between 1 and 6))
        and (${table.maxStratum} is null or (${table.maxStratum} between 1 and 6))
        and (${table.minStratum} is null or ${table.maxStratum} is null or ${table.minStratum} <= ${table.maxStratum})`,
    ),
    // Not a hard "one preference per contact": a mixed buyer+renter contact may have one row per
    // operation. This still rejects accidental duplicate rows for the same contact + operation.
    uniqueIndex("lead_preferences_tenant_contact_operation_unique_idx").on(
      table.tenantId,
      table.contactId,
      table.operationType,
    ),
  ],
);

export type LeadPreference = typeof leadPreferences.$inferSelect;
export type NewLeadPreference = typeof leadPreferences.$inferInsert;
