import type { ReactNode } from 'react'

interface FinancialIconProps {
  name: string
  size?: number
  className?: string
  strokeWidth?: number
}

const ICON_PATHS: Record<string, ReactNode> = {
  wallet: (
    <>
      <path d="M3 7h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>
      <path d="M16 12h.01"/>
      <path d="M3 9h18"/>
    </>
  ),
  bank: (
    <>
      <path d="m3 10 9-6 9 6"/>
      <path d="M4 10h16"/>
      <path d="M6 10v7m4-7v7m4-7v7m4-7v7"/>
      <path d="M3 20h18"/>
    </>
  ),
  'credit-card': (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2"/>
      <path d="M2.5 10h19"/>
      <path d="M7 14.5h3"/>
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.5" rx="6.5" ry="2.5"/>
      <path d="M5.5 6.5V12c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6.5"/>
      <path d="M5.5 12v5.5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V12"/>
    </>
  ),
  'piggy-bank': (
    <>
      <path d="M4 13a7 7 0 0 1 7-7h2.6a4.4 4.4 0 0 1 3.1 1.3L18 8.6h2v2.2h-1.3a5.9 5.9 0 0 1-1.1 3.2l.9 3H15l-.6-1.4a8.1 8.1 0 0 1-3 .4H9.3L8.2 19H5.8l.8-2.5A4 4 0 0 1 4 13Z"/>
      <circle cx="14.5" cy="10.7" r="0.8" fill="currentColor" stroke="none"/>
      <path d="M11 5.2V3.8h3"/>
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2"/>
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
      <path d="M3 12h18"/>
    </>
  ),
  shield: (
    <>
      <path d="m12 3 7 3v5c0 4.7-2.8 8-7 10-4.2-2-7-5.3-7-10V6l7-3Z"/>
      <path d="m9 12 2 2 4-4"/>
    </>
  ),
  'chart-line': (
    <>
      <path d="M3 3v18h18"/>
      <path d="m7 14 4-4 3 3 4-5"/>
      <circle cx="7" cy="14" r="0.7" fill="currentColor" stroke="none"/>
      <circle cx="11" cy="10" r="0.7" fill="currentColor" stroke="none"/>
      <circle cx="14" cy="13" r="0.7" fill="currentColor" stroke="none"/>
      <circle cx="18" cy="8" r="0.7" fill="currentColor" stroke="none"/>
    </>
  ),
  tag: (
    <>
      <path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0L3 13.3V4h9.3l7.7 7.7a2 2 0 0 1 0 2.8Z"/>
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none"/>
    </>
  ),
  utensils: (
    <>
      <path d="M4 3v8m2-8v8m-1 0v10"/>
      <path d="M10 3v5a2 2 0 0 1-2 2H6"/>
      <path d="M15 3v8m0 0c2.2 0 4-1.8 4-4V3m-4 8v10"/>
    </>
  ),
  car: (
    <>
      <path d="M4 14h16l-1.5-4.5a2 2 0 0 0-1.9-1.4H7.4a2 2 0 0 0-1.9 1.4L4 14Z"/>
      <path d="M3.5 14v4h2m13 0h2v-4"/>
      <circle cx="7.5" cy="18" r="1.8"/>
      <circle cx="16.5" cy="18" r="1.8"/>
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-7 9 7"/>
      <path d="M5 10v10h14V10"/>
      <path d="M10 20v-5h4v5"/>
    </>
  ),
  heart: (
    <>
      <path d="M20.8 8.7a4.8 4.8 0 0 0-8.3-3.3L12 6l-.5-.6a4.8 4.8 0 1 0-6.8 6.8L12 19.5l7.3-7.3a4.7 4.7 0 0 0 1.5-3.5Z"/>
    </>
  ),
  'book-open': (
    <>
      <path d="M3 5.8A2.8 2.8 0 0 1 5.8 3H11v17H5.8A2.8 2.8 0 0 0 3 22V5.8Z"/>
      <path d="M21 5.8A2.8 2.8 0 0 0 18.2 3H13v17h5.2A2.8 2.8 0 0 1 21 22V5.8Z"/>
    </>
  ),
  film: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M7 5v14M17 5v14M3 9h4m10 0h4M3 15h4m10 0h4"/>
    </>
  ),
  package: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/>
      <path d="M12 21v-9.5"/>
      <path d="m4 7.5 8 4.5 8-4.5"/>
    </>
  ),
  'file-minus': (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/>
      <path d="M14 3v6h6"/>
      <path d="M8 14h8"/>
    </>
  ),
  'minus-circle': (
    <>
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 12h8"/>
    </>
  ),
}

export function FinancialIcon({
  name,
  size = 16,
  className = '',
  strokeWidth = 1.9,
}: FinancialIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {ICON_PATHS[name] ?? ICON_PATHS.tag}
    </svg>
  )
}
