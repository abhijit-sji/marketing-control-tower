

## Plan: Replace Model Select with Lovable AI in Keyword Research

### What changes

1. **Frontend (`src/pages/content/KeywordResearch.tsx`)**:
   - Remove the `MODEL_OPTIONS` array and the entire "AI Model" card (lines 28-177)
   - Remove `selectedModel` state
   - Stop passing `model` to `handleSuggest` — the backend will use a fixed model

2. **Edge Function (`supabase/functions/keyword-research-api/index.ts`)**:
   - Replace the Perplexity API call with Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`)
   - Use `LOVABLE_API_KEY` (already auto-provisioned) instead of `PERPLEXITY_API_KEY`
   - Use model `google/gemini-3-flash-preview` as default
   - Handle 429 (rate limit) and 402 (payment required) errors
   - Keep the same prompt and JSON parsing logic

3. **Hook (`src/hooks/useKeywordResearch.ts`)**: Remove the `model` parameter from `useKeywordSuggestions` mutation since it's no longer user-selectable.

### Technical details

- The Lovable AI Gateway is OpenAI-compatible, so the request/response format stays the same as the current Perplexity call — just swap the URL, auth header, and model name.
- `LOVABLE_API_KEY` is auto-provisioned as a Supabase secret — no user action needed.
- The `model_used` field cached in `keyword_suggestions` table will store `google/gemini-3-flash-preview` instead of `perplexity`.

