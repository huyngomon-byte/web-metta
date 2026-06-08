import { Outlet } from 'react-router-dom';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicHeader } from '@/components/public/PublicHeader';
import { MessengerButton } from '@/components/public/MessengerButton';

export default function PublicLayout() {
  return (
    <>
      <PublicHeader />
      <Outlet />
      <PublicFooter />
      <MessengerButton />
    </>
  );
}
