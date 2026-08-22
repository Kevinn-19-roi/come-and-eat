import "server-only";
import { createClient } from "@/lib/supabase/server";
export const applicationStatusLabels: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Nouvelle",
  under_review: "En cours",
  changes_requested: "Modifications demandées",
  approved: "Acceptée",
  rejected: "Refusée",
};
export async function getAdminSellerApplications(status?: string) {
  const db = await createClient();
  let query = db
    .from("seller_applications")
    .select(
      "id,applicant_name,restaurant_name,phone,email,commune,submitted_at,created_at,status,profile:profiles!seller_applications_user_id_fkey(display_name)",
    )
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
export async function getPendingSellerApplicationCount() {
  const db = await createClient();
  const { count, error } = await db
    .from("seller_applications")
    .select("*", { count: "exact", head: true })
    .in("status", ["submitted", "under_review"]);
  if (error) throw error;
  return count ?? 0;
}
export async function getAdminSellerApplication(id: string) {
  const db = await createClient();
  const [
    { data: application, error },
    { data: documents, error: documentsError },
    { data: events, error: eventsError },
  ] = await Promise.all([
    db
      .from("seller_applications")
      .select(
        "*,profile:profiles!seller_applications_user_id_fkey(display_name)",
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("seller_application_documents")
      .select("*")
      .eq("application_id", id)
      .order("created_at"),
    db
      .from("seller_application_events")
      .select("id,status,note,created_at,actor:profiles(display_name)")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (error) throw error;
  if (documentsError) throw documentsError;
  if (eventsError) throw eventsError;
  if (!application) return null;
  const signedDocuments = await Promise.all(
    (documents ?? []).map(async (document) => {
      if (!document.storage_path) return { ...document, signedUrl: null };
      const { data, error: signedError } = await db.storage
        .from("seller-documents")
        .createSignedUrl(document.storage_path, 300);
      if (signedError)
        console.warn("[seller-application] document_unavailable", {
          documentId: document.id,
          code: signedError.message,
        });
      return { ...document, signedUrl: data?.signedUrl ?? null };
    }),
  );
  const publicUrl = (path: unknown) =>
    typeof path === "string" && path
      ? db.storage.from("restaurant-media").getPublicUrl(path).data.publicUrl
      : null;
  const photoPaths: string[] = Array.isArray(
    application.establishment_photo_paths,
  )
    ? application.establishment_photo_paths.filter(
        (path: unknown): path is string =>
          typeof path === "string" && Boolean(path),
      )
    : [];
  const publicPhotos: Array<{ path: string; url: string }> = photoPaths.flatMap(
    (path: string) => {
      const url = publicUrl(path);
      return url ? [{ path, url }] : [];
    },
  );
  return {
    application,
    documents: signedDocuments,
    events: events ?? [],
    publicPhotos,
    logoUrl: publicUrl(application.logo_path),
    coverUrl: publicUrl(application.cover_path),
  };
}
