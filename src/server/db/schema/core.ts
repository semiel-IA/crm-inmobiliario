import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Reference-only declaration of Supabase Auth's `auth.users` table, needed so
 * `memberships.user_id` can carry a real foreign key. This project never creates, alters, or
 * migrates this table — Supabase Auth owns its lifecycle entirely.
 */
export const authUsers = pgSchema("auth").table("users", {
  id: uuid("id").primaryKey(),
});

/**
 * Subscription plans. Global catalog, not tenant-scoped: every tenant references one row here.
 * Prices are publicly readable (see the RLS migration), so no PII belongs on this table.
 */
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  priceCop: integer("price_cop").notNull(),
  maxUsers: integer("max_users").notNull(),
  /** Null means unlimited properties (the "Inmobiliaria" plan). */
  maxProperties: integer("max_properties"),
  features: jsonb("features").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A tenant (real-estate agency). Root of row-level multi-tenancy: every business table below
 * references `tenants.id` via its own `tenant_id` column, enforced by RLS.
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    nit: text("nit"),
    city: text("city"),
    logoUrl: text("logo_url"),
    config: jsonb("config").notNull().default({}),
    status: text("status").notNull().default("trial"),
    planId: uuid("plan_id").references(() => plans.id),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "tenants_status_check",
      sql`${table.status} in ('trial', 'active', 'suspended', 'canceled')`,
    ),
  ],
);

/**
 * Links a Supabase Auth user to a tenant with a role. `tenant_id` and `role` are mirrored into
 * the user's JWT `app_metadata` at membership-creation time (T0.4, service_role) so RLS policies
 * can read them via `public.current_tenant_id()` / `public.current_member_role()` without an
 * extra query (see ADR-003).
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("memberships_tenant_user_unique").on(table.tenantId, table.userId),
    index("memberships_tenant_role_idx").on(table.tenantId, table.role),
    index("memberships_user_idx").on(table.userId),
    check("memberships_role_check", sql`${table.role} in ('admin', 'agent', 'assistant')`),
    check(
      "memberships_status_check",
      sql`${table.status} in ('invited', 'active', 'disabled')`,
    ),
  ],
);

/**
 * Append-only audit trail per tenant. No `updated_at`: rows are never mutated after insert.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_log_tenant_created_idx").on(table.tenantId, table.createdAt.desc())],
);
