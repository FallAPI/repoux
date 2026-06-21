import { Sidebar } from './components/Sidebar'
import { HomePage } from './pages/Home'
import { BrowsePage } from './pages/Browse'
import { InstalledPage } from './pages/Installed'
import { SettingsPage } from './pages/Settings'
import { ProgressOverlay } from './components/ProgressOverlay'
import { useAppStore } from './store/useAppStore'
import { useEffect } from 'react'

function Page() {
  const { page } = useAppStore()
  switch (page) {
    case 'home': return <HomePage />
    case 'browse': return <BrowsePage />
    case 'installed': return <InstalledPage />
    case 'settings': return <SettingsPage />
    default: return <HomePage />
  }
}

function App() {
  const { setInstalledMods, setSettings, setBepInEx } = useAppStore()

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const settings = await window.electronAPI.getSettings()

        if (!cancelled) {
          setSettings(settings)
        }

        if (!settings?.gamePath) {
          const detected = await window.electronAPI.detectGamePath()

          if (!cancelled && detected) {
            const updated = await window.electronAPI.setGamePath(detected)
            setSettings(updated)
          }
        }

        if (!cancelled) {
          const settingsForBep = await window.electronAPI.getSettings()
          if (settingsForBep?.gamePath) {
            const bep = await window.electronAPI.checkBepInEx()
            if (!cancelled) {
              setBepInEx(bep)
            }
          }
        }
      } catch {
        // silent fail — user can still use app
      }

      const mods = await window.electronAPI.getInstalledMods().catch(() => [])
      if (!cancelled) {
        setInstalledMods(mods)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [setSettings, setBepInEx, setInstalledMods])

  return (
    <div className="flex flex-col h-screen bg-repo-bg text-repo-text overflow-hidden">
      {/* Custom Title Bar */}
      <div 
        className="flex items-center justify-between h-9 bg-[#12121a] px-2 select-none"
        style={{ '-webkit-app-region': 'drag' } as React.CSSProperties}
      >
        <div className="text-xs text-repo-muted font-medium ml-2">REPO Mod Manager</div>
        <div className="flex gap-1" style={{ '-webkit-app-region': 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => window.electronAPI.minimizeWindow()}
            className="w-11 h-7 flex items-center justify-center text-repo-subtext hover:text-repo-text hover:bg-white/10 rounded transition-all"
            title="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() => window.electronAPI.maximizeWindow()}
            className="w-11 h-7 flex items-center justify-center text-repo-subtext hover:text-repo-text hover:bg-white/10 rounded transition-all"
            title="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" />
            </svg>
          </button>
          <button
            onClick={() => window.electronAPI.closeWindow()}
            className="w-11 h-7 flex items-center justify-center text-repo-subtext hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="1" x2="9" y2="9" />
              <line x1="9" y1="1" x2="1" y2="9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <Page />
        </main>
        <ProgressOverlay />
      </div>
    </div>
  )
}

export default App
