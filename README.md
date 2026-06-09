# METTA Academy Website + Admin

Project root is this folder. It contains one Vite app for the public website and the internal admin system.

## Stack

- React 18, TypeScript, Vite 6
- React Router 6
- Tailwind CSS
- Firebase Auth, Firestore, Storage
- Vercel Serverless Functions in `api/`
- Recharts, framer-motion, lucide-react

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

Important: in Vite dev mode, `/api` is proxied to `https://www.metta.edu.vn` by `vite.config.js`. Admin login, public lead submit, CAPI tests, and user management can touch production services unless you run the API locally with Vercel or point the proxy to a staging target.

## Quality Gates

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Routes

Public:

- `/`
- `/programs/:slug`
- `/p/:slug`
- `/tin-tuc`
- `/tin-tuc/:slug`
- `/contact`
- `/phap-ly/:slug`
- `/chinh-sach-bao-mat`
- `/dieu-khoan-su-dung`

Admin:

- `/login`
- `/dashboard`
- `/crm/leads`
- `/crm/leads/:id`
- `/crm/lead-assignment`
- `/appointments`
- `/capi`
- `/capi/events`
- `/reports`
- `/cms/pages`
- `/cms/pages/:id`
- `/cms/theme`
- `/cms/programs`
- `/cms/header-menu`
- `/cms/footer`
- `/cms/legal`
- `/cms/blog`
- `/media`
- `/users`
- `/settings`

## Source Layout

- `src/App.tsx`: route map, public routes, protected admin routes, lazy-loaded admin pages
- `src/pages/public/`: public website pages
- `src/pages/`: admin pages
- `src/components/ui/`: shared UI primitives
- `src/components/layout/`: admin layout, sidebar, protected route
- `src/components/public/`: public website sections and lead form
- `src/services/`: Firestore/API service layer
- `src/hooks/`: app hooks
- `src/lib/`: Firebase init, permissions, constants, utilities
- `src/types/`: CRM, CMS, CAPI, user types
- `api/`: Vercel functions

## Serverless API

- `api/admin-login-token.ts`: validates admin email/password on the server and returns a Firebase custom token.
- `api/admin-users.ts`: admin-only user create/update/disable via Firebase Admin SDK.
- `api/public-lead-submit.ts`: receives public lead submissions, validates input, applies honeypot + IP rate limit, writes leads through Firebase Admin SDK, and creates pending CAPI logs.
- `api/capi-send-event.ts`: sends server-side Meta Conversions API events using server-only environment variables and logs results to Firestore.
- `api/cron-return-expired-leads.ts`: returns active assigned leads when the 24h status-update window expires.
- `api/cron-overdue-appointments.ts`: marks upcoming appointments as overdue after their start time passes.

## CRM Pipeline Notes

- Pipeline includes `ÄÃ£ bÃ¡o phÃ­/Chá» chá»‘t` between `ÄÃ£ test/Há»c thá»­` and `ÄÃ£ Ä‘Äƒng kÃ½ há»c`.
- Leads store both `parentName` and `studentName`; `fullName` is kept as a compatibility display name.
- Lead source priority is configurable in Leads via `Source priority`; priority levels are P1-P5, with P5 handled first on Kanban.
- Kanban sorts each status column by source priority first, then created time.
- Finance/enrollment fields are stored on leads: `dealSize`, `dealCurrency`, `dealPackage`, `dealNote`, `expectedRevenue`, and `expectedCloseDate`.
- `expectedRevenue` is copied from the sales-entered `dealSize`. There is no default probability mapping in this implementation.
- Moving a lead to `Máº¥t lead` requires `lostReason`.
- Appointment statuses are `upcoming`, `done`, `cancelled`, and `overdue`.
- Local seed data includes 10 demo priority leads (`lead-demo-priority-*`) for UI review.

## Environment

Copy `.env.example` to `.env` for local development. Do not commit `.env` or `.env.local`.

Client-safe variables use `VITE_`:

- `VITE_FIREBASE_*`
- `VITE_ADMIN_EMAILS`
- `VITE_CLOUDINARY_*`

Server-only variables must not use `VITE_`:

- `ADMIN_PASSWORD`
- `ADMIN_EMAILS`
- `REQUIRE_APP_CHECK`
- `CRON_SECRET`
- `META_PIXEL_ID`
- `META_ACCESS_TOKEN`
- `META_TEST_EVENT_CODE`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Security Notes

- Public lead form submits through `/api/public-lead-submit`; it should not write leads directly from the browser.
- Meta Access Token is server-only. The CAPI admin UI must not collect or store it client-side.
- Public CMS reads should stay read-only. CMS repair/seed/write flows belong in authenticated admin actions.
- Rotate Firebase service account keys and Meta tokens if they were ever present in a local `.env` that may have been shared or deployed.

## Deploy

Recommended deploy flow:

1. Initialize Git and push the source to GitHub.
2. Import the repo into Vercel.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Add all server-only environment variables in Vercel Project Settings.
6. Use Vercel preview deployments before promoting to production.

