import { createHash, randomBytes } from "node:crypto";

/**
 * Generates a random invitation token: 32 cryptographically random bytes, base64url-encoded
 * (no padding). The token is returned in the clear exactly once — to the caller that creates the
 * invitation (see `createInvitation`) — and is never stored; only its SHA-256 hash is persisted
 * (see `hashInvitationToken`).
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hashes an invitation token with SHA-256, hex-encoded. Deterministic and one-way: used to look
 * up/validate invitations by their `token_hash` column without ever storing the raw token.
 */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Whether an invitation has expired as of `now` (defaults to the current time). The exact expiry
 * instant counts as expired (inclusive boundary), matching the intent of "valid until X" rather
 * than "valid through X".
 */
export function isInvitationExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return now.getTime() >= expiresAt.getTime();
}

const FALLBACK_SLUG = "inmobiliaria";
// Unicode combining diacritical marks (U+0300-U+036F), left behind by `String.normalize("NFD")`
// when decomposing accented letters (é -> e + ́, ñ -> n + ̃, etc.).
const DIACRITICS_PATTERN = /[̀-ͯ]/g;

/**
 * Builds a URL-safe slug from a real-estate agency's name: lowercase, accents/ñ stripped to
 * their plain ASCII letter, non-alphanumeric runs collapsed to a single hyphen, no leading or
 * trailing hyphens. Falls back to a generic slug when nothing alphanumeric survives.
 *
 * Pure and collision-unaware on purpose: `registerTenant` is responsible for checking uniqueness
 * against existing tenants and appending a short random suffix on collision.
 */
export function buildSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || FALLBACK_SLUG;
}
