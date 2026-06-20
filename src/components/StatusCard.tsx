import { FolderOpen, CheckCircle2, AlertCircle, Puzzle } from 'lucide-react'

export default function StatusCard({
  label,
  value,
  sub,
  ok
}: {
  label: string
  value: string
  sub: string
  ok: boolean
}) {
  const icons: Record<string, React.ReactNode> = {
    'Game Path': <FolderOpen className="w-3.5 h-3.5" />,
    'BepInEx': <Puzzle className="w-3.5 h-3.5" />,
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-repo-muted text-[11px] mb-2.5 uppercase tracking-widest font-semibold">{label}</div>
      <div className={`flex items-center gap-2 font-semibold text-sm mb-2 ${ok ? 'text-repo-green' : 'text-repo-yellow'}`}>
        {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        <span>{value}</span>
      </div>
      <div className="text-repo-muted text-xs font-mono truncate flex items-center gap-1.5" title={sub}>
        {icons[label] || null}
        <span className="truncate">{sub}</span>
      </div>
    </div>
  )
}
