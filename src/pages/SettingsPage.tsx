import { Eye, EyeOff, KeyRound, Save } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { changeCurrentPassword } from '@/services/authService';
import ThemeSettingsPage from '@/pages/ThemeSettingsPage';

type PasswordField = 'current' | 'next' | 'confirm';

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState<Record<PasswordField, boolean>>({
    current: false,
    next: false,
    confirm: false,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function toggle(field: PasswordField) {
    setVisible((value) => ({ ...value, [field]: !value[field] }));
  }

  async function savePassword() {
    setError('');
    setMessage('');
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    setSaving(true);
    try {
      await changeCurrentPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Đã đổi mật khẩu Firebase Auth thành công.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được mật khẩu.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="text-[#F45A0A]" /> Đổi mật khẩu
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <PasswordInput
              label="Mật khẩu hiện tại"
              value={currentPassword}
              visible={visible.current}
              onToggle={() => toggle('current')}
              onChange={setCurrentPassword}
            />
            <PasswordInput
              label="Mật khẩu mới"
              value={newPassword}
              visible={visible.next}
              onToggle={() => toggle('next')}
              onChange={setNewPassword}
            />
            <PasswordInput
              label="Nhập lại mật khẩu mới"
              value={confirmPassword}
              visible={visible.confirm}
              onToggle={() => toggle('confirm')}
              onChange={setConfirmPassword}
            />
          </div>
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
          {message && <div className="rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</div>}
          <Button className="w-fit" onClick={savePassword} disabled={saving}>
            <Save /> {saving ? 'Đang đổi mật khẩu...' : 'Lưu mật khẩu mới'}
          </Button>
        </CardContent>
      </Card>

      <ThemeSettingsPage />
    </div>
  );
}

function PasswordInput({
  label,
  value,
  visible,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
      {label}
      <div className="relative">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-11"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  );
}
