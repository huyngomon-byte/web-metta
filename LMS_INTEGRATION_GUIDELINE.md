# Guideline dau noi CRM -> LMS enrollment

## Muc tieu

Khi lead trong CRM duoc chuyen sang stage `Da dang ky hoc`, he thong CRM se dong goi toan bo du lieu enrollment va sync sang LMS:

- Thong tin phu huynh: ten, SDT, email, SDT nguoi referral neu co.
- Thong tin hoc sinh: ten, tuoi, truong, lop hien tai.
- Thong tin enrollment: khoa hoc quan tam, trung tam/co so, ngay chot, loai enrollment.
- Finance: deal size, discount, expected revenue, revenue, currency, package/note.
- CRM history: stage history, timeline cham soc, lich hen, owner/sales, source, priority, pending/lost reason.

CRM dang co engine trung gian:

- Frontend/service: `src/services/lmsSyncService.ts`
- API adapter: `api/lms-sync-enrollment.ts`
- Payload type: `src/types/lms.ts`

## Luong xu ly

1. Sales/Admin move lead sang `Da dang ky hoc`.
2. `leadService.saveLead()` tinh `revenue`, `revenueAt`, `wonAt`.
3. CRM lay them `Lead Activities` va `Appointments` cua lead.
4. CRM build payload schema `metta-lms-enrollment-v1`.
5. Frontend goi `POST /api/lms-sync-enrollment`.
6. API adapter ky request, gan idempotency key, va forward sang LMS endpoint.
7. LMS tao/cap nhat hoc vien, phu huynh, enrollment/class.
8. Neu LMS tra `externalId`, CRM luu vao `lead.convertedToStudentId` de tranh tao duplicate.
9. CRM ghi activity/log sync de audit.

Local dev mac dinh la dry-run de khong bi proxy `/api` len production lam loi. Muon test real API trong local, set `VITE_ENABLE_LMS_SYNC_DEV=true` va chay API endpoint local/Vercel dev.

## Cau hinh environment

Them cac bien sau tren Vercel/project runtime:

```env
LMS_API_BASE_URL=https://your-lms-domain.com
LMS_ENROLLMENT_PATH=/api/enrollments
LMS_API_KEY=
LMS_AUTH_HEADER=Authorization
LMS_AUTH_SCHEME=Bearer
LMS_WEBHOOK_SECRET=
LMS_TIMEOUT_MS=12000
VITE_ENABLE_LMS_SYNC_DEV=false
```

Ghi chu:

- `LMS_API_BASE_URL` rong thi API adapter se nhan payload o che do dry-run va khong forward.
- `X-Idempotency-Key` luon duoc gui de LMS xu ly retry an toan.
- Neu co `LMS_WEBHOOK_SECRET`, CRM gui `X-METTA-Signature` la HMAC SHA256 cua raw JSON body.

## Contract API LMS can expose

CRM se goi:

```http
POST {LMS_API_BASE_URL}{LMS_ENROLLMENT_PATH}
Content-Type: application/json
Authorization: Bearer {LMS_API_KEY}
X-METTA-Event: enrollment.created
X-Idempotency-Key: lms_{leadId}_{timestamp}
X-METTA-Signature: {hmac_sha256_body}
```

Response khuyen nghi:

```json
{
  "ok": true,
  "externalId": "student_12345",
  "message": "Enrollment synced"
}
```

Neu da ton tai theo idempotency key hoac theo parent phone + student name, LMS nen tra lai cung `externalId` va `ok: true`.

## Payload chinh

Payload day du co schema:

```json
{
  "schemaVersion": "metta-lms-enrollment-v1",
  "eventId": "lms_lead-id_timestamp",
  "eventName": "enrollment.created",
  "occurredAt": "2026-06-04T10:00:00.000Z",
  "lead": {
    "id": "lead-id",
    "status": "Da dang ky hoc",
    "createdAt": "...",
    "updatedAt": "..."
  },
  "parent": {
    "name": "Chi A",
    "phone": "0971000000",
    "email": "parent@example.com",
    "referralPhone": "0972000000"
  },
  "student": {
    "name": "Bao An",
    "age": "8",
    "school": "School",
    "currentClass": "Lop 3"
  },
  "enrollment": {
    "studentExternalId": "crm-lead-id",
    "interestedCourse": "METTA Kiddies",
    "centerName": "METTA Quan 1",
    "enrollmentType": "new",
    "wonAt": "..."
  },
  "finance": {
    "dealSize": 20000000,
    "discountPercent": 10,
    "expectedRevenue": 18000000,
    "revenue": 18000000,
    "currency": "VND"
  },
  "crm": {
    "ownerId": "u2",
    "ownerName": "Linh",
    "source": "Referral",
    "priorityLevel": 5,
    "stageHistory": [],
    "activities": [],
    "appointments": []
  }
}
```

## Mapping CRM -> LMS

| CRM field | LMS field de xuat | Ghi chu |
| --- | --- | --- |
| `lead.id` | `crmLeadId` | Key doi soat bat buoc |
| `parentName/fullName` | `guardian.name` | Uu tien parentName |
| `phone` | `guardian.phone` | Dung de dedupe phu huynh |
| `email` | `guardian.email` | Optional |
| `referralPhone` | `guardian.referredByPhone` | Bat buoc neu source Referral |
| `studentName/fullName` | `student.name` | Uu tien studentName |
| `age` | `student.age` | String/number tuy LMS |
| `school` | `student.school` | Optional |
| `currentClass` | `student.currentClass` | Optional |
| `interestedCourse` | `enrollment.programName` | LMS map sang course/class |
| `centerName` | `enrollment.centerName` | Co so hoc |
| `wonAt` | `enrollment.enrolledAt` | Ngay chot |
| `dealSize` | `finance.listPrice` | VND |
| `discountPercent` | `finance.discountPercent` | 0-30 |
| `revenue` | `finance.finalRevenue` | Gia tri chot |
| `stageHistory` | `crm.stageHistory` | Audit |
| `activities` | `crm.contactTimeline` | Timeline tu van |
| `appointments` | `crm.appointments` | Lich tu van/test |

## De xuat xu ly duplicate trong LMS

Thu tu match:

1. `studentExternalId` neu lead da tung sync va CRM co `convertedToStudentId`.
2. `crmLeadId`.
3. `guardian.phone + student.name`.
4. `guardian.email + student.name`.

Neu match duoc record cu, LMS update enrollment thay vi tao hoc sinh moi.

## Error, retry va audit

- CRM khong chan thao tac sales khi LMS loi. Loi se duoc ghi vao Lead Activity: `LMS sync failed: ...`.
- API adapter ghi log vao Firestore collection `lmsSyncLogs` neu Firebase Admin co cau hinh.
- Frontend ghi 200 log gan nhat vao localStorage key `metta_lms_sync_logs`.
- LMS nen tra ma loi ro rang: `400 invalid payload`, `401 unauthorized`, `409 duplicate conflict`, `500 internal error`.
- Retry nen dung cung `X-Idempotency-Key` de khong tao duplicate.

## Checklist test

1. De `LMS_API_BASE_URL` rong, move 1 lead sang `Da dang ky hoc`; CRM phai co activity dry-run LMS.
2. Set endpoint LMS sandbox va `VITE_ENABLE_LMS_SYNC_DEV=true`.
3. Move lead moi sang `Da dang ky hoc`.
4. Kiem tra LMS tao phu huynh + hoc sinh + enrollment dung finance/course/center.
5. Kiem tra response co `externalId` va CRM luu `convertedToStudentId`.
6. Move/edit lai lead da sync, LMS phai update record cu, khong duplicate.
7. Test source Referral: payload phai co `parent.referralPhone`.
8. Test network/API error: CRM van luu lead won, activity co log loi LMS.
