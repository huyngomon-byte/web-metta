# METTA CRM Clone Setup Guide

Tai lieu nay dung cho team khi clone bo source CRM sang mot du an/brand khac.

## 1. Clone source

```bash
git clone <github-repo-url>
cd <project-folder>
npm install
cp .env.example .env.local
```

Khong commit `.env`, `.env.local`, Firebase private key, Stringee API secret, Vercel token hoac bat ky production credential nao.

## 2. Cau hinh Firebase

Tao Firebase project moi, sau do dien cac bien:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Goi y:
- Dung Firebase client config cho frontend.
- Dung Firebase service account cho serverless API.
- Firestore can co cac collection CRM: `leads`, `appointments`, `callLogs`, `callCenterSettings`, `notifications`, `sourceEngineSettings`, `parentProfiles`.

## 3. Cau hinh admin/login

```env
ADMIN_EMAILS=
ADMIN_PASSWORD=
VITE_ADMIN_EMAILS=
VITE_ADMIN_PASSWORD=
VITE_ENABLE_MOCK_AUTH=false
```

Neu dung Firebase Auth that, han che mock auth tren production.

## 4. Cau hinh Stringee Call Center

```env
STRINGEE_API_SID=
STRINGEE_API_SECRET=
STRINGEE_PROJECT_ID=
STRINGEE_FROM_NUMBER=
STRINGEE_SIGNING_SECRET=
PUBLIC_APP_URL=https://your-domain.com
```

Trong Stringee PCC:
- Number: bat outbound, record outbound, gan queue/group/agent dung project.
- Queue `get_list_agents_url`: `https://your-domain.com/api/call/pcc-agents`
- Call settings `Event URL`: `https://your-domain.com/api/call/event`
- Neu dung luong PCC REST hien tai, `Callout answer URL` co the de trong.

Trong CRM Settings:
- `So goi ra Stringee` phai trung voi `STRINGEE_FROM_NUMBER`.
- Mapping CRM user -> Stringee userId.
- Neu route qua dien thoai agent, dien so agent va chon mode `SDT agent`.

## 5. Cau hinh LMS sync

```env
LMS_API_BASE_URL=
LMS_ENROLLMENT_PATH=/api/enrollments
LMS_API_KEY=
LMS_AUTH_HEADER=Authorization
LMS_AUTH_SCHEME=Bearer
LMS_WEBHOOK_SECRET=
LMS_TIMEOUT_MS=12000
```

Lead chuyen sang `Da dang ky hoc` co the sync sang LMS qua API serverless.

## 6. Chay local

```bash
npm run dev
```

Kiem tra:
- `/login`
- `/crm/leads`
- `/crm/database`
- `/crm/tasks`
- `/settings`

## 7. Build va deploy

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Vercel production can co day du env server-side va Vite env. Sau khi doi domain, nho cap nhat:
- `PUBLIC_APP_URL`
- Stringee Event URL
- Stringee Queue get_list_agents_url
- sitemap/robots neu dung public website.

## 8. Checklist truoc khi push template

- Khong co file `.env*` tru `.env.example`.
- Khong co real API secret/token/password trong source.
- Build pass.
- README/guide da ghi ro bien moi truong can dien.
- Demo data khong dung thong tin phu huynh/hoc sinh that.
