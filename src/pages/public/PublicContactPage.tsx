import { PublicLeadForm } from '@/components/public/PublicLeadForm';

export default function PublicContactPage() {
  return (
    <>
      <section className="bg-[#003B7A] py-20 text-white">
        <div className="mx-auto max-w-[1180px] px-4">
          <h1 className="text-5xl font-extrabold">Liên hệ METTA Academy</h1>
          <p className="mt-4 max-w-2xl text-white/70">Đội ngũ METTA sẵn sàng tư vấn lộ trình phù hợp cho học viên.</p>
        </div>
      </section>
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-[1180px] px-4 gap-6 md:grid-cols-3">
          {['Hotline: 090 000 0000', 'Email: hello@mettaacademy.vn', 'Địa chỉ: METTA Academy Campus'].map((item) => <div key={item} className="rounded-xl border border-slate-200 p-6 font-semibold text-slate-800 shadow-sm">{item}</div>)}
        </div>
      </section>
      <PublicLeadForm formId="contact-form" title="Gửi thông tin liên hệ" />
    </>
  );
}
