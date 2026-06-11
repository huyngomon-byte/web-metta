import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeader } from '@/components/public/PublicHeader';
import { MessengerButton } from '@/components/public/MessengerButton';

// Có thể dùng như: (1) Route layout với <Outlet/>, hoặc (2) wrapper nhận children
// (vd: PublicPageRouter quyết định runtime page nào dùng layout này).
export default function PublicLayout({ children }: { children?: ReactNode }) {
  return (
    <>
      <PublicHeader />
      {children ?? <Outlet />}
      <PublicFooter />
      <MessengerButton />
    </>
  );
}
