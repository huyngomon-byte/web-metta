import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

export const ChessPieceIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ color = 'currentColor', size = 24, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={color}
        stroke="none"
        aria-hidden="true"
        {...props}
      >
        <path d="M11 2h2v2h2v2h-2v2h-2V6H9V4h2V2Z" />
        <path d="M6.5 8.5h11L16.2 12H7.8L6.5 8.5Z" />
        <path d="M7 13h10v1.7H7V13Z" />
        <path d="M8.4 15.2h7.2l1.7 5.3H6.7l1.7-5.3Z" />
        <path d="M5 21h14v1.7H5V21Z" />
      </svg>
    );
  }
);

ChessPieceIcon.displayName = 'ChessPieceIcon';
