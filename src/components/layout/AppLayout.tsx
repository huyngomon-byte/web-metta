import { Outlet } from 'react-router-dom';
import { CallWidget } from '@/components/call/CallWidget';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { CallCenterProvider } from '@/context/CallCenterContext';

export function AppLayout() {
  return (
    <CallCenterProvider>
      <div className="min-h-screen bg-[#F7F9FC]">
        <Sidebar />
        <div className="lg:pl-72">
          <Topbar />
          <main className="p-4 md:p-8">
            <Outlet />
          </main>
        </div>
        <CallWidget />
      </div>
    </CallCenterProvider>
  );
}
