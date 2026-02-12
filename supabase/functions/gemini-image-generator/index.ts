// Nano Banana Image Generation - v2.5 (Jan 2026)
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  generateImage,
  estimateCost,
  base64ToUint8Array,
  parseDimensionsString,
  type ImageGenerationError,
} from "../_shared/gemini-image-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "ai-images";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let userId: string | null = null;
  let recordId: string | null = null;

  try {
    console.log("=== Image Generation Request Started ===");

    // Parse request
    const {
      prompt,
      size = "1024x1024",
      style = "photorealistic",
      styleModifier,
      requestId,
      adminOverride = false,
    } = await req.json();

    console.log("Request params:", {
      prompt: prompt?.substring(0, 50),
      size,
      style,
      hasRequestId: !!requestId,
      adminOverride,
    });

    // Validate prompt
    if (!prompt || prompt.trim().length < 5) {
      return errorResponse(400, "invalid_request", "Prompt must be at least 5 characters");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(401, "unauthorized", "Missing authorization header");
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return errorResponse(401, "unauthorized", "Invalid or expired token");
    }
    userId = user.id;
    console.log("User authenticated:", userId);

    // Parse dimensions
    const { width, height } = parseDimensionsString(size);
    const costCents = estimateCost({ width, height });

    // ==========================================
    // IDEMPOTENCY CHECK (CRITICAL: prevents duplicate billing)
    // ==========================================
    if (requestId) {
      const { data: existing } = await supabase
        .from("ai_generated_images")
        .select("id, image_url, generation_status, storage_path")
        .eq("request_id", requestId)
        .single();

      if (existing) {
        console.log("Found existing request:", existing.id, existing.generation_status);

        if (existing.generation_status === "completed" && existing.image_url) {
          return new Response(
            JSON.stringify({
              image_url: existing.image_url,
              cached: true,
              record: existing,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (existing.generation_status === "processing") {
          return new Response(
            JSON.stringify({
              status: "processing",
              id: existing.id,
              message: "Image generation in progress",
            }),
            { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Failed or other status - allow retry with same requestId
      }
    }

    // ==========================================
    // QUOTA CHECK (Atomic increment)
    // ==========================================
    // Ensure user has a quota record
    await supabase.rpc("ensure_user_quota", { p_user_id: userId });

    // Atomic quota increment - returns empty if quota exceeded
    const { data: quotaResult } = await supabase.rpc("increment_image_quota", {
      p_user_id: userId,
    });

    if (!quotaResult || quotaResult.length === 0) {
      // Quota exceeded - get current limits for error message
      const { data: quotaInfo } = await supabase
        .from("image_user_quotas")
        .select("current_daily_count, daily_limit")
        .eq("user_id", userId)
        .single();

      // Log the quota rejection
      await logFailedGeneration(supabase, userId, prompt, size, style, "quota_exceeded", "Daily quota exceeded", {
        quota_used: quotaInfo?.current_daily_count,
        quota_limit: quotaInfo?.daily_limit,
      });

      return new Response(
        JSON.stringify({
          error: "quota_exceeded",
          message: `Daily quota of ${quotaInfo?.daily_limit || 50} images exceeded`,
          userMessage: `You've reached your daily limit of ${quotaInfo?.daily_limit || 50} images. Quota resets at midnight.`,
          quotaInfo: {
            used: quotaInfo?.current_daily_count,
            limit: quotaInfo?.daily_limit,
          },
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Quota check passed:", quotaResult[0]?.current_daily_count);

    // ==========================================
    // CREATE RECORD WITH "PROCESSING" STATUS
    // ==========================================
    const { data: record, error: insertError } = await supabase
      .from("ai_generated_images")
      .insert({
        request_id: requestId || crypto.randomUUID(),
        user_id: userId,
        prompt: prompt,
        size: size,
        style: style,
        generation_status: "processing",
        model_name: "gemini-2.5-flash-image",
        aspect_ratio: getAspectRatioName(width, height),
        cost_cents: costCents,
        override_used: adminOverride,
        override_by: adminOverride ? userId : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create record:", insertError);
      throw new Error(`Database error: ${insertError.message}`);
    }

    recordId = record.id;
    console.log("Created processing record:", recordId);

    // ==========================================
    // GENERATE IMAGE
    // ==========================================
    const startTime = Date.now();

    // Determine safety threshold based on admin override
    const safetyThreshold = adminOverride ? "BLOCK_ONLY_HIGH" : "BLOCK_MEDIUM_AND_ABOVE";

    // Get style modifier from preset if available
    let finalStyleModifier = styleModifier;
    if (!finalStyleModifier && style) {
      const { data: preset } = await supabase
        .from("image_style_presets")
        .select("prompt_modifier")
        .eq("name", style)
        .single();
      finalStyleModifier = preset?.prompt_modifier;
    }

    let result;
    try {
      result = await generateImage({
        prompt,
        width,
        height,
        styleModifier: finalStyleModifier,
        safetyThreshold: safetyThreshold as any,
      });
    } catch (genError) {
      const error = genError as ImageGenerationError;
      console.error("Generation error:", error.type, error.message);

      // Handle safety blocks
      if (error.type === "safety_block") {
        // Log to safety blocks table
        await supabase.from("image_safety_blocks").insert({
          image_id: recordId,
          user_id: userId,
          prompt: prompt,
          blocked_categories: error.blockedCategories || [],
          safety_scores: error.blockedCategories,
        });

        // Update record as blocked
        await supabase
          .from("ai_generated_images")
          .update({
            generation_status: "failed",
            status: "blocked",
            error_type: "content_safety",
            error_message: error.userMessage,
            error_details: {
              blockedCategories: error.blockedCategories,
              canOverride: !adminOverride, // Can override if not already using override
            },
            generation_time_ms: Date.now() - startTime,
          })
          .eq("id", recordId);

        return new Response(
          JSON.stringify({
            error: "content_safety",
            message: error.message,
            userMessage: error.userMessage,
            suggestion: "Please try a different prompt. If you believe this is a false positive, contact an administrator.",
            canOverride: !adminOverride,
            triggeredCategories: error.blockedCategories,
            debug: {
              originalPrompt: prompt,
              requestParams: { size, style },
            },
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Handle other errors
      await supabase
        .from("ai_generated_images")
        .update({
          generation_status: "failed",
          error_type: error.type,
          error_message: error.message,
          error_details: { canRetry: error.canRetry },
          generation_time_ms: Date.now() - startTime,
        })
        .eq("id", recordId);

      return new Response(
        JSON.stringify({
          error: error.type,
          message: error.message,
          userMessage: error.userMessage,
          canRetry: error.canRetry,
        }),
        {
          status: error.type === "rate_limit" ? 429 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ==========================================
    // UPLOAD TO STORAGE (Never store blob in DB)
    // ==========================================
    const storagePath = `${userId}/${recordId}.png`;
    const imageBuffer = base64ToUint8Array(result.imageBase64);

    console.log("Uploading to storage:", storagePath, imageBuffer.length, "bytes");

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: result.mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      // Continue anyway - we'll use base64 URL as fallback
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    // If storage upload failed, use data URL
    const imageUrl = uploadError
      ? `data:${result.mimeType};base64,${result.imageBase64}`
      : urlData.publicUrl;

    // ==========================================
    // UPDATE RECORD AS COMPLETED
    // ==========================================
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const { data: updatedRecord, error: updateError } = await supabase
      .from("ai_generated_images")
      .update({
        generation_status: "completed",
        status: "completed",
        image_url: imageUrl,
        storage_path: uploadError ? null : storagePath,
        storage_bucket: STORAGE_BUCKET,
        image_hash: result.imageHash,
        synthid_embedded: result.synthIdPresent,
        safety_scores: result.safetyRatings,
        generation_time_ms: result.generationTimeMs,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", recordId)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update record:", updateError);
    }

    // Add cost to monthly tracking
    await supabase.rpc("add_image_cost", {
      p_user_id: userId,
      p_cost_cents: costCents,
    });

    console.log("=== Image Generation Completed Successfully ===");
    console.log("Generation time:", result.generationTimeMs, "ms");
    console.log("Cost:", costCents, "cents");

    return new Response(
      JSON.stringify({
        image_url: imageUrl,
        record: updatedRecord || { id: recordId },
        generationTimeMs: result.generationTimeMs,
        costCents: costCents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("=== FATAL ERROR ===");
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("Error:", errMsg);
    console.error("Stack:", errStack);

    // Update record as failed if we created one
    if (recordId) {
      await supabase
        .from("ai_generated_images")
        .update({
          generation_status: "failed",
          error_type: "unexpected_error",
          error_message: errMsg,
          error_details: { stack: errStack },
        })
        .eq("id", recordId);
    }

    return new Response(
      JSON.stringify({
        error: "unexpected_error",
        message: errMsg,
        userMessage: "Something went wrong. Please try again or contact support.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper functions

function errorResponse(status: number, errorType: string, message: string): Response {
  return new Response(
    JSON.stringify({
      error: errorType,
      message,
      userMessage: message,
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function logFailedGeneration(
  supabase: any,
  userId: string,
  prompt: string,
  size: string,
  style: string,
  errorType: string,
  errorMessage: string,
  errorDetails?: any
): Promise<void> {
  try {
    await supabase.from("ai_generated_images").insert({
      user_id: userId,
      prompt,
      size,
      style,
      generation_status: "failed",
      status: "failed",
      error_type: errorType,
      error_message: errorMessage,
      error_details: errorDetails,
      model_name: "gemini-2.5-flash-image",
    });
  } catch (e) {
    console.error("Failed to log error:", e);
  }
}

function getAspectRatioName(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.01) return "square";
  if (Math.abs(ratio - 1.5) < 0.1) return "landscape";
  if (Math.abs(ratio - 0.67) < 0.1) return "portrait";
  if (Math.abs(ratio - 1.75) < 0.1) return "wide";
  if (Math.abs(ratio - 0.57) < 0.1) return "tall";
  return `${width}x${height}`;
}
