import { vi } from "vitest";

/**
 * Minimal fluent stand-in for a Drizzle query builder. Every chain method (`from`, `where`,
 * `values`, `set`, `orderBy`, `innerJoin`, `limit`, `returning`, …) returns the same object, and
 * the object itself is thenable — so `await db.insert(x).values(y).returning(z)` (or any other
 * chain shape used by the services under test) resolves to `result` regardless of which methods
 * were called or in what order. Each chain method is a `vi.fn()` so tests can assert on the
 * arguments passed to `.values()`, `.where()`, etc.
 *
 * Not a general-purpose Drizzle mock: it only needs to support the exact chain shapes used by
 * `src/server/services/auth/*.ts` (no joins beyond `getInvitationByToken`, no transactions).
 */
const CHAIN_METHODS = [
  "from",
  "where",
  "values",
  "set",
  "orderBy",
  "innerJoin",
  "limit",
  "returning",
] as const;

export type MockChain = Record<(typeof CHAIN_METHODS)[number], ReturnType<typeof vi.fn>> & {
  then: Promise<unknown>["then"];
  catch: Promise<unknown>["catch"];
};

function buildChain(settle: () => Promise<unknown>): MockChain {
  const chain = {} as MockChain;
  for (const method of CHAIN_METHODS) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (onFulfilled, onRejected) => settle().then(onFulfilled, onRejected);
  chain.catch = (onRejected) => settle().catch(onRejected);
  return chain;
}

/** A chain that resolves to `result` once awaited, however many/which chain methods are called. */
export function chainResolve<T>(result: T): MockChain {
  return buildChain(() => Promise.resolve(result));
}

/** A chain that rejects with `error` once awaited — simulates a failing insert/update/delete. */
export function chainReject(error: unknown): MockChain {
  return buildChain(() => Promise.reject(error));
}

export type MockDb = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

/** Fresh mock `db` with unconfigured `select`/`insert`/`update`/`delete` — wire up per test with
 * `.mockReturnValueOnce(chainResolve(...))` / `.mockReturnValueOnce(chainReject(...))`. */
export function createMockDb(): MockDb {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

export type MockAdminClient = {
  auth: {
    admin: {
      createUser: ReturnType<typeof vi.fn>;
      deleteUser: ReturnType<typeof vi.fn>;
      getUserById: ReturnType<typeof vi.fn>;
    };
  };
};

export function createMockAdminClient(): MockAdminClient {
  return {
    auth: {
      admin: {
        createUser: vi.fn(),
        deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getUserById: vi.fn(),
      },
    },
  };
}
