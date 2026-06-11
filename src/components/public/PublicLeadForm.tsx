import { useState } from 'react';
import { leadService } from '@/services/leadService';

const phoneRegex = /^0(3|5|7|8|9|1[2689])\d{8}$/;

function normalizePhone(phone: string) {
  return phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
}

export function PublicLeadForm({
  formId = 'consultation-form',
  title = 'Đăng ký tư vấn miễn phí',
}: {
  formId?: string;
  title?: string;
}) {
  const [form, setForm] = useState({ parentName: '', studentName: '', phone: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage('');
    const formData = new FormData(e.currentTarget as HTMLFormElement);

    const parentName = form.parentName.trim();
    const studentName = form.studentName.trim();
    const phoneNormalized = normalizePhone(form.phone);

    if (!parentName) {
      setMessage('Vui lòng nhập họ tên phụ huynh.');
      return;
    }
    if (!studentName) {
      setMessage('Vui lòng nhập họ tên bé.');
      return;
    }
    if (!phoneRegex.test(phoneNormalized)) {
      setMessage('Vui lòng nhập số điện thoại phụ huynh hợp lệ.');
      return;
    }

    setLoading(true);
    try {
      await leadService.publicSubmit(
        {
          fullName: studentName,
          parentName,
          studentName,
          phone: phoneNormalized,
          contactType: 'parent',
          source: 'Website',
          company: String(formData.get('company') || ''),
          website: String(formData.get('website') || ''),
        },
        formId,
      );
      setForm({ parentName: '', studentName: '', phone: '' });
      setMessage('METTA đã nhận thông tin. Tư vấn viên sẽ liên hệ sớm!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không gửi được thông tin. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="lead-form" className="py-16 lg:py-section">
      <div className="max-w-[1200px] mx-auto px-5 lg:px-page">
        <div className="grid md:grid-cols-[0.9fr_1.1fr] gap-0 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-br from-primary to-primary-container p-10 lg:p-14 text-pure-white flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cta-orange/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 border-[12px] border-accent-cyan/10 rounded-full -translate-x-1/2 translate-y-1/2" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 bg-cta-orange/20 px-3 py-1 rounded-full mb-6">
                <span className="w-2 h-2 bg-cta-orange rounded-full" />
                <span className="text-xs font-bold tracking-widest uppercase text-cta-orange">Miễn phí 100%</span>
              </div>
              <h2 className="font-montserrat font-bold text-[28px] lg:text-[36px] leading-tight mb-4">{title}</h2>
              <p className="text-surface-variant text-sm leading-7 mb-8">
                Để lại tên phụ huynh, tên bé và số điện thoại. Tư vấn viên METTA sẽ liên hệ trong vòng <strong className="text-pure-white">24 giờ</strong>.
              </p>
              <ul className="space-y-3">
                {[
                  'Tư vấn lộ trình học phù hợp',
                  'Kiểm tra năng lực đầu vào miễn phí',
                  'Đồng hành cùng phụ huynh trong quá trình học',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-surface-variant">
                    <span className="material-symbols-outlined text-accent-cyan text-[18px]">check_circle</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-pure-white p-8 lg:p-12">
            <form onSubmit={submit} className="grid grid-cols-1 gap-4">
              <input className="hidden" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-navy-deep tracking-wide">Họ tên phụ huynh *</label>
                <input
                  className="border border-outline-variant rounded-sm px-3 py-2.5 text-sm focus:border-navy-deep focus:ring-0 outline-none"
                  placeholder="VD: Nguyễn Thị Hương"
                  value={form.parentName}
                  onChange={(e) => set('parentName', e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-navy-deep tracking-wide">Họ tên bé *</label>
                <input
                  className="border border-outline-variant rounded-sm px-3 py-2.5 text-sm focus:border-navy-deep focus:ring-0 outline-none"
                  placeholder="VD: Nguyễn Minh Anh"
                  value={form.studentName}
                  onChange={(e) => set('studentName', e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[13px] font-semibold text-navy-deep tracking-wide">Số điện thoại phụ huynh *</label>
                <input
                  className="border border-outline-variant rounded-sm px-3 py-2.5 text-sm focus:border-navy-deep focus:ring-0 outline-none"
                  placeholder="090 123 4567"
                  inputMode="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  autoComplete="tel"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-cta-orange text-pure-white py-3.5 font-bold text-sm rounded-sm hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-cta-orange/20 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                {loading ? 'Đang gửi...' : 'Đăng ký tư vấn'}
              </button>
              {message && (
                <p className="text-center text-sm font-semibold text-navy-deep bg-primary-fixed rounded-sm px-4 py-3">
                  {message}
                </p>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
