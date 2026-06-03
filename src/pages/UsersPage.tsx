import { Eye, EyeOff, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { roles } from '@/lib/constants';
import { ROLE_LABELS } from '@/lib/permissions';
import { userService } from '@/services/userService';
import type { AdminUser } from '@/types/user';

type UserDraft = Partial<AdminUser> & { password?: string };

const emptyUser: UserDraft = {
  fullName: '',
  email: '',
  role: 'sales',
  active: true,
  password: '',
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [editing, setEditing] = useState<UserDraft | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const refresh = () => userService.getUsers().then(setUsers);
  useEffect(() => { refresh(); }, []);

  async function save() {
    if (!editing?.fullName || !editing.email) {
      setError('Tên và email là bắt buộc.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await userService.saveUser(editing);
      setEditing(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được user.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Khóa tài khoản này? User sẽ bị inactive và Auth sẽ bị disable.')) return;
    await userService.deleteUser(id);
    refresh();
  }

  function startCreate() {
    setShowPassword(false);
    setEditing({ ...emptyUser });
  }

  function startEdit(user: AdminUser) {
    setShowPassword(false);
    setEditing({ ...user, password: '' });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Users & Roles</h1>
          <p className="text-slate-500">Roles: admin, manager, sales, ads, design.</p>
        </div>
        <Button onClick={startCreate}><Plus /> Thêm user</Button>
      </div>

      {editing && (
        <Card>
          <CardHeader><CardTitle>{editing.id ? 'Sửa user' : 'Thêm user'}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
            <div className="grid gap-3 md:grid-cols-5">
              <Input placeholder="Họ tên" value={editing.fullName || ''} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} />
              <Input placeholder="Email" value={editing.email || ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              <Select value={editing.role || 'sales'} onChange={(e) => setEditing({ ...editing, role: e.target.value as AdminUser['role'] })}>
                {roles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </Select>
              <Select value={editing.active === false ? 'inactive' : 'active'} onChange={(e) => setEditing({ ...editing, active: e.target.value === 'active' })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={editing.id ? 'Mật khẩu mới (nếu đổi)' : 'Mật khẩu'}
                  value={editing.password || ''}
                  onChange={(e) => setEditing({ ...editing, password: e.target.value })}
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
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}><Save /> {saving ? 'Đang lưu...' : 'Lưu user'}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Active</TH><TH>Action</TH></TR></THead>
            <TBody>
              {users.map((user) => (
                <TR key={user.id}>
                  <TD className="font-semibold">{user.fullName}</TD>
                  <TD>{user.email}</TD>
                  <TD><Badge tone="cyan">{ROLE_LABELS[user.role] || user.role}</Badge></TD>
                  <TD><Badge tone={user.active ? 'green' : 'red'}>{user.active ? 'active' : 'inactive'}</Badge></TD>
                  <TD>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => startEdit(user)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => remove(user.id)}><Trash2 /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
