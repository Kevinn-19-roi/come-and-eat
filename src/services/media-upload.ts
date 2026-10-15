"use client";
import { createClient } from "@/lib/supabase/browser";
const bucket = "restaurant-media";
export async function uploadMedia(
  file: File,
  options: { restaurantId?: string; type?: string; altText?: string } = {},
) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (["heic", "heif"].includes(extension) || ["image/heic", "image/heif"].includes(file.type)) {
    throw new Error("Les photos HEIC/HEIF ne peuvent pas encore être affichées sur le site. Depuis l’iPhone, choisissez JPEG ou PNG, ou exportez la photo en format compatible.");
  }
  if (!file.type.startsWith("image/")) throw new Error("Choisissez une image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La photo dépasse 10 Mo.");
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Connectez-vous pour ajouter une photo.");
  const safeExtension = extension || "webp";
  const path = `${user.id}/${crypto.randomUUID()}.${safeExtension}`;
  const { error: uploadError } = await db.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { data, error } = await db
    .from("media")
    .insert({
      path,
      bucket,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      alt_text: options.altText ?? "",
      owner_user_id: user.id,
      restaurant_id: options.restaurantId,
      type: options.type ?? "other",
      is_public: true,
    })
    .select()
    .single();
  if (error) {
    await db.storage.from(bucket).remove([path]);
    throw error;
  }
  return {
    ...data,
    publicUrl: db.storage.from(bucket).getPublicUrl(path).data.publicUrl,
  };
}
