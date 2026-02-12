import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== False Positive Report Started ===");
    
    const { imageId, prompt, reason } = await req.json();
    console.log("Report params:", { imageId, promptLength: prompt?.length, hasReason: !!reason });
    
    if (!imageId || !prompt) {
      console.error("Missing required fields");
      return new Response(JSON.stringify({ error: "Missing required fields: imageId and prompt" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing Authorization header");
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    console.log("Creating Supabase client and authenticating user...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (!user) {
      console.error("User authentication failed");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = user.id;
    console.log("User authenticated:", userId);

    // Verify the image belongs to the user
    const { data: image, error: imageError } = await supabase
      .from("ai_generated_images")
      .select("*")
      .eq("id", imageId)
      .eq("user_id", userId)
      .single();

    if (imageError || !image) {
      console.error("Image not found or unauthorized:", imageError);
      return new Response(JSON.stringify({ error: "Image not found or unauthorized" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Check if already reported
    const { data: existingReport } = await supabase
      .from("content_safety_reports")
      .select("id")
      .eq("image_id", imageId)
      .eq("user_id", userId)
      .eq("report_type", "false_positive")
      .single();

    if (existingReport) {
      console.log("Report already exists:", existingReport.id);
      return new Response(JSON.stringify({ 
        message: "This image has already been reported",
        reportId: existingReport.id
      }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Create the false positive report
    console.log("Creating false positive report...");
    const { data: report, error: reportError } = await supabase
      .from("content_safety_reports")
      .insert({
        image_id: imageId,
        user_id: userId,
        report_type: "false_positive",
        prompt: prompt,
        reason: reason || "User believes this is a false positive",
        status: "pending",
        safety_ratings: image.error_details?.safety_ratings,
        triggered_categories: image.error_details?.triggered_categories,
      })
      .select()
      .single();

    if (reportError) {
      console.error("Failed to create report:", reportError);
      return new Response(JSON.stringify({ error: "Failed to create report" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    console.log("Report created successfully:", report.id);

    // The database trigger will notify admins automatically
    console.log("=== False Positive Report Completed ===");
    
    return new Response(JSON.stringify({ 
      success: true,
      reportId: report.id,
      message: "Your report has been submitted. Admins will review it shortly.",
      status: "pending"
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("=== FATAL ERROR ===");
    const err = error as Error;
    console.error("Error type:", err.constructor?.name || 'Unknown');
    console.error("Error message:", err.message || String(error));
    console.error("Error stack:", err.stack || 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        error: "unexpected_error",
        message: error instanceof Error ? error.message : "An unexpected error occurred",
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

