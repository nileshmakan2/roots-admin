import { SUPABASE_URL } from "../config";

// Build a public URL for an avatar from the key stored in profiles.avatar_url.
// The "avatars" bucket is public, so no signing is needed. Defensive about
// format: accepts a legacy full URL, strips a leading slash, and strips an
// accidental "avatars/" bucket prefix on the key.
export function avatarUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const k = key.trim();
  if (!k) return null;
  if (/^https?:\/\//i.test(k)) return k;
  const clean = k.replace(/^\/+/, "").replace(/^avatars\//, "");
  return `${SUPABASE_URL}/storage/v1/object/public/avatars/${clean}`;
}

export function initialsOf(name: string | null | undefined, handle: string | null | undefined): string {
  const base = (name || handle || "").trim();
  if (!base) return "?";
  return base
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
