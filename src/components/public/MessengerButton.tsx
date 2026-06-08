import { useThemeSettings } from '@/hooks/useCms';

const DEFAULT_MESSENGER_URL = 'https://www.facebook.com/messages/t/anhngumetta';
const MESSENGER_ICON = '/brand/logo messenger.webp?v=20260601-1818';

export function MessengerButton() {
  const { settings } = useThemeSettings();
  const href = settings?.socials?.messenger || settings?.socials?.facebookMessenger || DEFAULT_MESSENGER_URL;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label="Nhắn tin METTA Academy qua Messenger"
      className="fixed bottom-5 right-5 z-[80] flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#146BFF] shadow-[0_12px_30px_rgba(0,102,255,0.28)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,102,255,0.38)] focus:outline-none focus:ring-4 focus:ring-[#0066FF]/20 md:bottom-7 md:right-7"
    >
      <img src={MESSENGER_ICON} alt="" className="h-[76px] w-[76px] max-w-none rounded-full object-cover" />
    </a>
  );
}
