import { Bell, Menu, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';

export function Topbar() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:hidden">
          <Button variant="outline" size="icon"><Menu /></Button>
          <span className="font-bold text-slate-950">METTA Admin</span>
        </div>
        <div className="hidden w-full max-w-xl items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 lg:flex">
          <Search className="text-slate-400" />
          <Input className="border-0 px-0 shadow-none focus:border-0 focus:ring-0" placeholder="Tìm lead, phụ huynh, SĐT, chiến dịch..." />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" size="icon"><Bell /></Button>
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
