# Backend requirements for the Roots admin dashboard (Phase 1)

Hand this whole file to your **backend chat**. It lists exactly what the
dashboard frontend reads. The frontend uses only the **anon (publishable) key**,
so everything below is written to be safe under Row Level Security: the counts
come from `SECURITY DEFINER` functions that check the caller is an admin.

Nothing here uses or needs the service-role key.

---

## 1. `admins` table + read policy

The dashboard checks the signed-in user against this table, and also reads their
`role` and `email` to show in the sidebar.

```sql
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'staff',   -- 'owner' | 'staff'
  email      text,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Lets a signed-in user read (only) their own admin row.
create policy "admins read own row"
  on public.admins for select
  using (user_id = auth.uid());
```

Add the first admins (after the auth users exist):

```sql
insert into public.admins (user_id, role, email)
select id, 'owner', email from auth.users where email = 'root@padawanconsulting.com'
on conflict (user_id) do nothing;

insert into public.admins (user_id, role, email)
select id, 'staff', email from auth.users where email = 'admin@padawanconsulting.com'
on conflict (user_id) do nothing;
```

## 2. `is_admin()` helper

Used inside the RPCs below so only admins get numbers.

```sql
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;
```

## 3. `root_listens` table (already planned)

The dashboard assumes one row per play. Suggested shape (adjust as you like — the
dashboard only needs `started_at` and a row count):

```sql
create table if not exists public.root_listens (
  id               bigint generated always as identity primary key,
  root_id          uuid not null,
  owner_id         uuid,            -- the storyteller who owns the root
  listener_id      uuid,           -- nullable (anonymous listens allowed)
  started_at       timestamptz not null default now(),
  seconds_listened int,
  completed        boolean default false,
  source           text
);
```

## 4. Three RPCs the Overview page calls

Return types are `int` so they arrive in the browser as plain numbers.
Each one refuses non-admins. All are granted to `authenticated`.

```sql
-- Headline numbers (one row).
create or replace function public.admin_overview()
returns table (
  total_users        int,
  total_storytellers int,
  total_roots        int,
  total_listens      int,
  listens_7d         int,
  signups_7d         int
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  return query
  select
    (select count(*) from auth.users)::int,
    -- "storytellers" = distinct owners who have at least one root. Adjust to taste.
    (select count(distinct owner_id) from public.roots)::int,
    (select count(*) from public.roots)::int,
    (select count(*) from public.root_listens)::int,
    (select count(*) from public.root_listens
       where started_at >= now() - interval '7 days')::int,
    (select count(*) from auth.users
       where created_at >= now() - interval '7 days')::int;
end;
$$;
grant execute on function public.admin_overview() to authenticated;

-- New signups per day, oldest → newest, zero-filled for empty days.
create or replace function public.admin_signups_daily(days int default 30)
returns table (day date, count int)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  return query
  select d::date as day, count(u.id)::int as count
  from generate_series(current_date - (days - 1), current_date, interval '1 day') d
  left join auth.users u on u.created_at::date = d::date
  group by d order by d;
end;
$$;
grant execute on function public.admin_signups_daily(int) to authenticated;

-- Listens per day, oldest → newest, zero-filled for empty days.
create or replace function public.admin_listens_daily(days int default 30)
returns table (day date, count int)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  return query
  select d::date as day, count(l.id)::int as count
  from generate_series(current_date - (days - 1), current_date, interval '1 day') d
  left join public.root_listens l on l.started_at::date = d::date
  group by d order by d;
end;
$$;
grant execute on function public.admin_listens_daily(int) to authenticated;
```

---

## What the frontend expects back (contract)

| Call | Returns |
|---|---|
| `admins` select where `user_id = auth.uid()` | `{ user_id, role, email }` or nothing |
| `admin_overview()` | one row: `total_users, total_storytellers, total_roots, total_listens, listens_7d, signups_7d` |
| `admin_signups_daily(days)` | rows of `{ day: date, count: int }` |
| `admin_listens_daily(days)` | rows of `{ day: date, count: int }` |

Until these exist, the dashboard still runs — it shows the login gate, and the
Overview shows a friendly "data isn't available yet" state instead of breaking.
