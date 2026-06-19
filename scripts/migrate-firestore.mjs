#!/usr/bin/env node
/**
 * migrate-firestore.mjs
 * ----------------------------------------------------------------------------
 * Copy TOÀN BỘ Firestore từ project CŨ sang project MỚI, giữ nguyên:
 *   - document ID
 *   - subcollection (đệ quy)
 *
 * DÙNG:
 *   node scripts/migrate-firestore.mjs --old ./key-old.json --new ./key-new.json
 *   node scripts/migrate-firestore.mjs --old ./key-old.json --new ./key-new.json --dry-run
 *   node scripts/migrate-firestore.mjs --old ... --new ... --only leads,appointments
 *   node scripts/migrate-firestore.mjs --old ... --new ... --flat        (bỏ qua subcollection cho nhanh)
 *
 * THAM SỐ:
 *   --old <path>   file service-account JSON của project NGUỒN  (bắt buộc)
 *   --new <path>   file service-account JSON của project ĐÍCH   (bắt buộc)
 *   --dry-run      chỉ đếm, KHÔNG ghi
 *   --only a,b,c   chỉ copy các collection gốc này
 *   --flat         không quét subcollection (nhanh hơn nếu dữ liệu phẳng)
 *
 * YÊU CẦU:
 *   - đã cài firebase-admin (dự án có sẵn): npm i firebase-admin
 *   - 2 file key lấy ở: Firebase Console → Project settings → Service accounts → Generate new private key
 *   - KHÔNG commit 2 file key này lên git (thêm vào .gitignore)
 *
 * LƯU Ý:
 *   - set() ghi đè theo ID → chạy lại nhiều lần an toàn (idempotent).
 *   - Collection rất lớn (>100k docs) nên dùng gcloud export/import thay vì script này.
 *   - Auth users & Storage migrate riêng (xem file hướng dẫn .docx).
 * ----------------------------------------------------------------------------
 */
import fs from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function arg(name, def = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (!v || v.startsWith('--')) ? true : v;
}

const oldKeyPath = arg('old');
const newKeyPath = arg('new');
const dryRun = Boolean(arg('dry-run', false));
const flat = Boolean(arg('flat', false));
const onlyArg = arg('only');
const only = typeof onlyArg === 'string' ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : null;

if (!oldKeyPath || !newKeyPath) {
  console.error('Thiếu tham số.\nVd: node scripts/migrate-firestore.mjs --old ./key-old.json --new ./key-new.json [--dry-run] [--only leads,appointments] [--flat]');
  process.exit(1);
}

const oldKey = JSON.parse(fs.readFileSync(oldKeyPath, 'utf8'));
const newKey = JSON.parse(fs.readFileSync(newKeyPath, 'utf8'));

const srcDb = getFirestore(initializeApp({ credential: cert(oldKey) }, 'src'));
const dstDb = getFirestore(initializeApp({ credential: cert(newKey) }, 'dst'));

console.log('──────────────────────────────────────────────');
console.log(`Nguồn (đọc) : ${oldKey.project_id}`);
console.log(`Đích  (ghi) : ${newKey.project_id}`);
console.log(dryRun ? '*** DRY-RUN: chỉ ĐẾM, không ghi ***' : '*** GHI THẬT sang project đích ***');
if (flat) console.log('(--flat: bỏ qua subcollection)');
console.log('──────────────────────────────────────────────');

if (oldKey.project_id === newKey.project_id) {
  console.error('LỖI: nguồn và đích cùng project_id — dừng để tránh ghi đè nhầm.');
  process.exit(1);
}

let totalDocs = 0;

async function copyCollection(srcCol, dstColPath) {
  const snap = await srcCol.get();
  if (snap.empty) return;

  let batch = dstDb.batch();
  let ops = 0;
  const flush = async () => { if (ops > 0) { await batch.commit(); batch = dstDb.batch(); ops = 0; } };

  for (const doc of snap.docs) {
    totalDocs++;
    if (!dryRun) {
      batch.set(dstDb.doc(`${dstColPath}/${doc.id}`), doc.data());
      ops++;
      if (ops >= 400) await flush(); // Firestore batch tối đa 500 ops
    }
    if (!flat) {
      const subs = await doc.ref.listCollections();
      for (const sub of subs) {
        await copyCollection(sub, `${dstColPath}/${doc.id}/${sub.id}`);
      }
    }
  }
  await flush();
  console.log(`  ✓ ${dstColPath}: ${snap.size} docs`);
}

const roots = await srcDb.listCollections();
const targets = only ? roots.filter((c) => only.includes(c.id)) : roots;

if (only) {
  const missing = only.filter((name) => !roots.some((c) => c.id === name));
  if (missing.length) console.warn(`Cảnh báo: không thấy collection: ${missing.join(', ')}`);
}

console.log(`Sẽ copy ${targets.length} collection gốc: ${targets.map((c) => c.id).join(', ') || '(không có)'}\n`);

for (const col of targets) {
  console.log(`→ Collection: ${col.id}`);
  await copyCollection(col, col.id);
}

console.log(`\nHOÀN TẤT. Tổng document đã ${dryRun ? 'đếm' : 'copy'}: ${totalDocs}`);
process.exit(0);
