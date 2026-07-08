import { describe, expect, it } from "vitest";
import {
  buildSlug,
  generateInvitationToken,
  hashInvitationToken,
  isInvitationExpired,
} from "@/server/services/auth/helpers";

describe("generateInvitationToken", () => {
  it("returns a base64url string with no padding or URL-unsafe characters", () => {
    const token = generateInvitationToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain("+");
    expect(token).not.toContain("/");
    expect(token).not.toContain("=");
  });

  it("encodes 32 random bytes (43 base64url characters, no padding)", () => {
    const token = generateInvitationToken();

    expect(token).toHaveLength(43);
  });

  it("generates a different token on every call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateInvitationToken()));

    expect(tokens.size).toBe(20);
  });
});

describe("hashInvitationToken", () => {
  it("returns a 64-character lowercase hex string (SHA-256 digest)", () => {
    const hash = hashInvitationToken("some-token-value");

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("is deterministic: the same token always hashes to the same value", () => {
    const token = generateInvitationToken();

    expect(hashInvitationToken(token)).toBe(hashInvitationToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashInvitationToken("token-a")).not.toBe(hashInvitationToken("token-b"));
  });

  it("matches the known SHA-256 digest of a fixed input", () => {
    // sha256("hello") — precomputed reference value.
    expect(hashInvitationToken("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});

describe("isInvitationExpired", () => {
  it("returns true when expiresAt is in the past relative to now", () => {
    const now = new Date("2026-07-06T12:00:00Z");
    const expiresAt = new Date("2026-07-01T00:00:00Z");

    expect(isInvitationExpired(expiresAt, now)).toBe(true);
  });

  it("returns false when expiresAt is in the future relative to now", () => {
    const now = new Date("2026-07-06T12:00:00Z");
    const expiresAt = new Date("2026-07-13T00:00:00Z");

    expect(isInvitationExpired(expiresAt, now)).toBe(false);
  });

  it("treats the exact expiry instant as expired (boundary is inclusive)", () => {
    const instant = new Date("2026-07-06T12:00:00Z");

    expect(isInvitationExpired(instant, instant)).toBe(true);
  });

  it("defaults `now` to the current time when omitted", () => {
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    const farPast = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365);

    expect(isInvitationExpired(farFuture)).toBe(false);
    expect(isInvitationExpired(farPast)).toBe(true);
  });
});

describe("buildSlug", () => {
  it("lowercases and hyphenates a simple name", () => {
    expect(buildSlug("Inmobiliaria Central")).toBe("inmobiliaria-central");
  });

  it("strips accents", () => {
    expect(buildSlug("Inmobiliaria Buendía")).toBe("inmobiliaria-buendia");
  });

  it("converts ñ to n", () => {
    expect(buildSlug("Peña Raíces")).toBe("pena-raices");
  });

  it("collapses punctuation and repeated separators into single hyphens", () => {
    expect(buildSlug("Vive & Construye S.A.S.")).toBe("vive-construye-s-a-s");
  });

  it("trims leading and trailing hyphens", () => {
    expect(buildSlug("  ¡Hola Inmobiliaria!  ")).toBe("hola-inmobiliaria");
  });

  it("falls back to a generic slug when nothing alphanumeric survives", () => {
    expect(buildSlug("¡¡¡!!!")).toBe("inmobiliaria");
  });
});
