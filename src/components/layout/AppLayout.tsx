import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { CallWidget } from '@/components/call/CallWidget';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { CallCenterProvider } from '@/context/CallCenterContext';

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <CallCenterProvider>
      <div className="min-h-screen overflow-x-hidden bg-[#F7F9FC]">
        <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className="min-w-0 lg:pl-72">
          <Topbar onMenuClick={() => setMobileMenuOpen(true)} />
          <main className="min-w-0 p-3 pb-20 sm:p-4 md:p-8">
            <Outlet />
          </main>
        </div>
        <CallWidget />
      </div>
    </CallCenterProvider>
  );
}
