import type { ThunderstoreMod } from '../types'

interface ModIconProps {
  src?: string | null
  alt: string
  className?: string
}

export function ModIcon({ src, alt, className = '' }: ModIconProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-repo-surface ${className}`}
      />
    )
  }

  return (
    <div className={`w-12 h-12 rounded-lg bg-repo-surface flex items-center justify-center flex-shrink-0 ${className}`}>
      <span className="text-repo-accent text-lg">◈</span>
    </div>
  )
}
