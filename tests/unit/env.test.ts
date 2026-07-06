import { describe, expect, it } from "vitest";
import { parseClientEnv, parseEnv } from "@/lib/env";

const validRaw = {
  NEXT_PUBLIC_SUPABASE_URL: "https://krcsempfrkizmbpqvksz.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key-value",
  DATABASE_URL:
    "postgresql://postgres:realpassword@db.krcsempfrkizmbpqvksz.supabase.co:5432/postgres",
};

describe("parseEnv", () => {
  it("parses a fully valid environment and marks the database URL as ready", () => {
    const env = parseEnv(validRaw);

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(validRaw.NEXT_PUBLIC_SUPABASE_URL);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(validRaw.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBe(validRaw.SUPABASE_SERVICE_ROLE_KEY);
    expect(env.databaseUrlReady).toBe(true);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not a well-formed URL", () => {
    expect(() => parseEnv({ ...validRaw, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow();
  });

  it("throws when a required key is missing", () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY, ...rest } = validRaw;
    void NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => parseEnv(rest)).toThrow();
  });

  it("throws when a required key is present but empty", () => {
    expect(() => parseEnv({ ...validRaw, SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow();
  });

  it("marks the database URL as not ready when DATABASE_URL contains the pending-password placeholder", () => {
    const env = parseEnv({
      ...validRaw,
      DATABASE_URL:
        "postgresql://postgres:[DB_PASSWORD_PENDIENTE]@db.krcsempfrkizmbpqvksz.supabase.co:5432/postgres",
    });

    expect(env.databaseUrlReady).toBe(false);
  });

  it("marks the database URL as not ready when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = validRaw;
    void DATABASE_URL;

    const env = parseEnv(rest);

    expect(env.databaseUrlReady).toBe(false);
  });
});

describe("parseClientEnv", () => {
  const validClientRaw = {
    NEXT_PUBLIC_SUPABASE_URL: "https://krcsempfrkizmbpqvksz.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-value",
  };

  it("parses a valid client environment without any server-only variables present", () => {
    const env = parseClientEnv(validClientRaw);

    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe(validClientRaw.NEXT_PUBLIC_SUPABASE_URL);
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe(validClientRaw.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not a well-formed URL", () => {
    expect(() =>
      parseClientEnv({ ...validClientRaw, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" }),
    ).toThrow();
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", () => {
    expect(() =>
      parseClientEnv({ NEXT_PUBLIC_SUPABASE_URL: validClientRaw.NEXT_PUBLIC_SUPABASE_URL }),
    ).toThrow();
  });

  it("throws when NEXT_PUBLIC_SUPABASE_ANON_KEY is present but empty", () => {
    expect(() =>
      parseClientEnv({ ...validClientRaw, NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }),
    ).toThrow();
  });
});
