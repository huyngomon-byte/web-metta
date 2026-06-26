/* eslint-disable */
// Sinh báo cáo QA chi tiết cho CRM Leads (Phương án A) -> file .docx
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType, ShadingType,
  TableOfContents, PageNumber, Header, Footer, PageBreak, VerticalAlign,
} = require('docx');

const BLUE = '003B7A';
const LIGHT = 'EAF1F8';
const GREY = 'F2F4F7';
const RED = 'C0392B';
const AMBER = 'B7791F';
const GREEN = '1E7E45';
const CODE_BG = 'F5F6F8';
const CONTENT_W = 9360; // US Letter, 1" margins

// ---------- helpers ----------
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });

function P(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, ...opts })];
  return new Paragraph({ spacing: { after: 120, line: 276 }, children: runs, ...(opts.paragraph || {}) });
}
function bullet(text, level = 0) {
  const runs = Array.isArray(text) ? text : [new TextRun(text)];
  return new Paragraph({ numbering: { reference: 'bul', level }, spacing: { after: 60, line: 268 }, children: runs });
}
function num(text, level = 0) {
  const runs = Array.isArray(text) ? text : [new TextRun(text)];
  return new Paragraph({ numbering: { reference: 'ord', level }, spacing: { after: 60, line: 268 }, children: runs });
}
function r(text, opts = {}) { return new TextRun({ text, ...opts }); }
function bold(text) { return new TextRun({ text, bold: true }); }
function code(text) { return new TextRun({ text, font: 'Consolas', size: 19 }); }

function codeBlock(lines, caption) {
  const body = (Array.isArray(lines) ? lines : lines.split('\n')).map((ln) =>
    new Paragraph({
      spacing: { after: 0, line: 248 },
      children: [new TextRun({ text: ln === '' ? ' ' : ln, font: 'Consolas', size: 18 })],
    }),
  );
  const cellChildren = caption
    ? [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: caption, bold: true, italics: true, size: 18, color: '5A6472' })] }), ...body]
    : body;
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [new TableRow({ children: [new TableCell({
      width: { size: CONTENT_W, type: WidthType.DXA },
      shading: { fill: CODE_BG, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 160, right: 160 },
      borders: allBorders('D6DAE0'),
      children: cellChildren,
    })] })],
  });
}

function allBorders(color = 'CCCCCC', size = 1) {
  const b = { style: BorderStyle.SINGLE, size, color };
  return { top: b, bottom: b, left: b, right: b };
}

function cell(content, { width, fill, bold: isBold, color, align } = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map((c) =>
    typeof c === 'string'
      ? new Paragraph({ alignment: align, spacing: { after: 0, line: 260 }, children: [new TextRun({ text: c, bold: isBold, color, size: 20 })] })
      : c,
  );
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    borders: allBorders('CBD2DA'),
    verticalAlign: VerticalAlign.CENTER,
    children: paras,
  });
}

function table(headers, rows, widths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { width: widths[i], fill: BLUE, bold: true, color: 'FFFFFF' })),
  });
  const bodyRows = rows.map((cols, ri) => new TableRow({
    children: cols.map((c, i) => {
      const isObj = c && typeof c === 'object' && !Array.isArray(c) && !(c instanceof Paragraph);
      const text = isObj ? c.text : c;
      return cell(text, { width: widths[i], fill: ri % 2 ? 'FFFFFF' : GREY, bold: isObj ? c.bold : false, color: isObj ? c.color : undefined, align: isObj ? c.align : undefined });
    }),
  }));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...bodyRows] });
}

const SP = (h = 80) => new Paragraph({ spacing: { after: h }, children: [] });

function sevRun(level) {
  const map = { Critical: RED, High: AMBER, Medium: '2563A8', Low: '5A6472' };
  return new TextRun({ text: level, bold: true, color: map[level] || '000000' });
}

// ---------- document content ----------
const children = [];

// Cover
children.push(new Paragraph({ spacing: { before: 1800, after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'BÁO CÁO QA & ĐẶC TẢ SỬA LỖI', bold: true, size: 52, color: BLUE })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'CRM Leads — Metta Admin', bold: true, size: 40, color: '1F2733' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Lỗi Filter / Pagination / Kanban — Khắc phục theo Phương án A (lọc server-side)', size: 24, color: '5A6472' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 0 }, children: [new TextRun({ text: 'Tài liệu bàn giao cho đội Dev', italics: true, size: 22, color: '5A6472' })] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1200 }, children: [
  new TextRun({ text: 'Phiên bản: 1.0', size: 22 }), new TextRun({ text: ' | ', size: 22 }), new TextRun({ text: 'Ngày: 25/06/2026', size: 22 }),
] }));
children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Người lập: QA / Frontend Review', size: 22 })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// TOC
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Mục lục')] }));
children.push(new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-2' }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. Tóm tắt
children.push(H1('1. Tóm tắt điều hành (Executive Summary)'));
children.push(P([
  bold('Bối cảnh: '),
  r('Màn Leads CRM có ~600 lead, phân trang 100 lead/trang (6 trang). Khi lọc theo PIC "Quỳnh", trang 1 chỉ hiện 1 lead nhưng các trang sau vẫn còn lead của Quỳnh. Tổng "600 lead / 6 trang" không đổi sau khi lọc.'),
]));
children.push(P([
  bold('Kết luận: '),
  r('Đây là lỗi kiến trúc '),
  bold('"phân trang TRƯỚC khi lọc" (paginate-then-filter)'),
  r('. Hệ thống phân trang ở server chỉ theo '),
  code('role + createdAt'),
  r(', sau đó client mới lọc PIC/status/source/... '),
  bold('chỉ trên 100 lead của trang đang xem'),
  r('. Vì vậy kết quả lọc bị rải sai qua các trang, tổng số và số trang không phản ánh kết quả đã lọc.'),
]));
children.push(P([bold('Hướng khắc phục đã chốt: '), r('Phương án A — đẩy filter xuống server (Firestore) để tối ưu reads và chuẩn hoá số liệu tổng/trang/Kanban. Phần search free-text và priority xử lý theo ghi chú riêng (mục 5).')]));
children.push(SP());
children.push(H2('1.1. Bảng tổng hợp mức độ nghiêm trọng'));
children.push(table(
  ['Mã', 'Lỗi', 'Mức độ', 'Khu vực'],
  [
    ['BUG-01', 'Filter chạy trên trang hiện tại thay vì toàn dataset (gốc của bug Quỳnh)', { text: 'Critical', bold: true, color: RED }, 'Filter + Pagination'],
    ['BUG-02', 'Tổng lead & tổng số trang không cập nhật sau filter', { text: 'Critical', bold: true, color: RED }, 'Pagination footer'],
    ['BUG-03', 'Không reset về trang 1 khi đổi filter', { text: 'High', bold: true, color: AMBER }, 'Pagination'],
    ['BUG-04', 'Kanban đếm count sai theo từng status', { text: 'High', bold: true, color: AMBER }, 'Kanban'],
    ['BUG-05', 'Search thiếu chuẩn hoá dấu TV / SĐT / trim', { text: 'High', bold: true, color: AMBER }, 'Search'],
    ['BUG-06', 'Lỗi timezone GMT+7: mất lead đầu ngày của khoảng lọc', { text: 'Medium', bold: true, color: '2563A8' }, 'Date range'],
    ['BUG-07', 'Export CSV chỉ xuất lead của trang hiện tại', { text: 'High', bold: true, color: AMBER }, 'Export'],
    ['BUG-08', 'Ô nhập số trang theo tổng SAI (hệ quả BUG-02)', { text: 'Medium', bold: true, color: '2563A8' }, 'Pagination input'],
  ],
  [900, 4760, 1500, 2200],
));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 2. Data flow
children.push(H1('2. Phân tích luồng dữ liệu (Root Cause)'));
children.push(H2('2.1. Luồng HIỆN TẠI (sai)'));
children.push(codeBlock([
  'SERVER  api/app-config.ts -> readLeadPage()',
  '  query CHỈ lọc: role(sales -> assignedTo) + createdAt >= dateFrom (<= dateTo)',
  '  total = baseQuery.count()           // = 600 (toàn bộ, KHÔNG theo PIC)',
  '  pageSnap = baseQuery.offset((page-1)*100).limit(100)   // phân trang TRƯỚC',
  '        |',
  '        v  trả về 100 lead/trang + total=600, totalPages=6',
  'CLIENT  LeadsPage.tsx -> const filtered = leads.filter(...)',
  '  lọc search/status/source/center/priority/course/assignedTo',
  '  --> nhưng leads = CHỈ 100 lead của trang hiện tại  => LỌC SAU, SAI PHẠM VI',
], 'Thứ tự thực thi hiện tại: fetch-page -> paginate -> filter'));
children.push(P([
  bold('Hệ quả: '),
  r('Lọc PIC=Quỳnh ở trang 1 chỉ thấy những lead Quỳnh tình cờ nằm trong 100 lead mới nhất; phần còn lại rải ở trang 2–6. Footer luôn báo 600/6 vì total lấy từ server (chưa lọc PIC).'),
]));
children.push(SP());
children.push(H2('2.2. Luồng ĐÚNG cần đạt (Phương án A)'));
children.push(codeBlock([
  'SERVER  readLeadPage()',
  '  baseQuery = leads',
  '    .where(role)                         // sales -> assignedTo == uid',
  '    .where(assignedTo == PIC)  (nếu admin chọn PIC)',
  '    .where(status == ...) .where(source == ...) .where(centerName == ...)',
  '    .where(interestedCourse == ...)',
  '    .where(createdAt >= dateFrom) .where(createdAt <= dateTo)',
  '    .orderBy(createdAt, desc)',
  '  total = baseQuery.count()              // TOTAL theo đúng kết quả đã lọc',
  '  pageSnap = baseQuery.offset((page-1)*pageSize).limit(pageSize)',
  '        |',
  '        v  client render trực tiếp + Kanban count theo total từng status (count() per status)',
], 'Thứ tự đúng: filter-all -> total -> paginate -> render'));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 3. Bug catalog detail
children.push(H1('3. Danh mục lỗi chi tiết'));

function bugBlock({ code: bc, title, sev, files, desc, repro, actual, expect, note }) {
  children.push(H2(`${bc} — ${title}`));
  children.push(P([bold('Mức độ: '), sevRun(sev)]));
  if (desc) children.push(P([bold('Mô tả: '), ...(Array.isArray(desc) ? desc : [r(desc)])]));
  if (repro) { children.push(P([bold('Bước tái hiện:')])); repro.forEach((s) => children.push(num(s))); }
  if (actual) children.push(P([bold('Kết quả thực tế: '), r(actual)]));
  if (expect) children.push(P([bold('Kết quả mong muốn: '), r(expect)]));
  if (files) { children.push(P([bold('Vị trí code nghi ngờ:')])); files.forEach((f) => children.push(bullet([code(f)]))); }
  if (note) children.push(P([bold('Ghi chú: '), ...(Array.isArray(note) ? note : [r(note)])]));
  children.push(SP(60));
}

bugBlock({
  code: 'BUG-01', title: 'Filter chạy trên trang hiện tại (gốc của bug Quỳnh)', sev: 'Critical',
  desc: [r('`filtered` lọc trên biến `leads` — vốn chỉ là 100 lead của trang server hiện tại. Server '), code('readLeadPage'), r(' không nhận tham số PIC/status/source/... nên dataset trước khi lọc đã bị cắt theo trang.')],
  repro: ['Đăng nhập admin → Leads', 'Chọn filter PIC = Quỳnh', 'Xem trang 1, rồi bấm sang trang 2..6'],
  actual: 'Trang 1 chỉ hiện vài lead Quỳnh; các trang sau vẫn còn lead Quỳnh.',
  expect: 'Toàn bộ lead Quỳnh được gom và phân trang theo đúng số lượng của Quỳnh.',
  files: ['src/pages/LeadsPage.tsx: const filtered = useMemo(...)  (~dòng 466)', 'src/hooks/useLeads.ts: loadNumberedPage / getNumberedLeadsPage', 'api/app-config.ts: readLeadPage()  (~dòng 190-222)'],
});
bugBlock({
  code: 'BUG-02', title: 'Tổng lead & tổng trang không cập nhật sau filter', sev: 'Critical',
  desc: [r('`LeadPagination` nhận `totalLeads`/`totalPages` lấy từ server (toàn bộ theo ngày+role), không phải từ kết quả đã lọc.')],
  actual: 'Sau khi lọc Quỳnh vẫn báo "600 lead · 6 trang".',
  expect: 'Hiển thị "N lead · ceil(N/100) trang" theo kết quả đã lọc.',
  files: ['src/pages/LeadsPage.tsx: <LeadPagination totalLeads={totalLeads} totalPages={totalPages} />  (~dòng 1197, 1213)', 'src/hooks/useLeads.ts: setTotalPages(result.totalPages); setTotalLeads(result.total)  (~dòng 70-71)'],
});
bugBlock({
  code: 'BUG-03', title: 'Không reset về trang 1 khi đổi filter', sev: 'High',
  desc: [r('Các filter client (search/status/source/center/priority/course/assignedTo) nằm ở state của `LeadsPage`, không truyền vào `useLeads`, nên không trigger refetch và không reset `page`. Riêng date range thì có reset vì `loadNumberedPage` phụ thuộc dateFrom/dateTo.')],
  repro: ['Sang trang 3', 'Đổi filter PIC sang người khác'],
  actual: 'Vẫn ở trang 3, lọc trên 100 lead của trang 3.',
  expect: 'Tự động về trang 1 và refetch theo filter mới.',
  files: ['src/hooks/useLeads.ts: useEffect numbered  (~dòng 141-153) & deps loadNumberedPage  (~dòng 88)', 'src/pages/LeadsPage.tsx: các <Select> filter  (~dòng 1112-1135)'],
});
bugBlock({
  code: 'BUG-04', title: 'Kanban đếm count sai theo từng status', sev: 'High',
  desc: [r('Cột Kanban đếm '), code('colLeads.length'), r(' trên tập `filtered` = 100 lead của trang. Count mỗi cột chỉ phản ánh trang hiện tại; empty state "Trống" hiện sai khi lead của status đó nằm ở trang khác.')],
  files: ['src/pages/LeadsPage.tsx: leadStatuses.map(...) colLeads  (~dòng 2236-2295)'],
  expect: 'Count mỗi status = tổng toàn bộ lead status đó trong phạm vi đã lọc.',
});
bugBlock({
  code: 'BUG-05', title: 'Search thiếu chuẩn hoá dấu TV / SĐT / trim', sev: 'High',
  desc: [r('Search cũ dùng '), code("haystack.includes(filters.search.toLowerCase())"), r(': đúng hoa/thường nhưng KHÔNG bỏ dấu (gõ "Quynh" không ra "Quỳnh"), KHÔNG normalize SĐT (0901… vs +84901…), KHÔNG trim.')],
  note: [bold('ĐÃ SỬA client-side trong lần bàn giao này — xem mục 5.4. '), r('Sau khi áp Phương án A, search nên chạy trên tập đã lọc server hoặc qua search service.')],
  files: ['src/pages/LeadsPage.tsx: matchesLeadSearch / normalizeSearchText / normalizePhone (đã thêm)'],
});
bugBlock({
  code: 'BUG-06', title: 'Lỗi timezone GMT+7 — mất lead đầu ngày', sev: 'Medium',
  desc: [r('Biên ngày build theo UTC: '), code("`${value}T00:00:00.000Z`"), r(' / '), code("`${value}T23:59:59.999Z`"), r('. Với GMT+7, biên dưới 00:00Z = 07:00 sáng VN ⇒ lead tạo 00:00–07:00 VN của ngày dateFrom bị loại; biên trên nới sang ~07:00 sáng hôm sau ⇒ over-include cuối range.')],
  files: ['src/services/leadService.ts: normalizeDateStart / normalizeDateEnd  (~dòng 657-665)', 'src/pages/LeadsPage.tsx: dateOnlyOffset()  (~dòng 117-120)', 'api/app-config.ts: leadPageDateStart / leadPageDateEnd  (~dòng 178-183)'],
  expect: 'Biên dưới/trên tính theo +07:00; ngày mặc định tính theo lịch VN.',
});
bugBlock({
  code: 'BUG-07', title: 'Export CSV chỉ xuất trang hiện tại', sev: 'High',
  desc: [r('Nút Export gọi '), code("exportCsv('metta-leads.csv', filtered ...)"), r(' mà `filtered` ⊂ 100 lead/trang nên không xuất đủ kết quả đã lọc.')],
  files: ['src/pages/LeadsPage.tsx: onClick Export CSV  (~dòng 886)'],
  expect: 'Export toàn bộ kết quả đã lọc (gọi API export riêng theo filter, không phụ thuộc trang).',
});
bugBlock({
  code: 'BUG-08', title: 'Ô nhập số trang theo tổng SAI', sev: 'Medium',
  desc: [r('`submitPage` đã kẹp '), code('Math.min(totalPages, ...)'), r(' đúng, nhưng `totalPages` đang là tổng sai (BUG-02) nên vẫn nhảy được tới trang không tồn tại sau lọc. Tự khỏi khi sửa BUG-02.')],
  files: ['src/components/leads/LeadPagination.tsx: submitPage  (~dòng 29-39)'],
});
children.push(new Paragraph({ children: [new PageBreak()] }));

// 4. Plan A implementation
children.push(H1('4. Đặc tả triển khai — Phương án A (cho Dev)'));
children.push(P('Mục tiêu: lọc tại Firestore (server), trả về đúng total/trang, giảm reads (không tải dư lead ngoài filter). Triển khai theo 5 bước.'));

children.push(H2('4.1. Bước 1 — Mở rộng query server'));
children.push(P([r('File '), code('api/app-config.ts'), r(' hàm '), code('readLeadPage'), r('. Đọc thêm query params và thêm các '), code('.where()'), r(' equality trước khi '), code('count()'), r(' và '), code('offset/limit'), r('.')]));
children.push(codeBlock([
  'const assignedTo = queryValue(req.query?.assignedTo);',
  'const status     = queryValue(req.query?.status);',
  'const source     = queryValue(req.query?.source);',
  'const centerName = queryValue(req.query?.centerName);',
  'const course     = queryValue(req.query?.course);',
  '',
  'let baseQuery = db.collection(\'leads\');',
  'if (user.role === \'sales\') {',
  '  baseQuery = baseQuery.where(\'assignedTo\', \'==\', user.id);   // sales bị khoá theo chính mình',
  '} else if (assignedTo) {',
  '  baseQuery = baseQuery.where(\'assignedTo\', \'==\', assignedTo); // admin/manager lọc theo PIC',
  '}',
  'if (status)     baseQuery = baseQuery.where(\'status\', \'==\', status);',
  'if (source)     baseQuery = baseQuery.where(\'source\', \'==\', source);',
  'if (centerName) baseQuery = baseQuery.where(\'centerName\', \'==\', centerName);',
  'if (course)     baseQuery = baseQuery.where(\'interestedCourse\', \'==\', course);',
  'baseQuery = baseQuery.where(\'createdAt\', \'>=\', dateFrom);',
  'if (dateTo) baseQuery = baseQuery.where(\'createdAt\', \'<=\', dateTo);',
  'baseQuery = baseQuery.orderBy(\'createdAt\', \'desc\');',
  '',
  'const total = (await baseQuery.count().get()).data().count;   // total ĐÚNG sau lọc',
  'const totalPages = Math.max(1, Math.ceil(total / pageSize));',
  'const page = Math.min(requestedPage, totalPages);',
  'const pageSnap = await baseQuery.offset((page - 1) * pageSize).limit(pageSize).get();',
], 'api/app-config.ts — readLeadPage()'));
children.push(P([bold('Bảo mật: '), r('giữ nhánh `user.role === "sales"` ƯU TIÊN trên mọi tham số `assignedTo` từ client để sales không thể xem lead người khác qua việc sửa query param.')]));

children.push(H2('4.2. Bước 2 — Firestore composite indexes'));
children.push(P([r('Mỗi tổ hợp '), code('equality + range(createdAt) + orderBy(createdAt)'), r(' cần 1 composite index. Khai báo trong '), code('firestore.indexes.json'), r(' và deploy. Tối thiểu các index sau:')]));
children.push(table(
  ['Trường equality', 'Range/Order', 'Dùng cho'],
  [
    ['assignedTo', 'createdAt (desc)', 'Lọc PIC + ngày'],
    ['status', 'createdAt (desc)', 'Lọc status + ngày'],
    ['source', 'createdAt (desc)', 'Lọc source + ngày'],
    ['centerName', 'createdAt (desc)', 'Lọc trung tâm + ngày'],
    ['interestedCourse', 'createdAt (desc)', 'Lọc khóa + ngày'],
    ['assignedTo + status', 'createdAt (desc)', 'PIC + status (tổ hợp hay dùng)'],
  ],
  [3200, 3000, 3160],
));
children.push(P([bold('Lưu ý: '), r('Firestore chỉ cho 1 range field. `createdAt` đang là range/order ⇒ các filter khác phải là equality (đúng với danh sách trên). Nếu kết hợp nhiều equality, tạo thêm index tương ứng. Có thể chạy thử để Firestore gợi ý link tạo index trong log lỗi, nhưng nên khai báo tường minh trong repo.')]));
children.push(P([bold('Đếm Kanban: '), r('Để count từng status chuẩn mà không tải hết, gọi '), code('count()'), r(' cho từng status trên cùng bộ filter (9 truy vấn '), code('aggregate count'), r(' rất rẻ về reads), hoặc 1 endpoint trả map {status: count}. Tránh đếm client trên tập phân trang.')]));

children.push(H2('4.3. Bước 3 — Service truyền filter'));
children.push(P([r('File '), code('src/services/leadService.ts'), r(' — '), code('getNumberedLeadsPage'), r(': bổ sung options và đẩy lên URLSearchParams.')]));
children.push(codeBlock([
  'type LeadNumberedPageOptions = {',
  '  page?: number; pageSize?: number; sinceDays?: number;',
  '  dateFrom?: string; dateTo?: string;',
  '  assignedTo?: string; status?: string; source?: string;',
  '  centerName?: string; course?: string;   // <-- thêm mới',
  '};',
  '',
  '// trong getNumberedLeadsPage, sau khi set page/pageSize/dateFrom/dateTo:',
  'if (options.assignedTo) params.set(\'assignedTo\', options.assignedTo);',
  'if (options.status)     params.set(\'status\', options.status);',
  'if (options.source)     params.set(\'source\', options.source);',
  'if (options.centerName) params.set(\'centerName\', options.centerName);',
  'if (options.course)     params.set(\'course\', options.course);',
], 'src/services/leadService.ts'));
children.push(P([bold('Quan trọng — store local: '), r('hiện service ghi kết quả trang vào store rồi trả '), code('visibleLeads(user)'), r('. Khi đã lọc server, đảm bảo '), code('setStoreLeads(remoteLeads, true)'), r(' (replace) để store không lẫn lead của filter cũ giữa các lần đổi filter.')]));

children.push(H2('4.4. Bước 4 — Hook useLeads nhận filter + reset trang'));
children.push(P([r('File '), code('src/hooks/useLeads.ts'), r(': đưa các filter vào options và vào deps của '), code('loadNumberedPage'), r('. Nhờ đó khi filter đổi, effect numbered (đang reset về trang 1) tự chạy lại — tái dùng cơ chế reset đã đúng của date range.')]));
children.push(codeBlock([
  'export function useLeads({',
  '  realtime = true, pollMs, pageSize = 100, mode = \'paged\',',
  '  sinceDays = 30, dateFrom, dateTo,',
  '  assignedTo, status, source, centerName, course,   // <-- thêm',
  '}: UseLeadsOptions = {}) {',
  '  ...',
  '  const loadNumberedPage = useCallback(async (targetPage, force=false) => {',
  '    const result = await leadService.getNumberedLeadsPage({',
  '      page: safeTarget, pageSize, sinceDays, dateFrom, dateTo,',
  '      assignedTo, status, source, centerName, course,   // <-- truyền xuống',
  '    });',
  '    ...',
  '  }, [dateFrom, dateTo, pageSize, sinceDays,',
  '      assignedTo, status, source, centerName, course]);  // <-- deps đầy đủ',
  '}',
], 'src/hooks/useLeads.ts'));
children.push(P([bold('useEffect deps: '), r('Effect numbered đã '), code('void loadNumberedPage(1, true)'), r(' và reset '), code('currentPageRef=1'), r(' mỗi khi '), code('loadNumberedPage'), r(' đổi → tự reset trang 1 khi filter đổi. Không cần thêm '), code('setCurrentPage(1)'), r(' thủ công.')]));

children.push(H2('4.5. Bước 5 — LeadsPage truyền filter & dùng số liệu server'));
children.push(codeBlock([
  'const { leads, refresh, page, totalPages, totalLeads, goToPage, loadingPage } = useLeads({',
  '  realtime: false, mode: \'numbered\', pageSize: LEADS_PAGE_SIZE,',
  '  dateFrom: filters.dateFrom, dateTo: filters.dateTo,',
  '  assignedTo: filters.assignedTo, status: filters.status,',
  '  source: filters.source, centerName: filters.centerName, course: filters.course,',
  '});',
  '',
  '// leads trả về ĐÃ lọc server -> bỏ lọc trùng ở client cho các tiêu chí đã đẩy lên server.',
  '// Chỉ giữ client: search free-text (đã chuẩn hoá) + priorityLevel (giá trị suy ra).',
  'const visible = useMemo(() => leads.filter((lead) =>',
  '  matchesLeadSearch(lead, filters.search) &&',
  '  (!filters.priorityLevel || String(priorityForLead(sourceConfigs, lead)) === filters.priorityLevel)',
  '), [leads, filters.search, filters.priorityLevel, sourceConfigs]);',
  '',
  '// Pagination/Kanban/Table/Export dùng số liệu server cho total/trang:',
  '<LeadPagination page={page} totalPages={totalPages} totalLeads={totalLeads} ... />',
], 'src/pages/LeadsPage.tsx'));
children.push(P([bold('Cảnh báo nhất quán: '), r('`search` và `priorityLevel` vẫn lọc client ⇒ trên một trang, total/trang (server) có thể > số hàng hiển thị. Khuyến nghị: (a) tạm ẩn cảnh báo này bằng cách đưa priorityLevel thành field denormalized để đẩy lên server; (b) search dùng search-service. Xem mục 5.')]));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 5. Special handling + UI fixes done
children.push(H1('5. Xử lý đặc biệt & các sửa đổi đã áp dụng'));
children.push(H2('5.1. Search free-text'));
children.push(bullet('Firestore không hỗ trợ full-text. 2 lựa chọn:'));
children.push(bullet('A) Tích hợp Algolia/Typesense, index name/parentName/studentName/phone đã chuẩn hoá; filter khác vẫn đẩy Firestore.', 1));
children.push(bullet('B) Giữ search client-side NHƯNG chỉ trên tập đã lọc server theo các tiêu chí khác; nêu rõ "search trong phạm vi đã lọc/ngày".', 1));
children.push(H2('5.2. Priority level'));
children.push(P([r('`priorityLevel` hiển thị được suy ra từ '), code('sourceConfig'), r(' lúc runtime ⇒ khó where trực tiếp. Khuyến nghị denormalize giá trị priority đã tính vào document lead khi ghi (saveLead/import), rồi '), code('where(\'priorityLevel\',\'==\',n)'), r(' + index.')]));
children.push(H2('5.3. Timezone GMT+7 (BUG-06)'));
children.push(codeBlock([
  '// src/services/leadService.ts',
  'function normalizeDateStart(v){ return v?.length===10 ? `${v}T00:00:00.000+07:00` : v; }',
  'function normalizeDateEnd(v){   return v?.length===10 ? `${v}T23:59:59.999+07:00` : v; }',
  '',
  '// src/pages/LeadsPage.tsx -> dateOnlyOffset(): tính ngày theo lịch VN',
  'function dateOnlyOffset(days){',
  '  const vn = new Date(Date.now() + 7*3600*1000); // dịch sang mốc VN',
  '  vn.setUTCDate(vn.getUTCDate() + days);',
  '  return vn.toISOString().slice(0,10);',
  '}',
  '// api/app-config.ts: leadPageDateStart/End cũng dùng offset +07:00 cho nhất quán',
], 'Chuẩn hoá biên ngày theo +07:00'));
children.push(H2('5.4. ĐÃ SỬA trong lần bàn giao này (client-side, an toàn)'));
children.push(P([bold('Search chuẩn hoá (BUG-05) — đã áp dụng tại '), code('src/pages/LeadsPage.tsx'), r('.')]));
children.push(codeBlock([
  'function normalizeSearchText(value = \'\') {',
  '  return value.toLowerCase().normalize(\'NFD\')',
  '    .replace(/[\\u0300-\\u036f]/g, \'\')  // bỏ dấu',
  '    .replace(/đ/g, \'d\').trim();',
  '}',
  'function normalizePhone(value = \'\') {',
  '  return value.replace(/\\D/g, \'\').replace(/^84/, \'0\');',
  '}',
  'function matchesLeadSearch(lead, rawQuery) {',
  '  const q = (rawQuery||\'\').trim(); if (!q) return true;',
  '  const t = normalizeSearchText(q);',
  '  const hay = normalizeSearchText(`${lead.fullName||\'\'} ${lead.parentName||\'\'} ${lead.studentName||\'\'} ${lead.email||\'\'}`);',
  '  if (t && hay.includes(t)) return true;',
  '  const p = normalizePhone(q);',
  '  if (p.length >= 3 && normalizePhone(lead.phone||\'\').includes(p)) return true;',
  '  return false;',
  '}',
], 'Đã thêm + thay thế điều kiện search trong useMemo `filtered`'));
children.push(P([bold('Kết quả: '), r('gõ "quynh"/"Quỳnh"/"QUỲNH" đều ra; "0901…"/"+84901…"/"0901 234" khớp cùng lead; tự trim khoảng trắng. (Phạm vi vẫn giới hạn theo trang cho tới khi áp Phương án A.)')]));
children.push(H2('5.5. Rà soát UI/UX (kết quả)'));
children.push(bullet([bold('Bảng Table: '), r('OK — component Table đã bọc '), code('overflow-x-auto'), r(' nên 13 cột không tràn vỡ layout.')]));
children.push(bullet([bold('Kanban: '), r('OK về layout (cuộn ngang '), code('overflow-x-auto'), r(', cột '), code('w-72 flex-shrink-0'), r('); lỗi nằm ở count (BUG-04, thuộc data).')]));
children.push(bullet([bold('Badge/min-w-0/truncate: '), r('dùng hợp lý, không phát hiện tràn chữ hay badge khó đọc nghiêm trọng.')]));
children.push(bullet([bold('Kết luận: '), r('Không có lỗi UI thuần nghiêm trọng cần sửa markup; các vấn đề "nhìn thấy" (tổng sai, count sai, lọc rải trang) đều bắt nguồn từ data-flow và được xử lý ở Phương án A.')]));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 6. Test cases
children.push(H1('6. Test cases nghiệm thu (Acceptance)'));
children.push(H2('6.1. Filter & Pagination'));
[
  'Filter PIC = Quỳnh → trang 1 hiển thị đủ lead Quỳnh (vd 100/100 nếu Quỳnh ≥ 100).',
  'Quỳnh có 80 lead → đúng 1 trang; footer "80 lead · 1 trang"; nút Sau disable.',
  'Quỳnh có 250 lead → 3 trang, mỗi trang ≤ 100, không lẫn PIC khác.',
  'Đang trang 3 → đổi PIC khác → tự về trang 1.',
  'Clear toàn bộ filter → trả lại 600 lead · 6 trang.',
  'Đổi filter → không còn sót dữ liệu filter cũ.',
  'Ô "đi tới trang" không cho vượt totalPages mới sau lọc.',
].forEach((t) => children.push(bullet(t)));
children.push(H2('6.2. Kanban'));
[
  'Count mỗi cột = tổng lead status đó trong phạm vi đã lọc, khớp footer.',
  'Filter PIC Quỳnh → mọi cột chỉ chứa lead Quỳnh.',
  'Empty "Trống" chỉ hiện khi status thực sự 0 lead sau lọc.',
  'Kéo-thả đổi status → count 2 cột cập nhật ngay, không cần F5.',
].forEach((t) => children.push(bullet(t)));
children.push(H2('6.3. Search (đã sửa)'));
[
  '"quynh" / "Quỳnh" / "QUỲNH" đều ra Quỳnh.',
  'SĐT "0901234567" / "+84901234567" / "0901 234 567" khớp cùng lead.',
  'Khoảng trắng đầu/cuối vẫn match.',
].forEach((t) => children.push(bullet(t)));
children.push(H2('6.4. Date range (GMT+7)'));
[
  'Lead tạo 00:30 sáng 25/6 (VN) vẫn nằm trong range dateFrom=25/6.',
  'Lead tạo 23:30 tối 25/6 (VN) vẫn thuộc dateTo=25/6, không lọt sang 26/6.',
].forEach((t) => children.push(bullet(t)));
children.push(H2('6.5. Role'));
[
  'Sales chỉ thấy lead của mình; sửa query param assignedTo không lộ lead người khác.',
  'Admin/Manager thấy toàn bộ; total đếm đúng phạm vi quyền.',
  'Export CSV xuất đúng toàn bộ kết quả đã lọc (không chỉ 1 trang).',
].forEach((t) => children.push(bullet(t)));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 7. Rollout
children.push(H1('7. Checklist triển khai & rủi ro'));
children.push(H2('7.1. Thứ tự triển khai'));
['Tạo & deploy Firestore composite indexes (mục 4.2) TRƯỚC khi bật query mới — tránh lỗi "needs index" trên prod.',
 'Cập nhật API readLeadPage (mục 4.1) + endpoint count theo status cho Kanban.',
 'Cập nhật service + hook + LeadsPage (mục 4.3–4.5).',
 'Xử lý timezone (5.3) và priority denormalize (5.2).',
 'QA theo mục 6; bật cờ tính năng nếu cần rollback nhanh.'].forEach((t) => children.push(num(t)));
children.push(H2('7.2. Rủi ro cần lưu ý'));
children.push(bullet([bold('Thiếu index → 500/empty: '), r('phải deploy index trước; kiểm tra log Firestore.')]));
children.push(bullet([bold('offset() tốn reads khi trang lớn: '), r('offset đọc-bỏ các doc trước đó. Với ≤600 lead chấp nhận được; nếu scale lớn nên chuyển cursor (startAfter) theo createdAt.')]));
children.push(bullet([bold('Lẫn store cũ: '), r('đảm bảo replace store khi đổi filter (mục 4.3).')]));
children.push(bullet([bold('Nhất quán total vs search/priority client: '), r('xem mục 4.5 & 5.')]));
children.push(SP());
children.push(P([bold('Phụ lục — File liên quan: '), code('src/pages/LeadsPage.tsx'), r(', '), code('src/hooks/useLeads.ts'), r(', '), code('src/components/leads/LeadPagination.tsx'), r(', '), code('src/services/leadService.ts'), r(', '), code('api/app-config.ts'), r('.')]));

// ---------- assemble ----------
const doc = new Document({
  creator: 'Metta QA',
  title: 'Báo cáo QA CRM Leads — Phương án A',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 30, bold: true, font: 'Arial', color: BLUE },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 25, bold: true, font: 'Arial', color: '1F2733' },
        paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Arial', color: '34404D' },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bul', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 920, hanging: 260 } } } },
      ] },
      { reference: 'ord', levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 260 } } } },
      ] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'C9D3DE', space: 2 } }, children: [new TextRun({ text: 'Metta Admin — QA CRM Leads', size: 16, color: '8A93A0' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Trang ', size: 16, color: '8A93A0' }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '8A93A0' }), new TextRun({ text: ' / ', size: 16, color: '8A93A0' }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '8A93A0' })] })] }) },
    children,
  }],
});

const out = path.join(process.cwd(), 'Bao-cao-QA-CRM-Leads-METTA-PhuongAnA-2026-06-25.docx');
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(out, buf); console.log('WROTE', out, buf.length, 'bytes'); });
