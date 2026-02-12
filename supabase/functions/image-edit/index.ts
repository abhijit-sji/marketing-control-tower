import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  generateImage,
  estimateCost,
  base64ToUint8Array,
  type ImageGenerationError,
} from "../_shared/gemini-image-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "ai-images";

/**
 * Image Edit Endpoint
 *
 * Handles conversational editing of images using Gemini's multimodal capabilities.
 * Fetches the parent image, passes it to Gemini with the edit instruction,
 * and creates a new version record linked to the parent.
 */
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
    console.log("=== Image Edit Request Started ===");

    // Parse request
    const {
      parentId,
      editInstruction,
      requestId,
      adminOverride = false,
    } = await req.json();

    console.log("Request params:", {
      parentId,
      editInstruction: editInstruction?.substring(0, 50),
      hasRequestId: !!requestId,
      adminOverride,
    });

    // Validate inputs
    if (!parentId) {
      return errorResponse(400, "invalid_request", "Parent image ID is required");
    }

    if (!editInstruction || editInstruction.trim().length < 3) {
      return errorResponse(400, "invalid_request", "Edit instruction must be at least 3 characters");
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

    // ==========================================
    // IDEMPOTENCY CHECK
    // ==========================================
    if (requestId) {
      const { data: existing } = await supabase
        .from("ai_generated_images")
        .select("id, image_url, generation_status")
        .eq("request_id", requestId)
        .single();

      if (existing) {
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
              message: "Image edit in progress",
            }),
            { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // ==========================================
    // FETCH PARENT IMAGE
    // ==========================================
    const { data: parentImage, error: parentError } = await supabase
      .from("ai_generated_images")
      .select("id, storage_path, storage_bucket, prompt, version_number, size, style, user_id, image_url")
      .eq("id", parentId)
      .eq("generation_status", "completed")
      .single();

    if (parentError || !parentImage) {
      return errorResponse(404, "not_found", "Parent image not found or not completed");
    }

    // Verify user owns the parent image (or is admin)
    if (parentImage.user_id !== userId) {
      // Check if admin
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (userRole?.role !== "super_admin" && userRole?.role !== "manager") {
        return errorResponse(403, "forbidden", "You don't have permission to edit this image");
      }
    }

    console.log("Parent image found:", parentImage.id, "version:", parentImage.version_number);

    // ==========================================
    // DOWNLOAD PARENT IMAGE FROM STORAGE
    // ==========================================
    let parentImageBase64: string;

    if (parentImage.storage_path && parentImage.storage_bucket) {
      console.log("Downloading from storage:", parentImage.storage_path);

      const { data: imageBlob, error: downloadError } = await supabase.storage
        .from(parentImage.storage_bucket)
        .download(parentImage.storage_path);

      if (downloadError || !imageBlob) {
        console.error("Failed to download parent image:", downloadError);
        return errorResponse(500, "storage_error", "Failed to retrieve parent image from storage");
      }

      // Convert blob to base64
      const arrayBuffer = await imageBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      parentImageBase64 = btoa(String.fromCharCode(...uint8Array));
    } else if (parentImage.image_url?.startsWith("data:")) {
      // Handle data URL fallback
      const base64Match = parentImage.image_url.match(/base64,(.+)$/);
      if (base64Match) {
        parentImageBase64 = base64Match[1];
      } else {
        return errorResponse(500, "invalid_image", "Parent image has invalid data URL format");
      }
    } else {
      return errorResponse(500, "no_storage", "Parent image is not available in storage");
    }

    console.log("Parent image loaded:", parentImageBase64.length, "characters base64");

    // ==========================================
    // QUOTA CHECK
    // ==========================================
    await supabase.rpc("ensure_user_quota", { p_user_id: userId });

    const { data: quotaResult } = await supabase.rpc("increment_image_quota", {
      p_user_id: userId,
    });

    if (!quotaResult || quotaResult.length === 0) {
      const { data: quotaInfo } = await supabase
        .from("image_user_quotas")
        .select("current_daily_count, daily_limit")
        .eq("user_id", userId)
        .single();

      return new Response(
        JSON.stringify({
          error: "quota_exceeded",
          message: `Daily quota of ${quotaInfo?.daily_limit || 50} images exceeded`,
          userMessage: `You've reached your daily limit. Quota resets at midnight.`,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // PARSE DIMENSIONS & CALCULATE COST
    // ==========================================
    const dimensions = parentImage.size?.split("x").map(Number) || [1024, 1024];
    const width = dimensions[0] || 1024;
    const height = dimensions[1] || 1024;
    const costCents = estimateCost({ width, height });

    // ==========================================
    // CREATE NEW VERSION RECORD
    // ==========================================
    const newVersionNumber = (parentImage.version_number || 1) + 1;

    const { data: record, error: insertError } = await supabase
      .from("ai_generated_images")
      .insert({
        request_id: requestId || crypto.randomUUID(),
        user_id: userId,
        parent_id: parentId,
        version_number: newVersionNumber,
        prompt: parentImage.prompt, // Preserve original prompt
        edit_instruction: editInstruction,
        size: parentImage.size,
        style: parentImage.style,
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
    console.log("Created edit record:", recordId, "version:", newVersionNumber);

    // ==========================================
    // GENERATE EDITED IMAGE (Multimodal)
    // ==========================================
    const startTime = Date.now();
    const safetyThreshold = adminOverride ? "BLOCK_ONLY_HIGH" : "BLOCK_MEDIUM_AND_ABOVE";

    let result;
    try {
      result = await generateImage({
        prompt: parentImage.prompt || "",
        width,
        height,
        parentImageBase64,
        editInstruction,
        safetyThreshold: safetyThreshold as any,
      });
    } catch (genError) {
      const error = genError as ImageGenerationError;
      console.error("Edit generation error:", error.type, error.message);

      // Handle safety blocks
      if (error.type === "safety_block") {
        await supabase.from("image_safety_blocks").insert({
          image_id: recordId,
          user_id: userId,
          prompt: `${parentImage.prompt} [EDIT: ${editInstruction}]`,
          blocked_categories: error.blockedCategories || [],
          safety_scores: error.blockedCategories,
        });

        await supabase
          .from("ai_generated_images")
          .update({
            generation_status: "failed",
            status: "blocked",
            error_type: "content_safety",
            error_message: error.userMessage,
            error_details: { blockedCategories: error.blockedCategories },
            generation_time_ms: Date.now() - startTime,
          })
          .eq("id", recordId);

        return new Response(
          JSON.stringify({
            error: "content_safety",
            message: error.message,
            userMessage: error.userMessage,
            suggestion: "Try a different edit instruction.",
            triggeredCategories: error.blockedCategories,
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
    // UPLOAD TO STORAGE
    // ==========================================
    const storagePath = `${userId}/${recordId}.png`;
    const imageBuffer = base64ToUint8Array(result.imageBase64);

    console.log("Uploading edited image:", storagePath, imageBuffer.length, "bytes");

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, imageBuffer, {
        contentType: result.mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    const imageUrl = uploadError
      ? `data:${result.mimeType};base64,${result.imageBase64}`
      : urlData.publicUrl;

    // ==========================================
    // UPDATE RECORD AS COMPLETED
    // ==========================================
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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

    console.log("=== Image Edit Completed Successfully ===");
    console.log("Version:", newVersionNumber, "Generation time:", result.generationTimeMs, "ms");

    return new Response(
      JSON.stringify({
        image_url: imageUrl,
        record: updatedRecord || { id: recordId },
        versionNumber: newVersionNumber,
        parentId,
        generationTimeMs: result.generationTimeMs,
        costCents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("=== FATAL ERROR ===");
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", errMsg);

    if (recordId) {
      await supabase
        .from("ai_generated_images")
        .update({
          generation_status: "failed",
          error_type: "unexpected_error",
          error_message: errMsg,
        })
        .eq("id", recordId);
    }

    return new Response(
      JSON.stringify({
        error: "unexpected_error",
        message: errMsg,
        userMessage: "Something went wrong. Please try again.",
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

function getAspectRatioName(width: number, height: number): string {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.01) return "square";
  if (Math.abs(ratio - 1.5) < 0.1) return "landscape";
  if (Math.abs(ratio - 0.67) < 0.1) return "portrait";
  if (Math.abs(ratio - 1.75) < 0.1) return "wide";
  if (Math.abs(ratio - 0.57) < 0.1) return "tall";
  return `${width}x${height}`;
}
