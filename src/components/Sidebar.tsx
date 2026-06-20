import { useAppStore } from '../store/useAppStore'
import { Home, Gamepad2, Puzzle, Settings } from 'lucide-react'

const NAV = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'browse', label: 'Browse Mods', icon: Gamepad2 },
  { id: 'installed', label: 'Installed', icon: Puzzle },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export function Sidebar() {
  const { page, setPage, bepinexStatus, installedMods } = useAppStore()

  return (
    <aside className="w-56 glass border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-10 pb-6">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-repo-text text-sm font-bold tracking-wide">REPO</div>
            <div className="text-repo-muted text-xs">Mod Manager</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-150
              ${page === item.id
                ? 'bg-repo-accent text-white shadow-accent'
                : 'text-repo-subtext hover:text-repo-text hover:bg-white/5'
              }
            `}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
            {item.id === 'installed' && installedMods.length > 0 && (
              <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${page === item.id ? 'bg-white/20 text-white' : 'bg-white/10 text-repo-muted'
                }`}>
                {installedMods.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* BepInEx status badge */}
      <div className="px-4 pb-5">
        <div className="glass-card rounded-xl px-3 py-2.5">
          <div className="text-xs text-repo-muted mb-1.5 font-medium">BepInEx</div>
          {bepinexStatus?.installed ? (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-repo-green shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs text-repo-green font-mono font-medium">Ready</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-repo-yellow" />
              <span className="text-xs text-repo-yellow font-mono">Not installed</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
