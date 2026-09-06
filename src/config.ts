// =============================================================================
// ONE PLACE TO CHANGE ORG IDENTITY.
// If the domain ever changes, edit ORG_DOMAIN below and everything else follows.
// =============================================================================

export const ORG_DOMAIN = "padawanconsulting.com";

export const OWNER_EMAIL = `root@${ORG_DOMAIN}`;
export const STAFF_EMAIL = `admin@${ORG_DOMAIN}`;
export const ADMIN_URL = `admin.${ORG_DOMAIN}`;

export const BRAND = {
  name: "Roots",
  tagline: "Pin your stories to the planet",
  console: "Roots Admin",
  supportEmail: `roots@${ORG_DOMAIN}`,
};

// -----------------------------------------------------------------------------
// The Heritage content account (roots@padawanconsulting.com). Pin editing is
// scoped to roots owned by THIS account.
//
// ⚠️ NOT the same as your admin login (root@padawanconsulting.com). They are
// different accounts, one character apart. This id is an OWNER id used to decide
// which pins are editable; it is never your login. The server enforces the scope
// regardless of this value — it's used only to show/hide the edit UI.
// -----------------------------------------------------------------------------
export const HERITAGE_OWNER_ID = "fda94f0a-b890-4191-b667-7032df97cde5";

// -----------------------------------------------------------------------------
// Supabase connection (from env; anon key is safe in the browser).
// -----------------------------------------------------------------------------
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// -----------------------------------------------------------------------------
// Mapbox (for the admin Map screen). Use a PUBLIC token (pk.…). It ends up in
// the browser bundle, which is normal for Mapbox, so restrict it by URL in your
// Mapbox account (admin domain + localhost) so it can't be reused elsewhere.
// From env so it isn't committed.
// -----------------------------------------------------------------------------
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
