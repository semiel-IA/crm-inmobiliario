import { and, desc, eq, ilike, like, sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import {
  contacts,
  properties,
  propertyDocuments,
  propertyMedia,
  type Property,
  type PropertyDocument,
  type PropertyMedia,
} from "@/server/db/schema";
import {
  createPropertySchema,
  getOperationPricingIssues,
  updatePropertySchema,
  type OperationType,
  type PropertyStatus,
  type PropertyType,
} from "@/lib/validations/properties";

/**
 * Business logic for the properties module (T1.7): validation, internal-code generation,
 * CRUD and listing. Every function takes `tenantId` explicitly and filters by it in every
 * query — defense in depth on top of RLS, since these run with the service-role `db` (bypasses
 * RLS) via Server Actions that already resolved `tenantId` from a verified session
 * (`requireUser`, ADR-003).
 */

export type PropertyServiceErrorCode =
  "validation" | "owner_not_found" | "not_found" | "code_generation_failed";

/** Typed business error for the properties service; `code` drives the message shown to the user. */
export class PropertyServiceError extends Error {
  readonly code: PropertyServiceErrorCode;
  /** Every violated-field message, when the error comes from a multi-issue Zod/business check. */
  readonly issues?: string[];

  constructor(message: string, code: PropertyServiceErrorCode, issues?: string[]) {
    super(message);
    this.name = "PropertyServiceError";
    this.code = code;
    this.issues = issues;
  }
}

type PropertiesDeps = {
  db?: ReturnType<typeof getDb>;
};

const CODE_SEQUENTIAL_WIDTH = 4;
const MAX_CODE_GENERATION_ATTEMPTS = 5;
const UNIQUE_CODE_CONSTRAINT = "properties_tenant_internal_code_unique";
const DEFAULT_PAGE_SIZE = 20;

function parseSequential(internalCode: string): number {
  const match = /-(\d+)$/.exec(internalCode);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Computes the next sequential internal-code candidate for `tenantId`
 * (`${tenantId.slice(0, 8)}-NNNN`, zero-padded to 4 digits — grows past 4 digits unpadded once
 * a tenant passes 9999 properties, which the plan's biggest tier does not cap). Reads the current
 * max sequential suffix among this tenant's existing codes (ordered by the numeric suffix, not
 * lexicographically, so it stays correct once codes grow past 4 digits) and returns max + 1, or 1
 * when the tenant has none yet.
 *
 * Concurrency strategy: this function alone is NOT safe against a race (two concurrent calls can
 * return the same candidate) — there is no separate sequence table or advisory lock. Safety comes
 * from `createProperty`, which relies on the DB's `properties_tenant_internal_code_unique`
 * constraint as the source of truth: if the insert fails with a unique violation on that
 * constraint, it calls this function again (now seeing the competing row that just landed) and
 * retries the insert, up to `MAX_CODE_GENERATION_ATTEMPTS` times. This "optimistic generate +
 * retry-on-conflict" approach is simpler than a lock and correct because the DB constraint is the
 * actual arbiter, not the in-app computation.
 */
export async function generatePropertyCode(
  tenantId: string,
  deps: PropertiesDeps = {},
): Promise<string> {
  const db = deps.db ?? getDb();
  const prefix = tenantId.slice(0, 8);

  const rows = await db
    .select({ internalCode: properties.internalCode })
    .from(properties)
    .where(and(eq(properties.tenantId, tenantId), like(properties.internalCode, `${prefix}-%`)))
    .orderBy(sql`(substring(${properties.internalCode} from '-(\\d+)$'))::int desc`)
    .limit(1);

  const highest = rows[0];
  const nextSequential = highest ? parseSequential(highest.internalCode) + 1 : 1;
  return `${prefix}-${String(nextSequential).padStart(CODE_SEQUENTIAL_WIDTH, "0")}`;
}

function isUniqueCodeViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; constraint_name?: string };
  if (err.code !== "23505") return false;
  return err.constraint_name === undefined || err.constraint_name === UNIQUE_CODE_CONSTRAINT;
}

type NumericStringField = "lat" | "lng" | "commissionPercentage";

/**
 * `properties.lat`/`lng`/`commissionPercentage` are Postgres `numeric` columns, which Drizzle
 * types as strings by default (avoids float precision loss) — but the Zod schemas accept plain
 * numbers (friendlier for callers/forms). Converts those three fields from number to string right
 * before they reach Drizzle's `.values()`/`.set()`, leaving every other field untouched.
 */
function normalizeNumericColumns<T extends Partial<Record<NumericStringField, number>>>(
  data: T,
): Omit<T, NumericStringField> & Partial<Record<NumericStringField, string>> {
  const { lat, lng, commissionPercentage, ...rest } = data;
  const normalized: Partial<Record<NumericStringField, string>> = {};
  if (lat !== undefined) normalized.lat = lat.toString();
  if (lng !== undefined) normalized.lng = lng.toString();
  if (commissionPercentage !== undefined) {
    normalized.commissionPercentage = commissionPercentage.toString();
  }
  return { ...rest, ...normalized } as Omit<T, NumericStringField> &
    Partial<Record<NumericStringField, string>>;
}

async function findOwnerInTenant(
  db: ReturnType<typeof getDb>,
  ownerContactId: string,
  tenantId: string,
): Promise<boolean> {
  const [owner] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, ownerContactId), eq(contacts.tenantId, tenantId)))
    .limit(1);
  return Boolean(owner);
}

export type CreatePropertyServiceInput = {
  tenantId: string;
  createdBy?: string;
} & Record<string, unknown>;

/**
 * Validates (Zod `createPropertySchema`, including the venta/arriendo/ambas pricing rule),
 * verifies `ownerContactId` belongs to `tenantId`, generates a unique internal code and inserts.
 */
export async function createProperty(
  input: CreatePropertyServiceInput,
  deps: PropertiesDeps = {},
): Promise<Property> {
  const db = deps.db ?? getDb();
  const { tenantId, createdBy, ...rest } = input;

  const parsed = createPropertySchema.safeParse(rest);
  if (!parsed.success) {
    throw new PropertyServiceError(
      parsed.error.issues[0]?.message ?? "Datos de la propiedad inválidos.",
      "validation",
      parsed.error.issues.map((issue) => issue.message),
    );
  }

  const ownerExists = await findOwnerInTenant(db, parsed.data.ownerContactId, tenantId);
  if (!ownerExists) {
    throw new PropertyServiceError(
      "El propietario seleccionado no existe en esta inmobiliaria.",
      "owner_not_found",
    );
  }

  const values = normalizeNumericColumns(parsed.data);

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const internalCode = await generatePropertyCode(tenantId, { db });

    try {
      const [created] = await db
        .insert(properties)
        .values({
          ...values,
          tenantId,
          internalCode,
          createdBy,
        })
        .returning();

      if (!created) {
        throw new PropertyServiceError("No se pudo crear la propiedad.", "code_generation_failed");
      }
      return created;
    } catch (error) {
      if (isUniqueCodeViolation(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new PropertyServiceError(
    "No se pudo generar un código interno único para la propiedad. Intenta de nuevo.",
    "code_generation_failed",
  );
}

export type UpdatePropertyServiceInput = Record<string, unknown>;

/**
 * Validates the partial payload (Zod `updatePropertySchema`), re-checks the venta/arriendo/ambas
 * pricing rule against the MERGED state (new fields over the existing row — Zod alone can't see
 * DB state), verifies a new `ownerContactId` (if provided) belongs to the tenant, and updates.
 * `internalCode` is never part of `updatePropertySchema`, so it can never be changed through this
 * path regardless of what a caller puts in the raw input object.
 */
export async function updateProperty(
  id: string,
  tenantId: string,
  input: UpdatePropertyServiceInput,
  deps: PropertiesDeps = {},
): Promise<Property> {
  const db = deps.db ?? getDb();

  const parsed = updatePropertySchema.safeParse(input);
  if (!parsed.success) {
    throw new PropertyServiceError(
      parsed.error.issues[0]?.message ?? "Datos de la propiedad inválidos.",
      "validation",
      parsed.error.issues.map((issue) => issue.message),
    );
  }

  const [existing] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), eq(properties.tenantId, tenantId)))
    .limit(1);

  if (!existing) {
    throw new PropertyServiceError("La propiedad no existe.", "not_found");
  }

  const nextOperationType = (parsed.data.operationType ?? existing.operationType) as OperationType;
  const nextSalePriceCop =
    "salePriceCop" in parsed.data ? parsed.data.salePriceCop : existing.salePriceCop;
  const nextMonthlyRentCop =
    "monthlyRentCop" in parsed.data ? parsed.data.monthlyRentCop : existing.monthlyRentCop;

  const pricingIssues = getOperationPricingIssues(
    nextOperationType,
    nextSalePriceCop,
    nextMonthlyRentCop,
  );
  if (pricingIssues.length > 0) {
    throw new PropertyServiceError(
      pricingIssues[0].message,
      "validation",
      pricingIssues.map((issue) => issue.message),
    );
  }

  if (parsed.data.ownerContactId) {
    const ownerExists = await findOwnerInTenant(db, parsed.data.ownerContactId, tenantId);
    if (!ownerExists) {
      throw new PropertyServiceError(
        "El propietario seleccionado no existe en esta inmobiliaria.",
        "owner_not_found",
      );
    }
  }

  const [updated] = await db
    .update(properties)
    .set({ ...normalizeNumericColumns(parsed.data), updatedAt: new Date() })
    .where(and(eq(properties.id, id), eq(properties.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new PropertyServiceError("La propiedad no existe.", "not_found");
  }

  return updated;
}

export type PropertyWithRelations = Property & {
  media: PropertyMedia[];
  documents: PropertyDocument[];
};

/** Fetches a property with its media (ordered by `sortOrder`) and documents. */
export async function getProperty(
  id: string,
  tenantId: string,
  deps: PropertiesDeps = {},
): Promise<PropertyWithRelations> {
  const db = deps.db ?? getDb();

  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), eq(properties.tenantId, tenantId)))
    .limit(1);

  if (!property) {
    throw new PropertyServiceError("La propiedad no existe.", "not_found");
  }

  const media = await db
    .select()
    .from(propertyMedia)
    .where(and(eq(propertyMedia.propertyId, id), eq(propertyMedia.tenantId, tenantId)))
    .orderBy(propertyMedia.sortOrder);

  const documents = await db
    .select()
    .from(propertyDocuments)
    .where(and(eq(propertyDocuments.propertyId, id), eq(propertyDocuments.tenantId, tenantId)));

  return { ...property, media, documents };
}

export type ListPropertiesFilters = {
  status?: PropertyStatus;
  propertyType?: PropertyType;
  /**
   * When set, also picks which price column `minPriceCop`/`maxPriceCop` filter against
   * (`arriendo` -> `monthlyRentCop`, anything else -> `salePriceCop`) — see `listProperties` doc.
   */
  operationType?: OperationType;
  minPriceCop?: number;
  maxPriceCop?: number;
  /** Case-insensitive substring search. */
  neighborhood?: string;
  /** Case-insensitive substring search. */
  city?: string;
  /** 1-based. Defaults to 1. */
  page?: number;
  pageSize?: number;
};

export type ListPropertiesResult = {
  items: Property[];
  total: number;
};

/**
 * Lists properties for `tenantId` with filters, ordered `createdAt DESC`, paginated.
 *
 * Price range: the plan asks for a single min/max range that "applies to salePriceCop or
 * monthlyRentCop depending on operation". Since a single row can carry either or both prices, the
 * column compared is picked from `filters.operationType`: `arriendo` -> `monthlyRentCop`;
 * `venta`, `ambas`, or no operation filter -> `salePriceCop` (documented product choice: sale
 * price is the more common price-range search; callers that want a rent-price search must also
 * pass `operationType: "arriendo"`).
 */
export async function listProperties(
  tenantId: string,
  filters: ListPropertiesFilters = {},
  deps: PropertiesDeps = {},
): Promise<ListPropertiesResult> {
  const db = deps.db ?? getDb();

  const conditions = [eq(properties.tenantId, tenantId)];

  if (filters.status) {
    conditions.push(eq(properties.status, filters.status));
  }
  if (filters.propertyType) {
    conditions.push(eq(properties.propertyType, filters.propertyType));
  }
  if (filters.operationType) {
    conditions.push(eq(properties.operationType, filters.operationType));
  }
  if (filters.neighborhood) {
    conditions.push(ilike(properties.neighborhood, `%${filters.neighborhood}%`));
  }
  if (filters.city) {
    conditions.push(ilike(properties.city, `%${filters.city}%`));
  }

  const priceColumn =
    filters.operationType === "arriendo" ? properties.monthlyRentCop : properties.salePriceCop;
  if (filters.minPriceCop != null) {
    conditions.push(sql`${priceColumn} >= ${filters.minPriceCop}`);
  }
  if (filters.maxPriceCop != null) {
    conditions.push(sql`${priceColumn} <= ${filters.maxPriceCop}`);
  }

  const whereClause = and(...conditions);

  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  const items = await db
    .select()
    .from(properties)
    .where(whereClause)
    .orderBy(desc(properties.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(properties)
    .where(whereClause);

  return { items, total: countRow?.count ?? 0 };
}

/** Soft delete: sets `status` to `'inactiva'`. Never physically deletes a property. */
export async function deactivateProperty(
  id: string,
  tenantId: string,
  deps: PropertiesDeps = {},
): Promise<Property> {
  const db = deps.db ?? getDb();

  const [updated] = await db
    .update(properties)
    .set({ status: "inactiva", updatedAt: new Date() })
    .where(and(eq(properties.id, id), eq(properties.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new PropertyServiceError("La propiedad no existe.", "not_found");
  }

  return updated;
}
