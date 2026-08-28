// The shapes the frontend expects back from Supabase.
// Backend (main chat) owns the tables + RPCs; these mirror the live contract.

export type AdminRow = {
  user_id: string;
  role: string | null; // e.g. "owner" | "staff"
  email: string | null;
};

// Returned by admin_overview() — a single row of headline numbers.
export type Overview = {
  total_users: number;
  total_storytellers: number;
  total_roots: number;
  total_listens: number;
  listens_7d: number;
  signups_7d: number;
  total_seconds_all: number;    // sum(seconds) over every root
  total_seconds_active: number; // sum(seconds) over active roots
  storage_bytes: number;        // bytes in the roots-audio bucket
};

// Returned by admin_signups_series / admin_listens_series.
export type SeriesPoint = {
  period: string; // ISO date, e.g. "2026-01-01"
  count: number;
};

// Returned by admin_rate_flags() — users who created > 20 roots in the last hour.
export type RateFlag = {
  owner_id: string;
  display_name: string | null;
  handle: string | null;
  roots_last_hour: number;
};
