import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Database,
  FileText,
  Gauge,
  Image,
  LayoutTemplate,
  ListTodo,
  LogOut,
  Megaphone,
  Menu,
  Newspaper,
  PanelBottom,
  SearchCheck,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  WalletCards,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { canAccessPath } from '@/lib/permissions';

const dashboardItems = [{ label: 'Dashboard', path: '/dashboard', icon: Gauge }];

const crmItems = [
  { label: 'Leads', path: '/crm/leads', icon: SearchCheck },
  { label: 'Phân lead', path: '/crm/lead-assignment', icon: UserPlus },
  { label: 'Tasks', path: '/crm/tasks', icon: ListTodo },
  { label: 'Appointments', path: '/appointments', icon: CalendarDays },
  { label: 'Database', path: '/crm/database', icon: Database },
];

const marketingItems = [
  { label: 'CAPI Manager', path: '/capi', icon: Megaphone },
  { label: 'CAPI Events', path: '/capi/events', icon: BarChart3 },
  { label: 'Source Engine', path: '/marketing/source-engine', icon: SlidersHorizontal },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
];

const websiteItems = [
  { label: 'Website CMS', path: '/cms/pages', icon: LayoutTemplate },
  { label: 'Chương trình học', path: '/cms/programs', icon: BookOpen },
  { label: 'Header Menu', path: '/cms/header-menu', icon: Menu },
  { label: 'Blog / Tin tức', path: '/cms/blog', icon: Newspaper },
  { label: 'Footer', path: '/cms/footer', icon: PanelBottom },
  { label: 'Trang pháp lý', path: '/cms/legal', icon: FileText },
  { label: 'Media Library', path: '/media', icon: Image },
];

const systemItems = [
  { label: 'Users & Roles', path: '/users', icon: ShieldCheck },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const groups = [
  { title: '', items: dashboardItems },
  { title: 'CRM', items: crmItems },
  { title: 'Marketing', items: marketingItems },
  { title: 'Website', items: websiteItems, collapsible: true },
  { title: 'System', items: systemItems },
];

export function Sidebar() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const websiteVisibleItems = useMemo(
    () => websiteItems.filter((item) => canAccessPath(user, item.path)),
    [user],
  );
  const websiteActive = websiteVisibleItems.some((item) => location.pathname.startsWith(item.path));

  useEffect(() => {
    if (websiteActive) setWebsiteOpen(true);
  }, [websiteActive]);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-72 flex-col bg-[#003B7A] p-5 text-white lg:flex">
      <BrandLogo light />
      <div className="mt-5 rounded-xl border border-white/10 bg-white/8 p-4">
        <div className="flex items-center gap-3">
          <WalletCards className="text-[#16A9D8]" />
          <div>
            <p className="text-sm font-bold">METTA Admin</p>
            <p className="text-xs text-white/60">Website + CRM + CAPI</p>
          </div>
        </div>
      </div>
      <nav className="mt-5 flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {groups.map((group) => {
          const items = group.items.filter((item) => canAccessPath(user, item.path));
          if (!items.length) return null;

          if (group.collapsible) {
            return (
              <div key={group.title}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white',
                    websiteActive && 'bg-white/10 text-white',
                  )}
                  onClick={() => setWebsiteOpen((value) => !value)}
                  aria-expanded={websiteOpen}
                >
                  <LayoutTemplate />
                  <span className="flex-1 text-left">{group.title}</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', websiteOpen && 'rotate-180')} />
                </button>
                {websiteOpen && (
                  <div className="mt-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                    {items.map((item) => (
                      <NavLink
                        key={`${item.label}-${item.path}`}
                        to={item.path}
                        className={({ isActive }) => cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-white/62 transition hover:bg-white/10 hover:text-white',
                          isActive && 'bg-[#F45A0A] text-white shadow-lg shadow-orange-950/20',
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={group.title || 'dashboard'}>
              {group.title && <p className="mb-2 px-3 text-[11px] font-extrabold uppercase tracking-widest text-white/40">{group.title}</p>}
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <NavLink
                    key={`${item.label}-${item.path}`}
                    to={item.path}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/72 transition hover:bg-white/10 hover:text-white',
                      isActive && 'bg-[#F45A0A] text-white shadow-lg shadow-orange-950/20',
                    )}
                  >
                    <item.icon />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      <Button variant="ghost" className="mt-5 justify-start bg-white/8 text-white hover:bg-white/12 hover:text-white" onClick={handleLogout}>
        <LogOut data-icon="inline-start" /> Logout
      </Button>
    </aside>
  );
}
