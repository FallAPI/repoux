import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  desc: string
  children: ReactNode
}

export function Section({ title, desc, children }: SectionProps) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="mb-4">
        <div className="text-repo-text font-semibold mb-1">{title}</div>
        {desc && <div className="text-repo-muted text-xs">{desc}</div>}
      </div>
      {children}
    </div>
  )
}
