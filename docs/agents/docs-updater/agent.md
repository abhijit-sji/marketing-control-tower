# CollabAI Docs Updater Agent

> **Last Updated:** 2026-01-02  
> **Status:** ✅ Active

## Overview

Automates synchronization between the SJ Marketing AI documentation and the latest application code. Uses Codex inside CollabAI workspace to maintain parity between code and documentation.

## Responsibilities

- Reads documentation files from `.agent/` and `docs/`
- Rewrites sections to match frontend, backend, and Supabase changes
- Exports dated bundles for the Admin Documentation UI
- Maintains single source of truth for product, engineering, and operations teams

## Schema

- No dedicated database tables
- Reads from markdown files in `.agent/` and `docs/`
- References Supabase metadata indirectly through documentation
- Schema/RLS updates in migrations are captured in documentation text

## Related Files

### Documentation Sources
- `.agent/System/` - Core system documentation
- `.agent/System/features/` - Feature documentation
- `.agent/SOP/` - Standard Operating Procedures
- `docs/` - Operational documentation

### Hooks Referenced
- `useToast` - Toast notifications
- Documentation utilities in `src/lib/documentation.ts`

### Edge Functions Observed
- `run-ai-agent` family when documentation covers AI execution

## Usage Notes

1. Configure this prompt inside CollabAI as the "Docs Updater Agent" instruction set
2. Schedule automations to regenerate documentation without manual edits
3. After each run, verify generated documentation has consistent `Last updated` dates
4. Flag downstream teams if documentation changes impact integrations

## Workflow

1. Agent reviews current codebase
2. Compares against existing documentation
3. Identifies discrepancies
4. Updates documentation with accurate information
5. Adds timestamp to modified documents
