// The shapes the frontend expects back from Supabase.
// Backend (main chat) owns the tables + RPCs; these mirror the live contract.

export type AdminRow = {
  user_id: string;
  role: string | null;
  email: string | null;
};

export type Overview = {
  total_users: number;
  total_storytellers: number;
  total_roots: number;
  total_listens: number;
  listens_7d: number;
  signups_7d: number;
  total_seconds_all: number;
  total_seconds_active: number;
  storage_bytes: number;
};

export type SeriesPoint = { period: string; count: number };

export type RateFlag = {
  owner_id: string;
  display_name: string | null;
  handle: string | null;
  roots_last_hour: number;
};

export type ReportGroup = {
  root_id: string;
  root_title: string | null;
  root_status: string | null;
  owner_id: string | null;
  owner_display_name: string | null;
  owner_handle: string | null;
  report_count: number;
  open_count: number;
  reasons: string[] | null;
  first_reported_at: string | null;
  last_reported_at: string | null;
};

// admin_list_users()
export type UserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  handle: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_admin: boolean;
  is_suspended: boolean;
  roots_count: number;
  avatar_url?: string | null; // profiles key in the public "avatars" bucket
};

// admin_user_detail(p_user_id): one row
export type UserDetail = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  handle: string | null;
  about: string | null;
  avatar_url: string | null;
  is_private: boolean | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  is_admin: boolean;
  admin_role: string | null;
  is_suspended: boolean;
  roots_total: number;
  roots_active: number;
  roots_hidden: number;
  routes_total: number;
  total_seconds: number;
  plays_received: number;
  followers_count: number;
  following_count: number;
  reports_against_open: number;
  reports_against_total: number;
  roots_flagged: number;
  reports_filed: number;
  roots_last_hour: number;
};

// admin_user_roots(p_user_id): rows
export type UserRootRow = {
  root_id: string;
  title: string | null;
  status: string | null;
  visibility: string | null;
  seconds: number | null;
  created_at: string | null;
  plays: number;
  open_reports: number;
  total_reports: number;
};

// admin_user_routes(p_user_id): rows
export type UserRouteRow = {
  route_id: string;
  name: string | null;
  visibility: string | null;
  stops_count: number;
  created_at: string | null;
};

export type MapRoot = {
  root_id: string;
  title: string | null;
  owner_id: string | null;
  owner_handle: string | null;
  owner_display_name: string | null;
  owner_email: string | null;
  lat: number;
  lng: number;
  status: string | null;
  visibility: string | null;
};

export type RouteStop = {
  name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  audio?: string | null;
};

export type MapRoute = {
  route_id: string;
  name: string | null;
  owner_id: string | null;
  owner_handle: string | null;
  visibility: string | null;
  stops: RouteStop[] | null;
};

export type PinMoveResult = {
  ok: boolean;
  old: { lat: number; lng: number };
  new: { lat: number; lng: number };
  audit_warning?: string;
};
