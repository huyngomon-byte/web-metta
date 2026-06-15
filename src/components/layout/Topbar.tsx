import { Bell, CheckCheck, ChevronDown, LogOut, Menu, Search, UserCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { notificationService } from '@/services/notificationService';
import type { AppNotification } from '@/types/notification';

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const notificationRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [syncWarning, setSyncWarning] = useState('');

  const unread = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    setNotifications(notificationService.getForUser(user.id).slice(0, 10));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      return undefined;
    }
    return notificationService.subscribeForUser(user.id, (items) => setNotifications(items.slice(0, 10)), () => {
      void refreshNotifications();
    });
  }, [refreshNotifications, user?.id]);

  useEffect(() => {
    const onUpdate = () => void refreshNotifications();
    const onRealtimeError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      setSyncWarning(detail || 'Realtime sync đang fallback');
    };
    const onRealtimeOk = () => setSyncWarning('');
    window.addEventListener('metta-notifications-updated', onUpdate);
    window.addEventListener('focus', onUpdate);
    window.addEventListener('metta-realtime-error', onRealtimeError);
    window.addEventListener('metta-realtime-ok', onRealtimeOk);
    return () => {
      window.removeEventListener('metta-notifications-updated', onUpdate);
      window.removeEventListener('focus', onUpdate);
      window.removeEventListener('metta-realtime-error', onRealtimeError);
      window.removeEventListener('metta-realtime-ok', onRealtimeOk);
    };
  }, [refreshNotifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!notificationRef.current?.contains(target)) setNotificationsOpen(false);
      if (!accountRef.current?.contains(target)) setAccountOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function openNotification(item: AppNotification) {
    setNotifications((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry)));
    notificationService.markRead(item.id);
    setNotificationsOpen(false);
    if (item.url) navigate(item.url);
  }

  function markAllRead() {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    notificationService.markAllRead(user?.id);
  }

  async function handleLogout() {
    setAccountOpen(false);
    await signOut();
    navigate('/login');
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur md:px-8 md:py-3">
      <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <Button variant="outline" size="icon" aria-label="Mở menu" onClick={onMenuClick} className="shrink-0">
            <Menu />
          </Button>
          <span className="truncate font-bold text-slate-950">METTA Admin</span>
        </div>
        <div className="hidden w-full max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 lg:flex">
          <Search className="text-slate-400" />
          <Input className="border-0 px-0 shadow-none focus:border-0 focus:ring-0" placeholder="Tìm lead, phụ huynh, SĐT, chiến dịch..." />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          {syncWarning && (
            <span title={syncWarning} className="hidden rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 md:inline-flex">
              Sync thủ công
            </span>
          )}
          <div ref={notificationRef} className="relative">
            <Button variant="outline" size="icon" aria-label="Mở notifications" onClick={() => setNotificationsOpen((value) => !value)} className="relative">
              <Bell />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-extrabold text-white">
                  {unread}
                </span>
              )}
            </Button>
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-[360px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
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
          <div ref={accountRef} className="relative">
            <button
              type="button"
              aria-label="Mở menu tài khoản"
              onClick={() => setAccountOpen((value) => !value)}
              className="flex h-10 items-center gap-1 rounded-full border border-slate-200 bg-white pl-1 pr-2 shadow-sm transition hover:bg-slate-50"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-[#003B7A] text-xs font-extrabold text-white">
                {user?.fullName?.slice(0, 2).toUpperCase() || 'MA'}
              </span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${accountOpen ? 'rotate-180' : ''}`} />
            </button>
            {accountOpen && (
              <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-[#003B7A]">
                      <UserCircle size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-950">{user?.fullName || 'METTA Admin'}</p>
                      <p className="truncate text-xs capitalize text-slate-500">{user?.role}</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
