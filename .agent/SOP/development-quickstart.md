# ⚡ Quick Start Guide

> **Last Updated:** 2026-01-02  
> **Verified Against:** Current codebase  
> **Status:** ✅ Active

Get the SJ Marketing AI Platform running in 5 minutes!

---

## 🎯 Prerequisites

- Node.js v20+ and npm v10+
- Git

---

## 🚀 Setup (5 Steps)

### 1. Clone & Install

```bash
git clone https://github.com/sjinnovation/sj-marketing-ai.git
cd sj-marketing-ai
npm install
```

### 2. Environment Configuration

The project connects to a Supabase project. Configuration is handled through:
- **Supabase project ID:** `xgsbkyfmyaqbgqabeqcg`
- **Edge Functions:** Secrets configured in Supabase Dashboard

For local development, create `.env.local` if needed for any local overrides.

**Get Supabase credentials**:
- Go to [Supabase Dashboard](https://app.supabase.com/)
- Select project → Settings → API
- Copy URL and anon key

### 3. Start Development Server

```bash
npm run dev
```

### 4. Open Browser

```
http://localhost:5173
```

### 5. Login

Use your Supabase Auth credentials to log in.

---

## 🛠️ Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Check code quality
npm run preview      # Preview production build
npx tsc --noEmit     # TypeScript type checking
```

---

## 📚 Need More Details?

See **[local-environment-setup.md](./local-environment-setup.md)** for:
- Complete environment variable list
- Database setup instructions
- Supabase local development
- Troubleshooting guide
- Project structure overview

---

## ✅ Success Checklist

- [ ] Server running at http://localhost:5173
- [ ] No console errors
- [ ] Can access login page
- [ ] Can authenticate

---

## 🆘 Quick Troubleshooting

**Port already in use?**
```bash
lsof -ti:5173 | xargs kill -9
```

**Module not found?**
```bash
rm -rf node_modules package-lock.json && npm install
```

**Connection failed?**
- Check environment variables
- Verify Supabase project is active

---

**That's it!** You're ready to code. 🎉
