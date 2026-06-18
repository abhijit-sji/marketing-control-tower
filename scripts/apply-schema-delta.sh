#!/usr/bin/env bash
# Apply repo migrations that add tables/features missing from the Lovable db-bundle.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS=(
  20251209000002_create_vector_tables.sql
  20251210060046_634e08db-977f-456c-bbd1-7bccfa9db882.sql
  20251212000000_fix_brand_knowledge_embeddings_schema.sql
  20251212061304_2bf6941b-a2a4-47e3-a1d3-f80aa78da421.sql
  20260128100000_switch_to_gemini_embeddings.sql
  20260204000000_project_knowledge_embeddings.sql
  20260128000000_add_claim_pending_knowledge_jobs.sql
  20260128100000_add_process_knowledge_jobs_cron.sql
  20260128100001_add_manual_trigger_helper.sql
  20260130100000_image_gen_core.sql
  20260130100001_image_gen_presets.sql
  20260130100002_image_gen_analytics.sql
  20260130100004_fix_image_rls_recursion.sql
  20260108120000_create_hero_section_optimizer.sql
  20260112000000_create_reel_hook_generator.sql
  20260210100000_analytics_api.sql
  20260113074621_2923ba45-7e14-42f4-91cc-c9db71a7b4ce.sql
  20260114123000_feedback_system_redesign.sql
  20251118184816_create_newsletter_module.sql
  20251008184828_de197368-5888-4834-bc8a-be7fe8b8a73b.sql
  20260116174734_2f52d3a5-3f86-4690-8aa3-eb3a80e4dc00.sql
  20260116181841_44dc5aaa-d403-4b34-8210-b666297003aa.sql
  20260116181858_b9b0e3cd-95fc-4c9e-87b2-6f0187b38c9c.sql
  20260117185006_65d6a695-2066-45b9-a242-f2058aa42eb3.sql
  20260122000000_create_quote_builder_tables.sql
  20260110120000_create_project_meetings.sql
)

cd "$ROOT"
for f in "${MIGRATIONS[@]}"; do
  path="supabase/migrations/$f"
  if [[ ! -f "$path" ]]; then
    echo "SKIP missing $f"
    continue
  fi
  echo "==> $f"
  if ! supabase db query --linked -f "$path" 2>&1 | tail -1 | grep -q "boundaries"; then
    echo "WARN: $f may have failed — check output above"
  fi
done
echo "Schema delta apply complete."
