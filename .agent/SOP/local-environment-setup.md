# 🚀 Local Development Setup Guide

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

Complete instructions for running the SJ Marketing AI Platform locally.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js** `v20.x` or higher ([Download](https://nodejs.org/))
  ```bash
  node --version  # Should show v20.x or higher
  ```

- **npm** `v10.x` or higher (comes with Node.js)
  ```bash
  npm --version  # Should show v10.x or higher
  ```

- **Git** ([Download](https://git-scm.com/))
  ```bash
  git --version
  ```

### Optional but Recommended

- **Supabase CLI** (for database management and edge functions)
  ```bash
  npm install -g supabase
  # OR
  brew install supabase/tap/supabase
  ```

- **Docker Desktop** (required for Supabase local development)
  - Download from [docker.com](https://www.docker.com/products/docker-desktop/)

---

## 🔧 Installation Steps

### Step 1: Clone the Repository

```bash
# Clone the repo
git clone https://github.com/sjinnovation/sj-marketing-ai.git

# Navigate to project directory
cd sj-marketing-ai
```

### Step 2: Install Dependencies

```bash
npm install
```

**Note**: The project includes both `package-lock.json` and `bun.lockb`. Use npm for consistency with CI/CD.

### Step 3: Configure Environment Variables

The project uses Supabase with hardcoded configuration:
- **Project ID:** `tkdksyfudpzxrlnvybqz`
- **Configuration:** `src/integrations/supabase/client.ts`

For Edge Functions, secrets are configured in the Supabase Dashboard:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `PERPLEXITY_API_KEY`
- `ENCRYPTION_KEY`
- `SENDGRID_API_KEY`
- And more...

---

## 🎯 Running the Application

### Basic Development Server

```bash
npm run dev
```

The application will start at:
```
➜ Local:   http://localhost:5173/
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run build:dev` | Build in development mode |
| `npm run lint` | Run ESLint to check code quality |
| `npm run preview` | Preview production build locally |
| `npx tsc --noEmit` | Type check without emitting files |

---

## 🗄️ Database Setup (Supabase)

### Option 1: Use Remote Supabase (Recommended for Quick Start)

The app connects to the remote Supabase database automatically. No additional setup needed!

### Option 2: Local Supabase Development

For full local development with database and edge functions:

#### 1. Start Supabase Locally

```bash
# Make sure Docker is running first
supabase start
```

This will:
- Start a local Postgres database
- Start Supabase Studio (Database UI)
- Start Edge Functions runtime
- Provide local credentials

#### 2. Apply Database Migrations

```bash
# Apply all migrations
supabase db reset

# OR apply migrations without data reset
supabase migration up
```

#### 3. Access Supabase Studio

```
http://localhost:54323
```

#### 4. Run Edge Functions Locally

```bash
# Serve a specific function
supabase functions serve fetch-and-summarize-newsletter --env-file .env.local

# Serve all functions
supabase functions serve --env-file .env.local
```

---

## 🧪 Verify Installation

### 1. Check if Server is Running

Visit `http://localhost:5173` - you should see the login page.

### 2. Run Linter

```bash
npm run lint
```

Should complete without errors.

### 3. Type Check

```bash
npx tsc --noEmit
```

Should complete without TypeScript errors.

---

## 📁 Project Structure

```
sj-marketing-ai/
├── src/
│   ├── pages/          # React pages/routes (71 page components)
│   ├── components/     # Reusable UI components (130+ components)
│   ├── features/       # Feature-specific modules
│   ├── hooks/          # Custom React hooks (46 hooks)
│   ├── lib/            # Utility functions
│   ├── integrations/   # Third-party integrations
│   └── types/          # TypeScript type definitions
├── supabase/
│   ├── functions/      # Deno Edge Functions (63 functions)
│   └── migrations/     # Database migrations
├── .agent/             # AI agent documentation
├── docs/               # Operational documentation
└── public/             # Static assets
```

---

## 🎨 Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Query (@tanstack/react-query)
- **Routing**: React Router v6
- **Database**: Supabase (PostgreSQL) - 115+ tables
- **Authentication**: Supabase Auth
- **Backend Functions**: Supabase Edge Functions (Deno)
- **AI**: OpenAI GPT-4, Perplexity AI, Anthropic Claude, Google Gemini

---

## 🔍 Common Issues & Troubleshooting

### Issue: Port 5173 Already in Use

```bash
# Kill the process using the port
lsof -ti:5173 | xargs kill -9

# OR use a different port
npm run dev -- --port 3000
```

### Issue: Module Not Found

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue: Supabase Connection Failed

1. Check environment configuration
2. Verify Supabase project is not paused
3. Check network/firewall settings

### Issue: Build Errors

```bash
# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

### Issue: TypeScript Errors

```bash
# Regenerate types
npx tsc --noEmit

# Check ESLint config
npm run lint
```

---

## 🚢 Deployment

### Vercel (frontend)

The React/Vite frontend deploys to **Vercel**. Supabase Edge Functions and the database remain on Supabase.

**Production URL:** https://marketing-control-tower-mocha.vercel.app

**Vercel account:** [abhijitsarker-3949s-projects](https://vercel.com/abhijitsarker-3949s-projects/marketing-control-tower)

**Config:** `vercel.json` at repo root (Vite build → `dist/`, SPA rewrites for React Router).

**Environment variables** (set in Vercel → Project → Settings → Environment Variables):

| Variable | Required |
|----------|----------|
| `VITE_SUPABASE_URL` | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes |
| `VITE_SUPABASE_PROJECT_ID` | Yes |
| `VITE_VOICEBOX_URL` | Optional |

See `.env.example` for the full list.

**Deploy commands:**

```bash
npm i -g vercel@latest
vercel link          # first time only
vercel deploy --prod # production deploy
```

**Post-deploy checklist:**

1. Supabase → Authentication → URL Configuration: add `https://marketing-control-tower-mocha.vercel.app/**` to Redirect URLs and set Site URL.
2. Google OAuth (if used): add `https://<your-domain>/google-drive-callback` to authorized redirect URIs.
3. VoiceBox (if used): set `VOICEBOX_CORS_ORIGINS` on the HF Space, or `VITE_VOICEBOX_USE_PROXY=true` on Vercel.

### Supabase (backend)

Edge functions deploy separately:

```bash
supabase functions deploy
```

---

## 📚 Additional Resources

- **Main Documentation**: `.agent/` folder
- **Architecture**: `.agent/System/project_architecture.md`
- **Database Schema**: `.agent/System/database_schema.md`
- **Features Guide**: `.agent/System/features/`

---

## ✅ Quick Start Checklist

- [ ] Node.js v20+ installed
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] Dev server running (`npm run dev`)
- [ ] Can access `http://localhost:5173`
- [ ] Can log in with test user
- [ ] No console errors in browser

---

**Happy coding!** 💻
