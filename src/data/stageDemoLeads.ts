import {
  COURSE_OPTIONS,
  DEAL_QUOTED_STATUS,
  DEFAULT_DEAL_CURRENCY,
  LOST_LEAD_STATUS,
  WON_LEAD_STATUS,
  discountPercentOptions,
  leadStatuses,
  lostReasons,
  pendingReasonOptions,
} from '@/lib/constants';
import { courseDealSize, expectedRevenueFrom } from '@/lib/leadFinance';
import type { Lead, LeadStageHistoryEntry } from '@/types/crm';

export const STAGE_DEMO_LEAD_PREFIX = 'lead-demo-stage-';

const centers = ['METTA'] as const;
const schools = [
  'Trường Quốc tế Việt Úc',
  'Tiểu học Nguyễn Du',
  'Mầm non Hoa Sen',
  'Tiểu học Lê Lợi',
  'THCS Trần Đại Nghĩa',
  'Trường Quốc tế Canada',
  'Tiểu học Đinh Tiên Hoàng',
  'THCS Nguyễn Gia Thiều',
] as const;
const sources = [
  { name: 'Meta Lead Form', priorityLevel: 5 },
  { name: 'Referral', priorityLevel: 5 },
  { name: 'Website', priorityLevel: 4 },
  { name: 'Meta Ads', priorityLevel: 4 },
  { name: 'Zalo OA', priorityLevel: 4 },
  { name: 'Google Ads', priorityLevel: 4 },
  { name: 'Sales input', priorityLevel: 3 },
  { name: 'Walk-in', priorityLevel: 3 },
  { name: 'TikTok Ads', priorityLevel: 3 },
  { name: 'Khác', priorityLevel: 1 },
] as const;
const sales = [
  { id: 'u2', name: 'Linh' },
  { id: 'u3', name: 'Chi' },
] as const;

const parentNames = [
  'Chị An Nhiên', 'Anh Minh Quân', 'Chị Thu Hạnh', 'Anh Đức Huy', 'Chị Ngọc Diệp',
  'Chị Thanh Vân', 'Anh Hải Nam', 'Chị Phương Thảo', 'Anh Quốc Bảo', 'Chị Mai Anh',
  'Chị Hồng Nhung', 'Anh Tuấn Kiệt', 'Chị Bảo Trâm', 'Anh Gia Huy', 'Chị Khánh Vy',
  'Chị Mỹ Linh', 'Anh Hoàng Phúc', 'Chị Diệu Anh', 'Anh Nhật Minh', 'Chị Hà My',
] as const;
const studentNames = [
  'Bảo An', 'Minh Khang', 'Gia Linh', 'Bảo Châu', 'Tuệ Lâm',
  'Khánh An', 'Nhật Minh', 'Hoàng Phúc', 'Quỳnh Anh', 'Minh Quân',
  'Ngọc Hân', 'Đức Anh', 'Bảo Ngọc', 'Gia Huy', 'Phương Thảo',
  'Hải Nam', 'Mai Chi', 'Tuấn Kiệt', 'Bảo Châu', 'Hà My',
] as const;
const goalNotes = [
  'Muốn con tự tin nghe nói và phản xạ nhanh hơn.',
  'Cần lộ trình phonics rõ để đọc truyện tiếng Anh độc lập.',
  'Phụ huynh quan tâm lớp nhỏ, giáo viên kèm sát.',
  'Gia đình muốn kiểm tra level trước khi chọn lớp.',
  'Cần lịch sau giờ học chính khóa, ưu tiên cuối tuần.',
  'Muốn con chuẩn bị nền tảng Cambridge sớm.',
  'Quan tâm IELTS Junior và đầu ra theo từng level.',
  'Đã inbox hỏi học phí, cần gọi lại trong ngày.',
  'Lead referral, phụ huynh có thiện chí cao.',
  'Cần tư vấn thêm về cam kết đầu ra và lịch khai giảng.',
] as const;

const appointmentKinds = ['Gọi lại', 'Tư vấn', 'Test đầu vào'] as const;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function demoPhone(globalIndex: number) {
  return `09${String(71000000 + globalIndex * 13791).padStart(8, '0').slice(0, 8)}`;
}

function dateTime(dayOffset: number, hour = 9, minute = 0) {
  const date = new Date(Date.UTC(2026, 4, 5 + dayOffset, hour - 7, minute, 0));
  return date.toISOString();
}

function appointmentDateTime(globalIndex: number, hourSeed = 10) {
  const day = 5 + (globalIndex % 10);
  const hour = hourSeed + (globalIndex % 6);
  const minute = globalIndex % 2 ? 30 : 0;
  return `2026-06-${pad(day)}T${pad(hour)}:${pad(minute)}:00+07:00`;
}

function freshAssignmentDateTime(globalIndex: number) {
  const hour = 8 + (globalIndex % 8);
  const minute = (globalIndex % 4) * 15;
  return `2026-06-04T${pad(hour)}:${pad(minute)}:00+07:00`;
}

function dateOnly(globalIndex: number) {
  const day = 7 + (globalIndex % 14);
  return `2026-06-${pad(day)}`;
}

function stageHistoryFor(status: Lead['status'], globalIndex: number, createdAt: string) {
  const currentIndex = Math.max((leadStatuses as readonly string[]).indexOf(status), 0);
  const startMs = new Date(createdAt).getTime();
  const stepHours = 8 + (globalIndex % 5) * 5;
  const stepMs = stepHours * 60 * 60 * 1000;
  return leadStatuses.slice(0, currentIndex + 1).map((stage, index) => {
    const enteredAt = new Date(startMs + index * stepMs).toISOString();
    const isCurrent = index === currentIndex;
    return {
      status: stage,
      enteredAt,
      ...(isCurrent ? {} : { exitedAt: new Date(startMs + (index + 1) * stepMs).toISOString() }),
    } as LeadStageHistoryEntry;
  });
}

function statusSpecificFields(status: Lead['status'], indexInStage: number, globalIndex: number, course: string) {
  const dealSize = courseDealSize(course);
  const discountPercent = discountPercentOptions[(indexInStage + globalIndex) % discountPercentOptions.length];
  const expectedRevenue = expectedRevenueFrom(dealSize, discountPercent);
  const appointmentKind = appointmentKinds[(indexInStage + globalIndex) % appointmentKinds.length];

  if (status === DEAL_QUOTED_STATUS) {
    const option = pendingReasonOptions[indexInStage % pendingReasonOptions.length];
    return {
      consultationDate: appointmentDateTime(globalIndex, 9),
      dealSize,
      dealCurrency: DEFAULT_DEAL_CURRENCY,
      discountPercent,
      expectedRevenue,
      expectedCloseDate: dateOnly(globalIndex + 8),
      dealPackage: `${course} - gói 48 buổi`,
      dealNote: `Đã báo phí ${course}, discount ${discountPercent}%, pending vì: ${option.reason}.`,
      pendingReason: option.reason,
      pendingReasonNote: option.defaultNote,
      pendingWarmthPercent: option.warmthPercent,
      enrollmentType: indexInStage % 3 === 0 ? 'renewal' : indexInStage % 3 === 1 ? 'upsell' : 'new',
    };
  }

  if (status === WON_LEAD_STATUS) {
    return {
      consultationDate: appointmentDateTime(globalIndex, 10),
      dealSize,
      dealCurrency: DEFAULT_DEAL_CURRENCY,
      discountPercent,
      expectedRevenue,
      revenue: expectedRevenue,
      revenueAt: appointmentDateTime(globalIndex, 17),
      wonAt: appointmentDateTime(globalIndex, 17),
      expectedCloseDate: dateOnly(globalIndex),
      dealPackage: `${course} - nhập học tháng 6`,
      dealNote: `Đã chốt gói ${course}, revenue ghi nhận sau discount ${discountPercent}%.`,
      enrollmentType: indexInStage % 3 === 0 ? 'new' : indexInStage % 3 === 1 ? 'upsell' : 'renewal',
      convertedToStudentId: `demo-student-${globalIndex + 1}`,
    };
  }

  if (status === LOST_LEAD_STATUS) {
    const lostReason = lostReasons[indexInStage % lostReasons.length];
    return {
      lostReason,
      lostNote: `Demo mất lead: ${lostReason}. Sales cần xem lại source, lịch học hoặc objection.`,
      followUpDate: '',
      consultationDate: indexInStage % 2 ? appointmentDateTime(globalIndex, 14) : '',
    };
  }

  if (status === 'Đã hẹn tư vấn') {
    return {
      consultationDate: appointmentDateTime(globalIndex, 10),
      initialAppointmentType: 'Tư vấn',
    };
  }

  if (status === 'Đã tư vấn/Đặt lịch test') {
    return {
      consultationDate: appointmentDateTime(globalIndex, 11),
      followUpDate: appointmentDateTime(globalIndex + 1, 15),
      initialAppointmentType: 'Test đầu vào',
    };
  }

  if (status === 'Đã test/Học thử') {
    return {
      consultationDate: appointmentDateTime(globalIndex, 13),
      followUpDate: appointmentDateTime(globalIndex + 2, 11),
      dealPackage: `${course} - đề xuất sau test`,
      dealNote: 'Đã test/học thử, chờ sales báo phí và chốt gói phù hợp.',
    };
  }

  if (status === 'Chưa nghe máy') {
    return {
      followUpDate: appointmentDateTime(globalIndex + 1, 9),
      failedReason: indexInStage % 4 === 0 ? 'no_answer_first_call' : '',
    };
  }

  if (status === 'Đã liên hệ') {
    return {
      followUpDate: appointmentDateTime(globalIndex + 1, 10),
    };
  }

  return {
    followUpDate: indexInStage % 2 === 0 ? appointmentDateTime(globalIndex + 1, 9) : '',
  };
}

export const stageDemoLeads: Lead[] = leadStatuses.flatMap((status, stageIndex) =>
  Array.from({ length: 10 }, (_, indexInStage) => {
    const globalIndex = stageIndex * 10 + indexInStage;
    const source = sources[(indexInStage + stageIndex * 2) % sources.length];
    const salesOwner = sales[(indexInStage + stageIndex) % sales.length];
    const parentName = parentNames[globalIndex % parentNames.length];
    const studentName = `${studentNames[globalIndex % studentNames.length]} ${stageIndex + 1}${indexInStage + 1}`;
    const course = COURSE_OPTIONS[(globalIndex + stageIndex) % COURSE_OPTIONS.length];
    const isUnassigned = stageIndex === 0 && indexInStage % 5 === 0;
    const isReturned = status === 'Chưa nghe máy' && indexInStage % 5 === 0;
    const createdAt = dateTime((globalIndex * 3) % 29, 8 + (indexInStage % 4), indexInStage % 2 ? 30 : 0);
    const history = stageHistoryFor(status, globalIndex, createdAt);
    const statusEnteredAt = history[history.length - 1]?.enteredAt || createdAt;
    const statusFields = statusSpecificFields(status, indexInStage, globalIndex, course);
    const referralPhone = source.name === 'Referral'
      ? demoPhone(Math.max(0, globalIndex - ((globalIndex % 9) + 1)))
      : '';

    const isActiveAssignment = stageIndex <= 1;
    const assignedAt = isActiveAssignment ? freshAssignmentDateTime(globalIndex) : history[0]?.enteredAt || createdAt;

    const assignmentFields = isUnassigned || isReturned
      ? {
          assignedTo: '',
          assignedToName: '',
          assignedStatus: isReturned ? 'returned' as const : 'unassigned' as const,
          failedAssignedTo: isReturned ? salesOwner.id : '',
          failedAssignedToName: isReturned ? salesOwner.name : '',
          failedAt: isReturned ? appointmentDateTime(globalIndex, 18) : '',
          failedAtMs: isReturned ? Date.parse(appointmentDateTime(globalIndex, 18)) : undefined,
          failedReason: isReturned ? 'no_status_update_24h' : statusFields.failedReason || '',
        }
      : {
          assignedTo: salesOwner.id,
          assignedToName: salesOwner.name,
          assignedBy: stageIndex % 2 ? 'u1' : 'auto-assignment-rule',
          assignedAt,
          assignedAtMs: Date.parse(assignedAt),
          assignedExpiresAtMs: Date.parse(assignedAt) + 24 * 60 * 60 * 1000,
          assignedStatus: isActiveAssignment ? 'active' as const : 'accepted' as const,
        };

    return {
      id: `${STAGE_DEMO_LEAD_PREFIX}${stageIndex + 1}-${indexInStage + 1}`,
      fullName: studentName,
      parentName,
      studentName,
      phone: demoPhone(globalIndex),
      email: `demo.stage.${stageIndex + 1}.${indexInStage + 1}@metta.test`,
      contactType: indexInStage % 6 === 0 ? 'student' : indexInStage % 7 === 0 ? 'other' : 'parent',
      age: String(4 + ((globalIndex + stageIndex) % 12)),
      school: schools[globalIndex % schools.length],
      currentClass: indexInStage % 4 === 0 ? 'Mẫu giáo lớn' : indexInStage % 4 === 1 ? `Lớp ${1 + (globalIndex % 5)}` : indexInStage % 4 === 2 ? `Lớp ${6 + (globalIndex % 4)}` : 'Pre-IELTS',
      interestedCourse: course,
      currentLevel: '',
      targetGoal: '',
      source: source.name,
      referralPhone,
      centerName: centers[(globalIndex + stageIndex) % centers.length],
      priorityLevel: source.priorityLevel,
      status,
      ...assignmentFields,
      ...statusFields,
      statusUpdatedAt: statusEnteredAt,
      statusUpdatedAtMs: Date.parse(statusEnteredAt),
      stageHistory: history,
      initialNote: `[Demo ${status}] ${goalNotes[(indexInStage + stageIndex) % goalNotes.length]} Source ${source.name}${referralPhone ? `, referral ${referralPhone}` : ''} - P${source.priorityLevel}, center ${centers[(globalIndex + stageIndex) % centers.length]}.`,
      createdAt,
      updatedAt: statusEnteredAt,
    };
  }),
);
