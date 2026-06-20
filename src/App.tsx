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
    <div className="flex h-screen bg-repo-bg text-repo-text overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Page />
      </main>
      <ProgressOverlay />
    </div>
  )
}

export default App
