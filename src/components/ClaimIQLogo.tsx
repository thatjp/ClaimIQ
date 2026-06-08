import Link from 'next/link'

interface ClaimIQLogoProps {
  /** `dark` = light text on dark sidebar; `light` = original brand colors on light backgrounds */
  variant?: 'dark' | 'light'
  size?: 'sm' | 'md'
  href?: string
  className?: string
}

function LogoMark({ size }: { size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M22 13 H15 Q11 13 11 17 V47 Q11 51 15 51 H22"
        fill="none"
        stroke="#2563EB"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M42 13 H49 Q53 13 53 17 V47 Q53 51 49 51 H42"
        fill="none"
        stroke="#2563EB"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M25.5 33 L30.5 38.5 L40 26"
        fill="none"
        stroke="#38BDF8"
        strokeWidth="5.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const SIZES = {
  sm: { icon: 24, fontSize: 18, letterSpacing: '-0.36px' },
  md: { icon: 30, fontSize: 26, letterSpacing: '-0.52px' },
} as const

export function ClaimIQLogo({
  variant = 'light',
  size = 'md',
  href = '/app/dashboard',
  className = '',
}: ClaimIQLogoProps) {
  const { icon, fontSize, letterSpacing } = SIZES[size]
  const claimColor = variant === 'dark' ? '#F9FAFB' : '#0B1B33'
  const iqColor = '#2563EB'

  const content = (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={icon} />
      <span
        className="font-bold whitespace-nowrap leading-none"
        style={{
          fontFamily: 'var(--font-space-grotesk), sans-serif',
          fontSize,
          letterSpacing,
        }}
      >
        <span style={{ color: claimColor }}>Claim</span>
        <span style={{ color: iqColor }}>IQ</span>
      </span>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex hover:opacity-90 transition-opacity">
        {content}
      </Link>
    )
  }

  return content
}
