import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "./core";
import { tenants } from "./core";

/**
 * A person tracked by a tenant: a buyer, tenant, owner, or any combination (`contactTypes`).
 * Minimal prerequisite for T1.6 (`properties.ownerContactId` is a required FK into this table) —
 * created ahead of its own task, T1.1, because `properties` cannot exist without an owner to
 * reference. Field set matches the T1.1 spec in `docs/plan-fase-1-mvp.md` §T1.1 /
 * `docs/plan-maestro.md` §3 exactly, so T1.1 only needs to add `lead_preferences` + the service/UI
 * layers — not touch this table. See `docs/decisiones.md` ADR-011.
 */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    /** E.164, e.g. `+573001234567` — see `isValidE164` in `src/lib/format.ts`. */
    phone: text("phone").notNull(),
    email: text("email"),
    /** Cédula de ciudadanía or NIT, free-form (no fixed Colombian format enforced here). */
    documentId: text("document_id"),
    /** A person can be more than one of these at once. */
    contactTypes: text("contact_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    source: text("source"),
    /** `auth.users.id` of the agent this lead/contact is assigned to; null when unassigned. */
    assignedAgentId: uuid("assigned_agent_id").references(() => authUsers.id),
    leadStatus: text("lead_status").notNull().default("nuevo"),
    /** Habeas data consent timestamp; null means consent has not been captured yet. */
    consentAt: timestamp("consent_at", { withTimezone: true }),
    consentChannel: text("consent_channel"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    /** Nullable: rows seeded/backfilled server-side have no creating user. */
    createdBy: uuid("created_by").references(() => authUsers.id),
  },
  (table) => [
    index("contacts_tenant_id_idx").on(table.tenantId, table.id),
    index("contacts_tenant_created_idx").on(table.tenantId, table.createdAt.desc()),
    index("contacts_tenant_lead_status_idx").on(table.tenantId, table.leadStatus),
    check(
      "contacts_lead_status_check",
      sql`${table.leadStatus} in ('nuevo', 'contactado', 'calificado', 'inactivo')`,
    ),
    check(
      "contacts_source_check",
      sql`${table.source} is null or ${table.source} in ('portal', 'referido', 'redes', 'fachada', 'whatsapp', 'web')`,
    ),
    check(
      "contacts_types_check",
      sql`${table.contactTypes} <@ ARRAY['comprador', 'arrendatario', 'propietario']::text[]`,
    ),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
