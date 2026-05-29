# Todo App

A full-featured Todo application built with Next.js 15, React 19, SQLite (node:sqlite), WebAuthn passkeys, and Tailwind CSS.

## Features

All 11 features implemented:
1. Todo CRUD (create, read, update, delete)
2. Priority system (High / Medium / Low with color badges)
3. Recurring todos (daily / weekly / monthly / yearly)
4. Reminders & browser notifications
5. Subtasks with progress tracking
6. Tag system with color-coded badges
7. Template system (save & reuse todo configurations)
8. Search & filtering (title + tag name, real-time, debounced)
9. Export & import (JSON format)
10. Calendar view with Singapore holidays
11. WebAuthn / Passkey authentication (passwordless)

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Frontend**: React 19 + Tailwind CSS 4
- **Database**: SQLite via Node.js built-in `node:sqlite`
- **Auth**: WebAuthn/Passkeys (`@simplewebauthn`)
- **Testing**: Playwright (E2E)
- **Timezone**: Asia/Singapore throughout

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment (already set for dev)
```bash
cp .env.example .env.local
# Edit .env.local if needed (defaults work for localhost)
```

### 3. Start development server
```bash
npm run dev
```

Open http://localhost:3000

### 4. Register and log in
- Navigate to http://localhost:3000/login
- Enter a username and click **Register** (uses your device passkey)
- You'll be redirected to the main page

## Running Tests

```bash
# Install Playwright browsers (first time)
npx playwright install chromium

# Run all E2E tests
npm test

# Run with UI
npx playwright test --ui
```

## Production Build

```bash
npm run build
npm start
```

## Deployment

### Railway (recommended for SQLite persistence)
```bash
npm i -g @railway/cli
railway login
railway init
railway variables set JWT_SECRET=<your-secret>
railway variables set RP_ID=<your-app>.up.railway.app
railway variables set RP_NAME="Todo App"
railway variables set RP_ORIGIN=https://<your-app>.up.railway.app
railway up
```

### Vercel
```bash
npm i -g vercel
vercel login
vercel --prod
# Set environment variables in Vercel dashboard
```

⚠️ Note: Vercel uses serverless functions — SQLite will reset on each deployment unless you use Vercel Postgres or an external DB.

## Environment Variables

| Variable | Dev | Production |
|----------|-----|-----------|
| `JWT_SECRET` | any 32+ char string | random secret |
| `RP_ID` | `localhost` | `your-app.railway.app` |
| `RP_NAME` | `Todo App` | `Todo App` |
| `RP_ORIGIN` | `http://localhost:3000` | `https://your-app.railway.app` |
| `RAILWAY_VOLUME_MOUNT_PATH` | - | `/app/data` (optional) |
