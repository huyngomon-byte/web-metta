import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { BRAND } from '@/lib/constants';
import { requestPasswordReset } from '@/services/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đăng nhập được.');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError('');
    setMessage('');
    setResetting(true);
    try {
      await requestPasswordReset(email);
      setMessage('Đã gửi email đổi mật khẩu. Kiểm tra hộp thư của bạn.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được email đổi mật khẩu.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-gradient-to-br from-[#003B7A] via-[#1267AE] to-[#0F172A] p-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `url(${BRAND.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      <section className="relative hidden flex-col justify-between p-10 text-white lg:flex">
        <BrandLogo light />
        <div className="max-w-2xl">
          <h1 className="text-6xl font-extrabold leading-tight">METTA Admin Operating System</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-white/75">Quản trị CMS, CRM tuyển sinh và Meta CAPI tập trung cho đội ngũ nội bộ.</p>
        </div>
        <p className="text-sm text-white/60">Learn with Mind. Lead with Heart.</p>
      </section>
      <section className="relative grid place-items-center">
        <Card className="w-full max-w-md border-white/40 shadow-2xl">
          <CardHeader>
            <div className="mb-4"><BrandLogo /></div>
            <CardTitle className="text-3xl">Đăng nhập hệ thống</CardTitle>
            <CardDescription>CMS, CRM và CAPI quản lý tập trung</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                Email
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                Password
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
              {message && <div className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</div>}
              <Button size="lg" disabled={loading}>{loading ? 'Đang đăng nhập...' : 'Đăng nhập'}</Button>
              <button
                type="button"
                onClick={resetPassword}
                disabled={resetting || !email.trim()}
                className="text-sm font-semibold text-[#003B7A] transition hover:text-[#F45A0A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetting ? 'Đang gửi email đổi mật khẩu...' : 'Đổi mật khẩu / Quên mật khẩu'}
              </button>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
