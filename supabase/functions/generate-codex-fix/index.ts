import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.28.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

interface GenerateCodexFixPayload {
  functionName?: string;
  logId?: string;
  errorMessage?: string;
  stackTrace?: string | null;
  requestPayload?: unknown;
  responseData?: unknown;
  timestamp?: string | null;
}

const CODEX_MODEL = Deno.env.get("CODEX_MODEL") ?? "gpt-4o-mini";

const serializeSection = (label: string, value: unknown) => {
  if (!value) return null;
  if (typeof value === "string" && value.trim().length === 0) {
    return null;
  }

  if (typeof value === "string") {
    return `${label}:\n${value}`;
  }

  try {
    return `${label}:\n${JSON.stringify(value, null, 2)}`;
  } catch (_error) {
    return `${label}:\n${String(value)}`;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: GenerateCodexFixPayload = await req.json();
    const { functionName, logId, errorMessage, stackTrace, requestPayload, responseData, timestamp } = payload;

    if (!functionName || !logId || !errorMessage) {
      return new Response(
        JSON.stringify({ error: "functionName, logId, and errorMessage are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const OPENAI_KEY = Deno.env.get("OPENAI_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_KEY) {
      return new Response(JSON.stringify({ error: "OpenAI key not configured" }), {
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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openai = new OpenAI({ apiKey: OPENAI_KEY });

    const contextParts = [
      `Edge function: ${functionName}`,
      `Log ID: ${logId}`,
      `Observed at: ${timestamp ?? new Date().toISOString()}`,
      `Error message: ${errorMessage}`,
      stackTrace ? `Stack trace:\n${stackTrace}` : null,
      serializeSection("Request payload", requestPayload),
      serializeSection("Response data", responseData),
    ].filter(Boolean) as string[];

    const completion = await openai.chat.completions.create({
      model: CODEX_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are Codex, an expert Supabase and TypeScript engineer. Provide concise diagnoses and actionable fixes. Include code snippets when it accelerates implementation.",
        },
        {
          role: "user",
          content: `${contextParts.join("\n\n")}\n\nReturn a Markdown report with sections for Summary, Root Cause, Recommended Fix, and Validation Steps.`,
        },
      ],
    });

    const suggestion = completion.choices?.[0]?.message?.content?.trim() ??
      "Codex could not generate a recommendation. Review the edge function manually.";

    const issueDescriptionParts = [
      `Edge Function: ${functionName}`,
      `Log ID: ${logId}`,
      `Timestamp: ${timestamp ?? new Date().toISOString()}`,
      serializeSection("Error message", errorMessage),
      serializeSection("Stack trace", stackTrace),
      serializeSection("Request payload", requestPayload),
      serializeSection("Response data", responseData),
      serializeSection("Codex suggestion", suggestion),
    ].filter(Boolean) as string[];

    let existingIssueId: string | null = null;
    try {
      const { data: existingIssues } = await supabase
        .from("issues")
        .select("id, metadata")
        .contains("metadata", { logId })
        .limit(1);

      if (existingIssues && existingIssues.length > 0) {
        existingIssueId = existingIssues[0].id as string;
      }
    } catch (lookupError) {
      console.warn("Issue metadata lookup failed", lookupError);
    }

    let issueId: string | null = existingIssueId;

    if (!issueId) {
      const issueTitle = `[Edge Function] ${functionName} failure`;
      const baseIssue = {
        title: issueTitle,
        description: issueDescriptionParts.join("\n\n"),
        status: "open",
        severity: "high",
        source: "edge_function",
        metadata: {
          logId,
          functionName,
          timestamp: timestamp ?? new Date().toISOString(),
          generatedBy: "codex",
        },
      } as Record<string, unknown>;

      const candidatePayloads: Array<Record<string, unknown>> = [
        baseIssue,
        {
          title: issueTitle,
          description: issueDescriptionParts.join("\n\n"),
          status: "open",
          metadata: {
            logId,
            functionName,
            timestamp: timestamp ?? new Date().toISOString(),
          },
        },
        {
          title: issueTitle,
          description: issueDescriptionParts.join("\n\n"),
        },
      ];

      for (const payload of candidatePayloads) {
        try {
          const { data: inserted, error: insertError } = await supabase
            .from("issues")
            .insert(payload)
            .select("id")
            .single();

          if (!insertError && inserted) {
            issueId = inserted.id as string;
            break;
          }
        } catch (insertError) {
          console.warn("Issue insert attempt failed", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({
        suggestion,
        issueId,
        logged: Boolean(issueId),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("generate-codex-fix error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
