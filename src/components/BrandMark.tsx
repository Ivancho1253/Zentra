import type { SVGProps } from 'react';

/** Zentra's own geometric Z; never a third-party chart vendor's mark. */
export default function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" {...props}>
      <path d="M6 7h20L10 25h16" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="miter" />
      <path d="M6 25V19" stroke="currentColor" strokeWidth="3.5" />
    </svg>
  );
}
