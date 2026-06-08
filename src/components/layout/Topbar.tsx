import { Bell, CheckCheck, Menu, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { appointmentService } from '@/services/appointmentService';
import { leadService } from '@/services/leadService';
import { notificationService } from '@/services/notificationService';
import type { AppNotification } from '@/types/notification';

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Topbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const unread = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    const [leads, appointments] = await Promise.all([
      leadService.getLeads().catch(() => []),
      appointmentService.getAppointments().catch(() => []),
    ]);
    setNotifications(notificationService.getCombinedForUser(user, leads, appointments).slice(0, 10));
  }, [user]);

  useEffect(() => {
    void refreshNotifications();
    const interval = window.setInterval(() => void refreshNotifications(), 4000);
    const onStorage = () => void refreshNotifications();
    window.addEventListener('storage', onStorage);
    window.addEventListener('metta-notifications-updated', onStorage);
    window.addEventListener('focus', onStorage);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('metta-notifications-updated', onStorage);
      window.removeEventListener('focus', onStorage);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openNotification(item: AppNotification) {
    notificationService.markRead(item.id);
    void refreshNotifications();
    setOpen(false);
    if (item.url) navigate(item.url);
  }

  function markAllRead() {
    notificationService.markAllRead(user?.id);
    void refreshNotifications();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Button variant="outline" size="icon" aria-label="Mở menu"><Menu /></Button>
          <span className="font-bold text-slate-950">METTA Admin</span>
        </div>
        <div className="hidden w-full max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 lg:flex">
          <Search className="text-slate-400" />
          <Input className="border-0 px-0 shadow-none focus:border-0 focus:ring-0" placeholder="Tìm lead, phụ huynh, SĐT, chiến dịch..." />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div ref={dropdownRef} className="relative">
            <Button variant="outline" size="icon" aria-label="Mở notifications" onClick={() => setOpen((value) => !value)} className="relative">
              <Bell />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-extrabold text-white">
                  {unread}
                </span>
              )}
            </Button>
            {open && (
              <div className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-extrabold text-slate-950">Notifications</p>
                    <p className="text-xs text-slate-500">{unread} chưa đọc</p>
                  </div>
                  <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-bold text-[#003B7A] hover:text-[#1267AE]">
                    <CheckCheck size={14} /> Đánh dấu đã đọc
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openNotification(item)}
                      className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-blue-50 ${item.read ? 'bg-white' : 'bg-orange-50/60'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.body}</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-400">{timeLabel(item.createdAt)}</p>
                        </div>
                        {!item.read && <span className="mt-1 size-2 rounded-full bg-[#F45A0A]" />}
                      </div>
                    </button>
                  ))}
                  {!notifications.length && (
                    <div className="px-4 py-8 text-center text-sm font-semibold text-slate-400">
                      Chưa có notification mới.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold text-slate-950">{user?.fullName}</p>
            <p className="text-xs capitalize text-slate-500">{user?.role}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-full bg-[#003B7A] text-sm font-extrabold text-white">MA</div>
        </div>
      </div>
    </header>
  );
}
