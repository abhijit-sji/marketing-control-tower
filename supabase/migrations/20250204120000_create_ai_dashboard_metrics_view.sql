create or replace view public.ai_dashboard_metrics as
select
  agent_id,
  (select name from public.ai_agents where ai_agents.id = ai_agent_runs.agent_id) as agent_name,
  count(*)::bigint as total_runs,
  coalesce(sum((ai_summary->'provider_meta'->>'total_tokens')::numeric), 0)::bigint as total_tokens,
  coalesce(avg((ai_summary->'provider_meta'->>'total_tokens')::numeric), 0) as avg_tokens,
  max(created_at) as last_run_at
from public.ai_agent_runs
where status = 'completed'
group by agent_id;
