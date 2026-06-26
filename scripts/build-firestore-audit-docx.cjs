const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, Header, Footer, TableOfContents, PageBreak,
} = require('docx');

const CONTENT_W = 9360;
const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const HEAD_FILL = 'D5E8F0';
const CRIT_FILL = 'FBE0E0';
const OK_FILL = 'E2F0D9';

function H1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); }
function H2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); }
function H3(t) { return new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] }); }
function P(runs, opts = {}) {
  const children = Array.isArray(runs) ? runs : [new TextRun(runs)];
  return new Paragraph({ children, spacing: { after: 120 }, ...opts });
}
function bullet(runs, level = 0) {
  const children = Array.isArray(runs) ? runs : [new TextRun(runs)];
  return new Paragraph({ numbering: { reference: 'bullets', level }, children, spacing: { after: 60 } });
}
function num(runs, level = 0) {
  const children = Array.isArray(runs) ? runs : [new TextRun(runs)];
  return new Paragraph({ numbering: { reference: 'nums', level }, children, spacing: { after: 60 } });
}
function b(t) { return new TextRun({ text: t, bold: true }); }
function t(text) { return new TextRun(text); }
function code(text) { return new TextRun({ text, font: 'Consolas', size: 20 }); }
function codeBlock(lines) {
  return lines.map((ln) => new Paragraph({
    children: [new TextRun({ text: ln || ' ', font: 'Consolas', size: 19 })],
    shading: { fill: 'F2F2F2', type: ShadingType.CLEAR },
    spacing: { after: 0 },
  }));
}

function cell(content, { w, fill, bold = false, head = false } = {}) {
  const runs = Array.isArray(content) ? content : [new TextRun({ text: String(content), bold: bold || head, size: head ? 19 : 19 })];
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: runs })],
  });
}

function table(colWidths, headerCells, rows, rowFills = []) {
  const headRow = new TableRow({
    tableHeader: true,
    children: headerCells.map((h, i) => cell(h, { w: colWidths[i], fill: HEAD_FILL, head: true })),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((c, i) => cell(c, { w: colWidths[i], fill: rowFills[ri] })),
  }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: colWidths, rows: [headRow, ...bodyRows] });
}

const children = [];

// ---- Title ----
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  children: [new TextRun({ text: 'Báo cáo Kiểm toán Firestore Reads', bold: true, size: 40 })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 60 },
  children: [new TextRun({ text: 'Metta Frontend + Admin/CRM', size: 28, color: '555555' })],
}));
children.push(new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { after: 240 },
  children: [new TextRun({ text: 'Ngày: 24/06/2026  ·  Phương pháp: Static Audit toàn bộ source (src/** + api/**)', size: 20, color: '777777' })],
}));

children.push(new Paragraph({
  border: { top: { style: BorderStyle.SINGLE, size: 6, color: '2E75B6', space: 1 } },
  spacing: { after: 120 },
  children: [t('')],
}));

children.push(P([b('Lưu ý về số liệu: '), t('mọi con số reads là '), b('ước tính'), t(' dựa trên cấu trúc query thực tế trong code, kèm giả định kích thước collection. Điều chỉnh theo dữ liệu thật của bạn:')]));
children.push(bullet([code('leads'), t(' L≈3.000 (≈500 tạo trong 30 ngày) · '), code('leadActivities'), t(' A≈20.000 · '), code('appointments'), t('≈1.000 · '), code('users'), t(' U≈30 · '), code('pages'), t(' published P≈8 · '), code('pageSections'), t(' visible S≈60 · '), code('callLogs'), t('/agent≈200.')]));

children.push(new Paragraph({ spacing: { after: 120 }, children: [t('')] }));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Mục lục')] }));
children.push(new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-2' }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 1. Executive Summary ==========
children.push(H1('1. Executive Summary'));
children.push(P([b('Tin tốt (quan trọng nhất): '), t('Kiến trúc hiện tại KHÔNG phải app realtime nặng. Phần lớn dữ liệu lớn (leads list, dashboard, public site, blog) đã chuyển sang đọc qua Vercel API server-side với phân trang/snapshot, không dùng onSnapshot trên client. Đây là điểm cộng lớn so với CRM Firebase điển hình.')]));

children.push(H2('Treo máy có làm tăng reads không?'));
children.push(bullet([b('Không có polling client nào gọi Firestore theo thời gian khi idle. '), code('useLeads'), t(' có cơ chế '), code('pollMs'), t(' (useLeads.ts:151,169) nhưng KHÔNG page nào truyền pollMs → không chạy. Các setInterval còn lại đều là countdown/carousel/scroll (không chạm Firestore).')]));
children.push(bullet([t('Listener realtime đang sống (notifications, appointments, sales tasks) chỉ tính read khi document trong query thay đổi, không tự tăng theo thời gian. Idle thuần (không ai sửa data) → reads ≈ 0.')]));
children.push(bullet([b('Ngoại lệ duy nhất tăng reads theo thời gian: '), t('khi đang có cuộc gọi active không qua SDK (PCC) → poll getLogsForLead mỗi 3 giây (CallCenterContext.tsx:242). Không phải idle, nhưng tốn.')]));

children.push(H2('Các vấn đề SẼ SỬA đợt này'));
children.push(table(
  [620, 3900, 3140, 1700],
  ['#', 'Vấn đề', 'Vị trí', 'Mức độ'],
  [
    ['1', 'getActivities cho admin/manager không filter leadId — đọc cả collection rồi lọc client (cứu Lead Detail)', 'leadService.ts:1198-1200', 'Critical'],
    ['2', 'Export Lead Database = N×M reads (mỗi lead gọi getActivities, mà admin getActivities đọc TOÀN BỘ leadActivities mỗi lần)', 'LeadDatabasePage.tsx:293 + leadService.ts:1194-1209', 'Critical'],
    ['3', 'userService.getUsers() đọc cả collection users, không cache; gọi lại trên mọi page và mỗi lần saveLead', 'userService.ts:9-19 + leadService.ts:268-273', 'High'],
    ['4', 'capiEvents đọc toàn bộ collection (không limit)', 'capiService.ts:38', 'High'],
  ],
  [CRIT_FILL, CRIT_FILL, '', '']
));
children.push(P([b('Role tốn reads nhiều nhất: '), t('Admin/Manager (đọc toàn bộ leads/activities/appointments/users). Marketing/Ads, Design chỉ đọc đúng phạm vi của mình. Role Teacher/Học sinh/Lớp học KHÔNG tồn tại trong repo này (là LMS riêng).')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 2. Firestore Read Map ==========
children.push(H1('2. Firestore Read Map'));
children.push(P('Bảng tổng hợp tất cả điểm chạm Firestore (rút gọn cột để vừa khổ giấy). Đầy đủ chi tiết ở các mục sau.'));
children.push(table(
  [2100, 1500, 2160, 1900, 1700],
  ['Trang / chức năng', 'Role', 'Collection / query', 'Reads ước tính', 'Realtime / Idle / Rủi ro'],
  [
    ['Public: mọi trang (home, programs, blog, landing, legal)', 'Guest', 'pages(published)+pageSections(visible)+siteSettings (server)', '≈70 / lượt điều hướng', 'Không / Không / High'],
    ['Topbar (mọi trang admin)', 'All admin', 'appNotifications where userId== limit 20', '20 init, sau chỉ khi có noti mới', 'Có / chỉ khi noti đổi / Low'],
    ['Dashboard', 'Admin/Mgr/Sales', 'leads page 500 + appointments 200 + users(all) + center', '≈730 / load', 'Không / Không / Medium'],
    ['Leads CRM (kanban/table)', 'Admin/Mgr', 'leads count + offset page 100 (server)', 'count(1)+offset cost+100', 'Không / Không / High'],
    ['Leads CRM', 'Sales', 'leads where assignedTo== (server)', '≈100 / load', 'Không / Không / Low'],
    ['Lead Database → Export', 'Admin/Mgr', 'N× full leadActivities + appointments', '100×20.000 = 2.000.000', 'Không / Không / CRITICAL'],
    ['Lead Detail', 'Admin/Mgr', 'getActivities (FULL leadActivities) + getUsers(all)', 'A+U ≈ 20.030 / mở lead', 'Không / Không / CRITICAL'],
    ['Lead Detail', 'Sales', 'leadActivities where leadId==', '~vài chục', 'Không / Không / Low'],
    ['Appointments', 'Admin/Mgr', 'appointments range tháng orderBy limit 500', '≤500 init', 'Có / chỉ khi appt đổi / Medium'],
    ['Sales Tasks', 'Sales', '2 listeners (assignedTo== + assigneeIds array-contains) limit 50', '≤100', 'Có / chỉ khi đổi / Low'],
    ['Users / Lead Assignment', 'Admin/Mgr', 'users orderBy (all)', 'U≈30', 'Không / Không / Low'],
    ['CMS Pages/Editor', 'Admin/Mgr/Design', 'pages(all)+pageSections where pageId==+settings', 'P+sections+1', 'Không / Không / Low'],
    ['CAPI Events', 'Ads/Admin/Mgr', 'capiEvents orderBy (NO limit)', 'toàn bộ events', 'Không / Không / High'],
    ['Call (active PCC)', 'Sales', 'callLogs where agentId== (no limit) mỗi 3s', '200 × 20/phút khi gọi', 'Poll / Có khi gọi / High'],
  ],
  ['', '', '', '', '', CRIT_FILL, CRIT_FILL]
));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 3. Role-based ==========
children.push(H1('3. Role-based Read Analysis'));
children.push(P([t('Hệ thống chỉ có 5 role thực trong code: '), code('admin'), t(', '), code('manager'), t(', '), code('sales'), t(', '), code('ads'), t(' (Marketing), '), code('design'), t(' (firestore.rules:42-52). KHÔNG có role teacher/giáo viên, KHÔNG có module Học sinh/Lớp học/Điểm danh trong repo này — đó là LMS riêng (sync 1 chiều qua lmsSyncService).')]));

children.push(H2('Admin / Manager'));
children.push(bullet([b('Đang đọc: '), t('toàn bộ leads (server page hoặc getLeads() full), toàn bộ leadActivities khi mở lead detail/export, toàn bộ users lặp nhiều lần, appointments, salesManualTasks, CMS, CAPI events.')]));
children.push(bullet([b('Đáng lẽ đọc: '), t('chỉ trang lead đang xem; chỉ activities của lead đang mở; users cache 1 lần/session.')]));
children.push(bullet([b('Vấn đề chính: '), t('getActivities không filter leadId; getUsers không cache. Nếu sửa #1/#2: reads/giờ tụt từ ~200k xuống ~2-3k.')]));

children.push(H2('Sales'));
children.push(bullet([b('Đang đọc (đúng phạm vi): '), t('leads where assignedTo==uid, appointments của mình, tasks của mình, activities của 1 lead (where leadId==). Đây là phần scope tốt nhất.')]));
children.push(bullet([b('Lỗ hổng: '), t('khi đang gọi điện, getLogsForLead cho sales chạy where agentId==uid (no limit), lặp 3s/lần. Gọi 5 phút ≈ 20.000 reads.')]));

children.push(H2('Marketing / Ads (ads)'));
children.push(bullet([t('Chỉ đọc capiSettings/capiMappings/capiEvents + source engine. Rules chặn khỏi leads (rules:304-310). '), b('Không đọc CRM. '), t('Vấn đề: getEvents đọc toàn bộ capiEvents không limit (capiService.ts:38).')]));

children.push(H2('Design (design)'));
children.push(bullet([t('Chỉ chạm CMS (pages, pageSections, siteSettings, media, blogPosts) — rules:54-56,180-209. '), b('Không chạm leads/CRM. '), t('Reads thấp, an toàn.')]));

children.push(H2('Teacher / Guest'));
children.push(bullet([b('Teacher: '), t('không tồn tại trong repo.')]));
children.push(bullet([b('Guest (public): '), t('không auth, chỉ đọc public CMS snapshot qua server. Mỗi lượt điều hướng ≈ P+S+1 reads server-side.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 4. Idle ==========
children.push(H1('4. Idle / Treo Máy Analysis'));
children.push(P([b('Câu trả lời tổng: '), t('Treo máy KHÔNG làm reads tăng dần theo thời gian trong hầu hết trường hợp. Đây là kết luận quan trọng và khác với lo ngại ban đầu.')]));
children.push(num([b('Idle không ai sửa data → reads = 0. '), t('Không có setInterval client nào gọi Firestore định kỳ. useLeads.pollMs tồn tại nhưng không page nào bật. Các setInterval ở PublicHeader:138, PublicFooter:50 chỉ poll DOM để scroll (≤3s); carousel/countdown khác = 0 Firestore.')]));
children.push(num([b('Listener đang sống khi idle: '), t('appNotifications (limit 20), appointments (limit 500, chỉ trang Appointments), salesManualTasks (limit 50). Firestore chỉ tính read khi document trong kết quả thay đổi. Idle không ai đổi → không phát sinh read. Listener idle ≈ miễn phí.')]));
children.push(num([b('Nếu người khác cập nhật data: '), t('mỗi doc thay đổi trong query → mỗi tab đang nghe bị tính 1 read cho doc đó. 20 lead đổi/giờ + 50 sales mở tab Topbar → ~vài trăm reads/giờ (nhỏ).')]));
children.push(num([b('Tăng reads theo thời gian thật sự (KHÔNG phải idle): '), t('chỉ khi đang có cuộc gọi PCC active → poll 3s getLogsForLead. Kết thúc cuộc gọi → clearInterval (CallCenterContext.tsx:245).')]));
children.push(num([b('Cleanup listener: '), t('tất cả onSnapshot đều return unsubscribe đúng chuẩn (Topbar:41, AppointmentsPage:148, SalesTasksPage:558-561, salesTaskService:281-284, leadService:920-923). Không thấy listener leak. Đổi tab/route → unmount → unsubscribe.')]));
children.push(P([b('Kết luận: '), t('Mở tab Dashboard/Leads/Lead Detail/CMS rồi để 30 phút / 1h / 2h KHÔNG làm tăng reads (các trang này dùng getDocs 1 lần). Mở tab Appointments/Sales Tasks/Topbar idle → reads chỉ tăng nếu có người khác sửa appointment/task/notification tương ứng.')]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 5. Critical Issues ==========
children.push(H1('5. Critical Issues'));

function issue(tag, title, fields) {
  children.push(H2(`${tag} — ${title}`));
  fields.forEach(([k, v]) => children.push(bullet([b(k + ': '), ...(Array.isArray(v) ? v : [t(v)])])));
}

issue('CRIT-1', 'Export Lead Database: N×M full-collection reads', [
  ['Mức độ', 'Critical'],
  ['File', 'LeadDatabasePage.tsx:293 — Promise.all(leads.map(lead => leadService.getActivities(lead.id)))'],
  ['Lỗi', 'getActivities cho admin (leadService.ts:1198-1200) chạy query orderBy createdAt, KHÔNG where leadId==, KHÔNG limit → đọc toàn bộ leadActivities mỗi lần. Nhân số lead trên trang.'],
  ['Thiệt hại', '100 leads × 20.000 activities = 2.000.000 reads cho 1 lần bấm Export. Bào sạch quota free 50k chỉ trong vài giây.'],
  ['Sửa', 'Đọc activities 1 lần rồi groupBy(leadId) trên client; hoặc where(leadId, in, batch). Lý tưởng: chuyển export sang server-side.'],
]);
issue('CRIT-2', 'getActivities admin không filter leadId (gốc của CRIT-1)', [
  ['Mức độ', 'Critical'],
  ['File', 'leadService.ts:1197-1200'],
  ['Lỗi', 'Nhánh sales có where(leadId==) nhưng nhánh admin/manager bỏ filter → mỗi lần mở Lead Detail (LeadDetailPage.tsx:166) admin đọc cả 20.000 activities chỉ để hiển thị timeline 1 lead.'],
  ['Thiệt hại', 'Mỗi mở lead = ~20.000 reads (admin). 20 lead/ngày × 5 admin = 2M reads/ngày.'],
  ['Sửa', 'Luôn dùng where(leadId==) cho mọi role (rules:218-221 đã cho phép). Bỏ replaceFirestoreDemoActivities khỏi đường đọc nóng.'],
]);
issue('CRIT-4', 'userService.getUsers() đọc cả collection, không cache, gọi lặp', [
  ['Mức độ', 'High'],
  ['File', 'userService.ts:9-19; gọi tại Dashboard:229,251, Leads:423, LeadDetail:169, LeadDatabase:157, SalesTasks:545, LeadAssignment:253, Users:31, CallCenterSettingsCard:29, và refreshUsersForAssignmentRepair (leadService.ts:268-273) mỗi getLeads/saveLead.'],
  ['Thiệt hại', 'U≈30 reads mỗi lần. Mỗi saveLead admin = +30. Mỗi Dashboard refresh = +30 (×2). Cộng dồn lớn.'],
  ['Sửa', 'Cache users theo TTL (2 phút) trong store / context global đọc 1 lần; invalidate khi saveUser/deleteUser; bỏ refreshUsersForAssignmentRepair khỏi đường đọc nóng.'],
]);
issue('CAPI', 'capiEvents đọc toàn bộ collection (không limit)', [
  ['Mức độ', 'High'],
  ['File', 'capiService.ts:38 — getDocs(query(collection(COL_EVENTS), orderBy(createdAt desc)))'],
  ['Lỗi', 'getEvents đọc TOÀN BỘ collection capiEvents, không limit. Collection này phình rất nhanh vì mỗi tracking là 1 doc.'],
  ['Thiệt hại', 'Reads tăng tuyến tính theo tổng số event tích lũy — càng dùng lâu càng đắt.'],
  ['Sửa', 'Thêm limit(100) + nút "Xem thêm" (startAfter) khi cần xem nhiều hơn.'],
]);

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 6. Optimization Plan ==========
children.push(H1('6. Optimization Plan'));
children.push(H2('Sửa ngay đợt này — ĐÃ CHỐT làm (an toàn, KHÔNG đụng call center)'));
[
  'CRIT-2: thêm where(leadId==) cho admin trong getActivities (1 dòng, cứu Lead Detail).',
  'CRIT-1: viết lại exportDatabase đọc activities 1 lần rồi group.',
  'CRIT-4: cache users (TTL 2 phút) + invalidate khi saveUser/deleteUser + bỏ refreshUsersForAssignmentRepair khỏi đường đọc nóng.',
  'CapiEvents: thêm limit(100) + nút xem thêm (capiService.ts:38).',
].forEach((x) => children.push(num(x)));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 7. Code-level ==========
children.push(H1('7. Code-level Recommendations'));

children.push(H3('(1) getActivities — filter leadId cho mọi role (leadService.ts:1197)'));
children.push(...codeBlock([
  '// HIỆN TẠI (admin đọc cả collection):',
  'const activityQuery = user?.role === "sales"',
  '  ? query(collection(db!, COL_ACTIVITIES), where("leadId","==",leadId), orderBy("createdAt","desc"))',
  '  : query(collection(db!, COL_ACTIVITIES), orderBy("createdAt","desc"));   // ❌ toàn bộ',
  '',
  '// ĐỀ XUẤT: luôn filter leadId (rules:218-221 đã cho phép admin)',
  'const activityQuery = query(',
  '  collection(db!, COL_ACTIVITIES),',
  '  where("leadId","==",leadId),',
  '  orderBy("createdAt","desc"),',
  ');',
]));
children.push(P([t('Cần composite index '), code('(leadId ASC, createdAt DESC)'), t(' cho leadActivities. Bỏ replaceFirestoreDemoActivities ở đường đọc nóng.')]));

children.push(H3('(2) Export — đọc activities 1 lần (LeadDatabasePage.tsx:293)'));
children.push(...codeBlock([
  'const allActs = await getDocs(collection(db!, "leadActivities")); // 1 lần, A reads',
  'const byLead = new Map();',
  'allActs.docs.forEach(d => {',
  '  const a = { id: d.id, ...d.data() };',
  '  (byLead.get(a.leadId) ?? byLead.set(a.leadId, []).get(a.leadId)).push(a);',
  '});',
  'const activities = leads.flatMap(l => byLead.get(l.id) ?? []);',
]));


children.push(H3('(3) Cache users — TTL 2 phút (userService.ts:9)'));
children.push(...codeBlock([
  'const USERS_TTL_MS = 2 * 60_000;   // 2 phút',
  'let usersCache = null;',
  'getUsers: async (force = false) => {',
  '  if (!force && usersCache && Date.now() - usersCache.at < USERS_TTL_MS) return delay(usersCache.data);',
  '  // ... getDocs ...',
  '  usersCache = { at: Date.now(), data: store.users };',
  '  return delay(store.users);',
  '},',
  '// saveUser/deleteUser: sau khi ghi xong gọi getUsers(true) để làm tươi cache ngay',
  '// + XOÁ refreshUsersForAssignmentRepair khỏi getLeads/getLeadsPage (leadService.ts:787,837)',
]));

children.push(H3('(4) CapiEvents limit (capiService.ts:38)'));
children.push(...codeBlock([
  '// TRƯỚC:',
  'getDocs(query(collection(db!, COL_EVENTS), orderBy("createdAt","desc")))',
  '// SAU:',
  'getDocs(query(collection(db!, COL_EVENTS), orderBy("createdAt","desc"), limit(100)))',
]));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 8. Final Verdict ==========
children.push(H1('8. Final Verdict'));
children.push(P([b('Metta admin hiện có an toàn về Firestore reads không? '), t('Tạm an toàn ở mức vận hành nhỏ, NHƯNG có vài "mìn" critical — chủ yếu là getActivities đọc cả collection (CRIT-1/CRIT-2). Chỉ cần 1 admin mở 10-20 lead detail/ngày là đã đốt hàng triệu reads, bất kể số lượng người dùng. Đây là rủi ro lớn hơn cả việc treo máy.')]));
children.push(table(
  [2200, 7160],
  ['Quy mô', 'Đánh giá'],
  [
    ['10 user/ngày', 'Ổn về listener/idle. Nhưng nếu dùng Lead Detail/Export thường xuyên vẫn có thể vượt quota free 50k/ngày chỉ vì getActivities đọc cả collection. Sửa 4 việc đợt này là đủ an toàn.'],
    ['100 user/ngày', 'CRM scope theo role khá tốt; sau khi sửa getActivities + cache users thì chi phí reads hạ rõ rệt, chạy thoải mái.'],
    ['1000 user/ngày', 'Vẫn khả thi với Firebase. Sau đợt 1, nguồn reads còn lại chủ yếu là traffic public + phân trang sâu — sẽ tối ưu tiếp ở đợt sau (ngoài phạm vi tài liệu này).'],
  ]
));
children.push(P([b('Rủi ro lớn nhất: '), t('không phải realtime/idle (đã ổn), mà là các hàm "đọc full collection rồi lọc client" (đứng đầu là getActivities cho admin) — chúng scale theo kích thước DỮ LIỆU, không theo số user, nên càng dùng lâu càng đắt dù ít người. Đây chính là 4 việc đợt này nhắm tới.')]));
children.push(P([b('Có nên tiếp tục Firebase/Vercel? '), t('CÓ — chỉ cần tối ưu code, không cần đổi nền tảng. Kiến trúc server-side qua Vercel API + phân trang đã đúng hướng.')]));

children.push(H2('Phụ lục — Checklist nhanh cho dev (đợt này)'));
[
  'leadService.ts:1198 → thêm where(leadId==) cho mọi role (CRIT-2)',
  'LeadDatabasePage.tsx:293 → đọc leadActivities 1 lần rồi group (CRIT-1)',
  'userService.ts:9 → cache TTL 2 phút + invalidate khi saveUser/deleteUser; leadService.ts:787,837 → bỏ refreshUsers khỏi đường nóng (CRIT-4)',
  'capiService.ts:38 → thêm limit(100) + nút xem thêm (CAPI)',
  'firestore.indexes.json → thêm index leadActivities (leadId, createdAt)',
].forEach((x) => children.push(bullet(x)));

children.push(new Paragraph({ children: [new PageBreak()] }));

// ========== 9. Dev Guide ==========
children.push(H1('9. Hướng dẫn thực thi cho Dev — Đợt 1'));
children.push(P([b('Phạm vi đợt này: '), t('chỉ 4 việc dưới đây, KHÔNG đụng tới call center. Tất cả đều là tối ưu cách ĐỌC dữ liệu — không đổi logic ghi, không đổi UI/tính năng, không đổi dữ liệu, dễ revert.')]));
children.push(table(
  [1500, 4060, 2100, 1700],
  ['Mã', 'Việc', 'File', 'Ưu tiên'],
  [
    ['CRIT-2', 'getActivities luôn filter leadId', 'leadService.ts:1197', '1 (làm trước)'],
    ['CRIT-1', 'Export đọc leadActivities 1 lần', 'LeadDatabasePage.tsx:293', '2'],
    ['CRIT-4', 'Cache users TTL 2 phút', 'userService.ts:9; leadService.ts:268,787,837', '3'],
    ['CAPI', 'Giới hạn capiEvents + xem thêm', 'capiService.ts:38', '4'],
  ]
));

children.push(H2('Bước 1 — CRIT-2: getActivities luôn filter theo leadId'));
children.push(P([b('Vấn đề: '), t('nhánh admin/manager đang đọc TOÀN BỘ leadActivities mỗi lần mở Lead Detail.')]));
children.push(P([b('Sửa tại leadService.ts ~1197:')]));
children.push(...codeBlock([
  '// TRƯỚC:',
  'const activityQuery = user?.role === "sales"',
  '  ? query(collection(db!, COL_ACTIVITIES), where("leadId","==",leadId), orderBy("createdAt","desc"))',
  '  : query(collection(db!, COL_ACTIVITIES), orderBy("createdAt","desc"));   // đọc cả collection',
  '',
  '// SAU (mọi role đều filter leadId):',
  'const activityQuery = query(',
  '  collection(db!, COL_ACTIVITIES),',
  '  where("leadId","==",leadId),',
  '  orderBy("createdAt","desc"),',
  ');',
]));
children.push(bullet([b('Việc kèm theo: '), t('bỏ lời gọi replaceFirestoreDemoActivities trên đường đọc nóng (nó quét toàn bộ collection); chỉ chạy lúc seed/admin reset nếu cần.')]));
children.push(bullet([b('Index cần thêm (firestore.indexes.json): '), code('leadActivities (leadId ASC, createdAt DESC)')]));
children.push(bullet([b('Cách test: '), t('Bật Firestore Usage / log network. Mở 1 lead bất kỳ bằng tài khoản admin → timeline phải hiển thị ĐẦY ĐỦ và ĐÚNG như cũ; số reads chỉ còn = số activity của lead đó (vài chục) thay vì ~20.000.')]));
children.push(bullet([b('Kết quả mong đợi: '), t('mở 1 Lead Detail: ~20.000 → vài chục reads. UI không đổi.')]));
children.push(bullet([b('Rủi ro: '), t('thấp. Rules đã cho admin đọc theo leadId (firestore.rules:218-221). Nếu quên tạo index, query sẽ báo lỗi cần index — tạo theo link Firebase đưa ra.')]));

children.push(H2('Bước 2 — CRIT-1: Export đọc leadActivities 1 lần'));
children.push(P([b('Vấn đề: '), t('exportDatabase gọi getActivities cho TỪNG lead → N lần, mỗi lần (sau bước 1 vẫn là) 1 query. Với N lớn vẫn nhiều round-trip. Gộp thành 1 lần đọc + group.')]));
children.push(P([b('Sửa tại LeadDatabasePage.tsx ~293:')]));
children.push(...codeBlock([
  '// TRƯỚC:',
  'const activities = (await Promise.all(',
  '  leads.map((lead) => leadService.getActivities(lead.id))',
  ')).flat();',
  '',
  '// SAU: đọc 1 lần rồi group theo leadId',
  'const snap = await getDocs(collection(db!, "leadActivities"));',
  'const byLead = new Map();',
  'snap.docs.forEach((d) => {',
  '  const a = { id: d.id, ...d.data() };',
  '  if (!byLead.has(a.leadId)) byLead.set(a.leadId, []);',
  '  byLead.get(a.leadId).push(a);',
  '});',
  'const activities = leads.flatMap((l) => byLead.get(l.id) ?? []);',
]));
children.push(bullet([b('Lưu ý: '), t('nên bọc trong service (vd leadService.getAllActivitiesGrouped()) thay vì gọi getDocs thẳng trong page, để giữ kiến trúc nhất quán. Tùy team.')]));
children.push(bullet([b('Cách test: '), t('Bấm Export trên trang Lead Database → file Excel xuất ra phải GIỐNG HỆT bản cũ (đủ Leads + Lead Activities + Appointments). So sánh số dòng activity giữa file cũ và file mới phải bằng nhau.')]));
children.push(bullet([b('Kết quả mong đợi: '), t('1 lần export: ~2.000.000 → ~A reads (1 lần quét, vd ~20.000). Chạy nhanh hơn rõ rệt.')]));
children.push(bullet([b('Rủi ro: '), t('thấp. Chỉ đổi cách gom dữ liệu, nội dung file không đổi.')]));

children.push(H2('Bước 3 — CRIT-4: Cache danh sách users (TTL 2 phút)'));
children.push(P([b('Vấn đề: '), t('getUsers đọc cả collection mỗi lần gọi, bị gọi rất nhiều nơi + mỗi saveLead.')]));
children.push(P([b('Sửa tại userService.ts:9:')]));
children.push(...codeBlock([
  'const USERS_TTL_MS = 2 * 60_000;   // 2 phút',
  'let usersCache = null;',
  '',
  'getUsers: async (force = false) => {',
  '  if (!force && usersCache && Date.now() - usersCache.at < USERS_TTL_MS) {',
  '    return delay(usersCache.data);            // dùng lại, KHÔNG đọc Firestore',
  '  }',
  '  if (USE_FIREBASE) {',
  '    const snap = await getDocs(query(collection(db!, "users"), orderBy("fullName","asc")));',
  '    store.users = snap.docs.map((item) => ({ id: item.id, ...item.data() }));',
  '  }',
  '  usersCache = { at: Date.now(), data: store.users };',
  '  return delay(store.users);',
  '},',
]));
children.push(bullet([b('Invalidate cache (bắt buộc): '), t('trong saveUser và deleteUser, sau khi ghi xong gọi getUsers(true) (force) để cache tươi ngay — người vừa sửa thấy thay đổi tức thì.')]));
children.push(bullet([b('Đường đọc nóng: '), t('trong leadService.ts, refreshUsersForAssignmentRepair (≈268) đang gọi getUsers() mỗi getLeads/getLeadsPage/saveLead. Cho nó dùng cache (gọi getUsers() thường, KHÔNG force). Lý tưởng: chỉ force khi thật sự gán lead.')]));
children.push(bullet([b('Cách test: '), t('(1) Mở Dashboard nhiều lần trong 2 phút → chỉ 1 lần đọc users. (2) Tạo user mới ở trang Users → danh sách cập nhật NGAY trên tab đang thao tác. (3) Tên sales, dropdown gán lead, lọc theo nhân viên: hiển thị đúng như cũ.')]));
children.push(bullet([b('Kết quả mong đợi: '), t('users chỉ đọc ~1 lần / 2 phút thay vì hàng trăm lần/phiên. UI không đổi.')]));
children.push(bullet([b('Rủi ro: '), t('thấp. Điểm cần lưu ý duy nhất: tab của NGƯỜI KHÁC có thể thấy danh sách user trễ tối đa 2 phút. User data hiếm khi đổi nên chấp nhận được; có thể hạ TTL nếu muốn.')]));

children.push(H2('Bước 4 — CAPI: giới hạn capiEvents'));
children.push(P([b('Vấn đề: '), t('getEvents đọc toàn bộ collection capiEvents (không limit) — phình nhanh vì mỗi tracking là 1 doc.')]));
children.push(P([b('Sửa tại capiService.ts:38:')]));
children.push(...codeBlock([
  '// TRƯỚC:',
  'getDocs(query(collection(db!, COL_EVENTS), orderBy("createdAt","desc")))',
  '',
  '// SAU:',
  'getDocs(query(collection(db!, COL_EVENTS), orderBy("createdAt","desc"), limit(100)))',
]));
children.push(bullet([b('UI: '), t('thêm nút "Xem thêm" (load tiếp 100 bằng startAfter) nếu cần xem nhiều hơn. Mặc định 100 dòng mới nhất là đủ cho đa số nhu cầu.')]));
children.push(bullet([b('Cách test: '), t('Mở trang CAPI Events → hiện 100 sự kiện mới nhất, đúng thứ tự thời gian. Reads không còn tăng theo tổng số event.')]));
children.push(bullet([b('Rủi ro: '), t('rất thấp. Chỉ giới hạn số dòng hiển thị mặc định.')]));

children.push(H2('Định nghĩa "Done" cho đợt 1'));
[
  'Lead Detail (admin) hiển thị timeline đầy đủ, reads giảm về mức của 1 lead.',
  'Export Lead Database ra file giống hệt bản cũ, chạy nhanh hơn.',
  'Danh sách users cache 2 phút, invalidate đúng khi thêm/sửa/xoá user.',
  'Trang CAPI Events giới hạn 100 dòng + xem thêm.',
  'Đã thêm index leadActivities (leadId, createdAt) và deploy firestore.indexes.json.',
  'Hồi quy: gọi đi vẫn bình thường, gán lead/lọc/dashboard không đổi.',
].forEach((x) => children.push(bullet(x)));

// ---- Build ----
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: 'Arial', color: '1F4E79' },
        paragraph: { spacing: { before: 260, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, font: 'Arial', color: '2E75B6' },
        paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: '404040' },
        paragraph: { spacing: { before: 120, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 320 } } } }] },
      { reference: 'nums', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 600, hanging: 320 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Kiểm toán Firestore Reads — METTA', size: 16, color: '999999' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Trang ', size: 16, color: '999999' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '999999' })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync('Bao-cao-kiem-toan-Firestore-reads-METTA-2026-06-24.docx', buf);
  console.log('WROTE Bao-cao-kiem-toan-Firestore-reads-METTA-2026-06-24.docx', buf.length, 'bytes');
});
