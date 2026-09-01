import { supabase } from "./supabase";
import type { Result } from "./api";

export type DocType = "terms" | "privacy";

export type LegalDoc = {
  id: string;
  doc_type: DocType;
  version: number;
  title: string | null;
  body: string;
  effective_at: string | null;
  published: boolean;
  created_at: string;
};

function toMessage(err: { message?: string } | null): string | null {
  if (!err) return null;
  const m = err.message ?? "Something went wrong.";
  if (/does not exist|not find|schema cache/i.test(m)) {
    return "The legal_documents table isn't available yet.";
  }
  return m;
}

// The current published version of a doc type (latest published wins), or null.
export async function fetchCurrentDoc(docType: DocType): Promise<Result<LegalDoc>> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("*")
    .eq("doc_type", docType)
    .eq("published", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: (data as LegalDoc) ?? null, error: toMessage(error) };
}

// Full version history for a doc type, newest first (admins see all rows).
export async function fetchDocHistory(docType: DocType): Promise<Result<LegalDoc[]>> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("*")
    .eq("doc_type", docType)
    .order("version", { ascending: false });
  return { data: (data as LegalDoc[]) ?? null, error: toMessage(error) };
}

// The highest version number on record for a doc type (0 if none yet).
async function maxVersion(docType: DocType): Promise<number> {
  const { data } = await supabase
    .from("legal_documents")
    .select("version")
    .eq("doc_type", docType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { version?: number } | null)?.version ?? 0;
}

// Publish a NEW version: inserts a fresh row at max+1, published, with an
// effective date. Older published rows stay as history; latest published wins.
export async function publishNewVersion(input: {
  docType: DocType;
  title: string;
  body: string;
  effectiveAt: string; // ISO date
}): Promise<Result<LegalDoc>> {
  const next = (await maxVersion(input.docType)) + 1;
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("legal_documents")
    .insert({
      doc_type: input.docType,
      version: next,
      title: input.title || null,
      body: input.body,
      effective_at: input.effectiveAt || null,
      published: true,
      created_by: userData?.user?.id ?? null,
    })
    .select("*")
    .single();
  return { data: (data as LegalDoc) ?? null, error: toMessage(error) };
}

// Minor correction: overwrite the CURRENT published row in place, no version
// bump. Requires an UPDATE policy for admins on legal_documents (see the
// backend note). If that policy isn't present, this returns a clear error and
// the UI falls back to "publish new version".
export async function correctInPlace(input: {
  id: string;
  title: string;
  body: string;
}): Promise<Result<LegalDoc>> {
  const { data, error } = await supabase
    .from("legal_documents")
    .update({ title: input.title || null, body: input.body })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();
  if (error) return { data: null, error: toMessage(error) };
  if (!data) {
    return {
      data: null,
      error:
        "Couldn't save the correction. In-place edits may not be enabled yet — publish a new version instead.",
    };
  }
  return { data: data as LegalDoc, error: null };
}
