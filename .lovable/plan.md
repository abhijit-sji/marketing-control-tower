## Goal
Replace the existing `db-bundle/README.md` with a clear, numbered guide that covers downloading the ZIP and running `14_apply_all.sh` on a new Supabase project.

## What to do
1. Update `README.md` with:
   - How to download `db-bundle.zip` from the artifact panel
   - Prerequisites (psql CLI, Supabase DB connection string)
   - Exact command to run `14_apply_all.sh` with `DATABASE_URL`
   - What the script does step-by-step
   - Post-run next steps (edge function deploy, auth user recreation)
   - Common pitfalls and troubleshooting

2. Add inline comments inside `14_apply_all.sh` that echo what each step is doing (e.g., "Creating tables...", "Loading data from CSVs...") so the user sees progress.

## Out of scope
- No changes to SQL files or data
- No changes to the apply script logic itself
- No new tooling or dependencies