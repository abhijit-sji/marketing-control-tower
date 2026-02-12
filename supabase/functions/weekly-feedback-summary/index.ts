import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklyFeedbackSummaryRequest {
  start_date?: string; // ISO date (YYYY-MM-DD)
  end_date?: string; // ISO date (YYYY-MM-DD)
}

interface FeedbackReport {
  id: string;
  feedback_number: number | null;
  type: "bug" | "feature";
  subject: string;
  description: string;
  status: string;
  module: string | null;
  priority: string | null;
  created_at: string;
  updated_at: string;
}

const MAX_DESCRIPTION_LENGTH = 160;

const formatDateRange = (start: Date, end: Date) => {
  const formatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${formatter.format(start)} - ${formatter.format(end)}`;
};

const truncate = (value: string, length: number) =>
  value.length > length ? `${value.slice(0, length).trim()}...` : value;

const formatFeedbackItem = (item: FeedbackReport, frontendUrl: string) => {
  const numberLabel = item.feedback_number ? `#${item.feedback_number}` : item.id.slice(0, 8);
  const moduleLabel = item.module ? item.module : "General";
  const priorityLabel = item.priority ? item.priority : "unassigned";
  const description = truncate(item.description, MAX_DESCRIPTION_LENGTH);
  const link = `${frontendUrl}/feedback/${item.id}`;

  return {
    label: `${numberLabel} ${item.subject}`,
    detail: `${moduleLabel} • ${priorityLabel} • ${item.status}`,
    description,
    link,
  };
};

const buildPrompt = (
  newBugs: FeedbackReport[],
  newFeatures: FeedbackReport[],
  resolvedFeedback: FeedbackReport[],
  frontendUrl: string,
) => {
  const formatList = (items: FeedbackReport[]) =>
    items.length === 0
      ? "None"
      : items
          .map((item) => {
            const formatted = formatFeedbackItem(item, frontendUrl);
            return `- ${formatted.label} (${formatted.detail}) :: ${formatted.description}`;
          })
          .join("\n");

  return `Analyze this week's feedback for our internal system:\n\nNEW BUGS:\n${formatList(newBugs)}\n\nNEW FEATURES:\n${formatList(newFeatures)}\n\nRESOLVED:\n${formatList(resolvedFeedback)}\n\nProvide:\n1. Executive summary (2-3 sentences)\n2. Top 3 priority items needing attention\n3. Any patterns or recurring issues across modules\n4. Recommended next steps`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const cronSecret = Deno.env.get("SUPABASE_CRON_SECRET");
    if (cronSecret) {
      const providedSecret = req.headers.get("x-cron-secret");
      if (providedSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body: WeeklyFeedbackSummaryRequest = req.method === "POST" ? await req.json() : {};

    const endDate = body.end_date ? new Date(`${body.end_date}T23:59:59Z`) : new Date();
    const startDate = body.start_date
      ? new Date(`${body.start_date}T00:00:00Z`)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://your-app-url.com";

    const { data: feedbackRows, error: feedbackError } = await supabase
      .from("feedback_reports")
      .select("id, feedback_number, type, subject, description, status, module, priority, created_at, updated_at")
      .is("deleted_at", null);

    if (feedbackError) {
      throw feedbackError;
    }

    const feedback = (feedbackRows ?? []) as FeedbackReport[];

    const newFeedback = feedback.filter((item) => new Date(item.created_at) >= startDate);
    const newBugs = newFeedback.filter((item) => item.type === "bug");
    const newFeatures = newFeedback.filter((item) => item.type === "feature");

    const resolvedFeedback = feedback.filter((item) => {
      const updatedAt = new Date(item.updated_at);
      return updatedAt >= startDate && ["resolved", "closed"].includes(item.status);
    });

    const { count: openCount, error: openCountError } = await supabase
      .from("feedback_reports")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status", ["open", "in_progress"]);

    if (openCountError) {
      throw openCountError;
    }

    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "Lovable API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(newBugs, newFeatures, resolvedFeedback, frontendUrl);
    console.log("[weekly-feedback-summary] Prompt length:", prompt.length);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are an executive assistant summarizing product feedback for leadership.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[weekly-feedback-summary] Lovable AI error:", errorText);
      return new Response(JSON.stringify({ error: "AI summary failed", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiSummary = aiData?.choices?.[0]?.message?.content?.trim();

    if (!aiSummary) {
      return new Response(JSON.stringify({ error: "AI summary was empty" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (aiData?.usage) {
      console.log("[weekly-feedback-summary] Token usage:", aiData.usage);
    }

    const { data: superAdmins, error: superAdminError } = await supabase
      .from("users")
      .select("id, email, first_name, last_name, role")
      .eq("role", "super_admin");

    if (superAdminError) {
      throw superAdminError;
    }

    const recipients = (superAdmins ?? []).filter((user) => Boolean(user.email));
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No super admins with email found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      return new Response(JSON.stringify({ error: "SendGrid API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromEmail = Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@sjinnovation.com";
    const dateRangeLabel = formatDateRange(startDate, endDate);

    const summaryHtml = aiSummary.replace(/\n/g, "<br />");

    const renderFeedbackList = (items: FeedbackReport[]) => {
      if (items.length === 0) {
        return "<p>None</p>";
      }

      return `
        <ul>
          ${items
            .map((item) => {
              const formatted = formatFeedbackItem(item, frontendUrl);
              return `
                <li>
                  <strong>${formatted.label}</strong> - ${formatted.detail}<br />
                  ${formatted.description}<br />
                  <a href="${formatted.link}">View feedback</a>
                </li>
              `;
            })
            .join("")}
        </ul>
      `;
    };

    const htmlBody = `
      <h2>Weekly Feedback Summary (${dateRangeLabel})</h2>
      <p><strong>New Bugs:</strong> ${newBugs.length} &nbsp; | &nbsp; <strong>New Features:</strong> ${newFeatures.length} &nbsp; | &nbsp; <strong>Resolved:</strong> ${resolvedFeedback.length} &nbsp; | &nbsp; <strong>Still Open:</strong> ${openCount ?? 0}</p>
      <h3>Executive Summary</h3>
      <p>${summaryHtml}</p>
      <h3>New Bugs</h3>
      ${renderFeedbackList(newBugs)}
      <h3>New Feature Requests</h3>
      ${renderFeedbackList(newFeatures)}
      <h3>Resolved This Week</h3>
      ${renderFeedbackList(resolvedFeedback)}
    `;

    const textBody = `Weekly Feedback Summary (${dateRangeLabel})\n\n` +
      `New Bugs: ${newBugs.length} | New Features: ${newFeatures.length} | Resolved: ${resolvedFeedback.length} | Still Open: ${openCount ?? 0}\n\n` +
      `Executive Summary:\n${aiSummary}\n\n` +
      `View feedback: ${frontendUrl}/feedback`;

    const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: recipients.map((user) => ({
          to: [{
            email: user.email,
            name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email,
          }],
          subject: `Weekly Feedback Summary (${dateRangeLabel})`,
        })),
        from: {
          email: fromEmail,
          name: "SJ Innovation",
        },
        content: [
          { type: "text/plain", value: textBody },
          { type: "text/html", value: htmlBody },
        ],
      }),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error("[weekly-feedback-summary] SendGrid error:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send email", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      recipients: recipients.length,
      date_range: dateRangeLabel,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[weekly-feedback-summary] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal server error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
