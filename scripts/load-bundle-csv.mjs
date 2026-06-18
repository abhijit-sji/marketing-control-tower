#!/usr/bin/env node
/**
 * Load db-bundle CSV files via supabase db query --linked (Management API).
 * Usage: node scripts/load-bundle-csv.mjs
 */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = '/home/abhijit/Downloads/db-bundle/11_data';
const PROJECT_DIR = join(__dirname, '..');

const TABLES = [
  'organizations', 'users', 'user_roles', 'teams', 'team_members', 'employees', 'pods', 'pod_members',
  'brands', 'user_brands', 'clients', 'contacts', 'deals', 'projects', 'project_tasks', 'project_task_comments',
  'ai_agents', 'ai_agent_knowledge_selection', 'ai_agent_runs', 'ai_configurations', 'ai_generated_images',
  'activecollab_task_data', 'brand_analytics_data', 'brand_generated_posts', 'brand_kpis',
  'content_performance_metrics', 'generated_posts', 'hackathon_events', 'hackathon_participants',
  'hackathon_submissions', 'hackathon_teams', 'keyword_research', 'knowledge_base_categories', 'knowledge_base',
  'n8n_workflow_configs', 'newsletter_sources', 'organization_integrations', 'seo_blog_content', 'sora_videos',
  'team_eod_submissions', 'thought_leaders', 'weekly_client_summary',
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || (c === '\r' && next === '\n')) {
      row.push(field);
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
      field = '';
      if (c === '\r') i++;
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function sqlLiteral(val) {
  if (val === '' || val === undefined) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

function buildInsert(table, headers, dataRows) {
  if (!dataRows.length) return null;
  const cols = headers.map((h) => `"${h}"`).join(', ');
  const values = dataRows.map((r) => {
    const cells = headers.map((_, i) => sqlLiteral(r[i] ?? ''));
    return `(${cells.join(', ')})`;
  });
  return `INSERT INTO public."${table}" (${cols}) VALUES\n${values.join(',\n')};`;
}

function runSql(sql) {
  const result = spawnSync('supabase', ['db', 'query', '--linked', sql], {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`Failed SQL for batch`);
  }
}

function runWithReplica(sql) {
  runSql(`SET session_replication_role = replica; ${sql} SET session_replication_role = DEFAULT;`);
}

console.log('Loading CSV data with FK checks disabled per batch...');

for (const table of TABLES) {
  const path = join(DATA_DIR, `${table}.csv`);
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const parsed = parseCsv(raw);
  if (parsed.length < 2) {
    console.log(`Skip ${table} (no data rows)`);
    continue;
  }
  const headers = parsed[0];
  const dataRows = parsed.slice(1).filter((r) => r.some((c) => c !== ''));
  const sql = buildInsert(table, headers, dataRows);
  if (!sql) continue;
  console.log(`Loading ${table}: ${dataRows.length} rows`);
  runWithReplica(sql);
}

console.log('Done.');
