import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_BASE_URL =
  Deno.env.get("GEMINI_API_URL") ||
  "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL =
  Deno.env.get("GEMINI_IMPROVE_PROMPT_MODEL") || "gemini-1.5-pro-latest";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      prompt,
      context,
      tone,
      audience,
      instructions,
    }: {
      prompt?: string;
      context?: string;
      tone?: string;
      audience?: string;
      instructions?: string;
    } = await req.json();

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    );

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing Gemini API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Supabase credentials are not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestParts: string[] = [
      "You are an expert prompt engineer. Improve the provided prompt to make it more detailed, actionable, and aligned with marketing goals.",
      `Original prompt: ${prompt.trim()}`,
    ];

    if (context) {
      requestParts.push(`Context: ${context}`);
    }

    if (tone) {
      requestParts.push(`Tone: ${tone}`);
    }

    if (audience) {
      requestParts.push(`Audience: ${audience}`);
    }

    if (instructions) {
      requestParts.push(`Additional instructions: ${instructions}`);
    }

    requestParts.push(
      "Return only the improved prompt text with no markdown formatting.",
    );

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: requestParts.join("\n\n"),
            },
          ],
        },
      ],
    };

    const response = await fetch(
      `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini improve prompt error:", errorText);
      return new Response(
        JSON.stringify({ error: "Gemini API error", details: errorText }),
        {
          status: response.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const result = await response.json();
    const improvedPrompt = result?.candidates?.[0]?.content?.parts?.[0]?.text?.
      trim();

    if (!improvedPrompt) {
      return new Response(
        JSON.stringify({ error: "Failed to generate improved prompt" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const metadata: Record<string, string> = {};
    if (context) metadata.context = context;
    if (tone) metadata.tone = tone;
    if (audience) metadata.audience = audience;
    if (instructions) metadata.instructions = instructions;

    const { data, error } = await supabase
      .from("prompt_improvements")
      .insert({
        user_id: user.id,
        original_prompt: prompt,
        improved_prompt: improvedPrompt,
        metadata: Object.keys(metadata).length ? metadata : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to store prompt improvement:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to save prompt improvement",
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        improvedPrompt,
        record: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Unexpected error improving prompt:", error);
    return new Response(
      JSON.stringify({
        error: "Unexpected error",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
