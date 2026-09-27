/** Approved FT12 paths. One code-native mark for the shell at 32px and mobile at 27px. */
export function FTMark({ size, className = '' }: { size: 32 | 27; className?: string }) {
  return (
    <svg className={`ft-mark ${className}`} style={{ width: size, height: size }} viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false">
      <path d="M15 66V25c0-7 5-12 12-12h38" className="ft-mark-structure" strokeWidth="11" strokeLinecap="round" />
      <path d="M16 42h32" className="ft-mark-flow" strokeWidth="11" strokeLinecap="round" />
      <path d="M50 28v38M37 28h28" className="ft-mark-structure" strokeWidth="11" strokeLinecap="round" />
      <circle cx="50" cy="42" r="6" fill="#D7B66F" />
    </svg>
  )
}
