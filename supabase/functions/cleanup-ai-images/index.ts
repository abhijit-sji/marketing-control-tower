import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const now = new Date().toISOString();
  const { data: expired } = await supabase
    .from("ai_generated_images")
    .select("id, image_url")
    .lte("expires_at", now);

  if (!expired?.length) {
    return new Response("No expired images", { status: 200 });
  }

  for (const img of expired) {
    const filePath = img.image_url?.split("/ai-generated/")[1];
    if (filePath) {
      await supabase.storage.from("ai-generated").remove([filePath]);
    }
    await supabase
      .from("ai_generated_images")
      .update({ image_url: null, provider: "Gemini (expired)" })
      .eq("id", img.id);
  }

  return new Response(`Cleaned ${expired.length} expired images`, { status: 200 });
});
