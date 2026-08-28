# Roots Admin

A small, private web console for Roots. Phase 1 is an audience overview you can
screenshot for advertisers: total users, storytellers, roots, listens, and two
trend charts. It reads from your existing Supabase project using the public
anon key only. The service-role key is never used here.

Stack: React + Vite + TypeScript, Tailwind CSS v4, Recharts, @supabase/supabase-js.

---

## Run it on your computer

You need Node.js 20 or newer installed.

1. Install the dependencies:
   ```
   npm install
   ```
2. Make your settings file. Copy `.env.example` to a new file called `.env`,
   then fill in the two values:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-publishable-key
   ```
   You'll find both in Supabase under **Project Settings → API**. The "anon
   public" key is the one you want (not the service_role key).
3. Start it:
   ```
   npm run dev
   ```
   Open the address it prints (usually http://localhost:5173). You'll see the
   sign-in screen.

You sign in with a normal Supabase Auth account whose user is listed in the
`admins` table. Any other account gets a "no admin access" screen.

---

## The backend it needs

Give **BACKEND_REQUIREMENTS.md** to your backend chat. It contains the exact
table, policy, and three functions the Overview page reads, with copy-paste SQL.
Until those exist, the app still runs — the charts just show "data isn't
available yet" instead of breaking.

---

## Put it online at admin.padawanconsulting.com

1. Create a new **private** GitHub repo (e.g. `roots-admin`) and push this folder.
2. In **Vercel** or **Netlify**, import that repo. It auto-detects Vite.
3. Add the two environment variables (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`) in the host's project settings, then deploy.
4. Add the custom domain `admin.padawanconsulting.com` in the host, and add the
   CNAME record it gives you at your DNS (your domain's nameservers). HTTPS is
   handled for you.

---

## Changing the domain later

Everything org-specific lives in **`src/config.ts`**. Change `ORG_DOMAIN` there
and the admin emails and labels follow automatically — one edit.

---

## What's deliberately NOT here yet

Moderation queue, user management, ad-campaign manager, subscriptions, and
creator payouts are parked until there's revenue to justify them. The sidebar
shows them as "Soon" so the roadmap is visible. They'll be added against the
same shared Supabase backend when the time comes.
