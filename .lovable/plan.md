

## Why "Save Configuration" isn't working

The whole frontend is currently broken by a **syntax error** in `supabase/functions/openai-test/index.ts`. While the build fails, no button on the app responds, including Save Configuration.

### Root cause

`openai-test/index.ts` is malformed. The body of an old `if (action === "test") { ... }` block was deleted, but the inner code (lines 36–97) and a stray closing `}` on line 98 were left behind. The result:

- Lines 36–97 sit inside the `try { }` with no enclosing `if`.
- Line 98's extra `}` closes the `try` prematurely.
- The next `if (action === "status")` and `if (action === "generate_test")` blocks end up outside the `try`, so the `} catch (error) {` on line 187 has nothing to catch — Deno reports: `Expected ',', got 'catch'`.

The Save button handler itself (`saveConfiguration` in `src/pages/admin/IntegrationManager.tsx`, generic branch at lines 1670–1723) is correct and will work once the build is restored.

### Fix

Rewrite `supabase/functions/openai-test/index.ts` so the action dispatch is well-formed:

```text
serve(async (req) => {
  OPTIONS preflight → return CORS
  try {
    parse { action, apiKey }
    validate apiKey present (return 400 if missing)

    if (action === "test")          { call /v1/models, return result }
    if (action === "status")        { return configured/enabled flags }
    if (action === "generate_test") { call /v1/chat/completions test }

    return 400 "Unknown action"
  } catch (error) {
    return 500 with error.message
  }
})
```

Concretely:
1. Wrap lines 38–97 in `if (action === "test") { ... }`.
2. Remove the stray `}` on line 98.
3. Keep the existing `status` and `generate_test` branches as-is.
4. Keep the final `catch` block.

### Steps

1. Edit `supabase/functions/openai-test/index.ts` with the corrected structure above.
2. Redeploy the `openai-test` edge function.
3. Reload `/adminpanel/integrations`, open Configure OpenAI, paste key, click Save Configuration — it should now persist to `organization_integrations` and show the "Settings Saved" toast.

### Note on the original 401 error

Once Save works and you store a real key, the "Invalid OpenAI API key" 401 from Test Connection will only go away if the key you paste is actually valid in your OpenAI account. The current stored value is a placeholder, which is why testing returns 401.

