// =============================================================================
// ONE PLACE TO CHANGE ORG IDENTITY.
// If the domain ever changes, edit ORG_DOMAIN below and everything else follows.
// =============================================================================

export const ORG_DOMAIN = "padawanconsulting.com";

// Admin accounts (these are just email addresses; the real gate is the `admins`
// table in Supabase). "root" is the owner/superuser; "admin" is for other staff.
export const OWNER_EMAIL = `root@${ORG_DOMAIN}`;
export const STAFF_EMAIL = `admin@${ORG_DOMAIN}`;

// Where this console lives. Only used for display / links.
export const ADMIN_URL = `admin.${ORG_DOMAIN}`;

export const BRAND = {
  name: "Roots",
  tagline: "Pin your stories to the planet",
  console: "Roots Admin",
  supportEmail: `roots@${ORG_DOMAIN}`,
};

// -----------------------------------------------------------------------------
// Supabase connection. These come from environment variables (see .env.example)
// so they are not committed to git. The anon key is safe to ship in the browser.
// -----------------------------------------------------------------------------
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
