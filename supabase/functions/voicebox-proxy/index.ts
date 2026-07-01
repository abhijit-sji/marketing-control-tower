// VoiceBox API Proxy
//
// Transparent pass-through proxy for all VoiceBox API calls.
// Enables the Marketing Hub frontend on Vercel to call VoiceBox
// (on HF Spaces or elsewhere) without CORS issues, since this
// edge function adds the appropriate CORS headers server-side.
//
// Required secret: VOICEBOX_URL  (e.g. https://abhijit-sji-voicebox.hf.space)
//
// JWT verification is disabled — all requests are forwarded as-is.
// Add Supabase auth checks here if you want to restrict access.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-voicebox-client-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const voiceboxUrl = Deno.env.get("VOICEBOX_URL");
  if (!voiceboxUrl) {
    return new Response(
      JSON.stringify({ error: "VOICEBOX_URL secret not set" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Strip the function prefix so  /voicebox-proxy/profiles → /profiles
  const url = new URL(req.url);
  // Path after /functions/v1/voicebox-proxy  →  everything after that
  const suffix = url.pathname.replace(/^\/functions\/v1\/voicebox-proxy/, "") || "/";
  const targetUrl = `${voiceboxUrl.replace(/\/$/, "")}${suffix}${url.search}`;

  // Forward headers, drop host and origin to avoid upstream rejections
  const forwardHeaders = new Headers(req.headers);
  forwardHeaders.delete("host");
  forwardHeaders.delete("origin");
  forwardHeaders.delete("authorization"); // don't leak Supabase JWT to VoiceBox

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      // @ts-ignore — Deno fetch supports duplex streaming
      duplex: "half",
    });

    // Pass upstream response through, merging in our CORS headers
    const responseHeaders = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      responseHeaders.set(k, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("voicebox-proxy error:", msg);
    return new Response(
      JSON.stringify({ error: "Upstream request failed", detail: msg }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
