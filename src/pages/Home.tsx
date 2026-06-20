import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import StatusCard from '../components/StatusCard'
import { Rocket, Wrench } from 'lucide-react'

export function HomePage() {
  const { settings, bepinexStatus, installedMods, setPage, setBepInEx, setInstallProgress } = useAppStore()
  const [launching, setLaunching] = useState(false)
  const [installingBep, setInstallingBep] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLaunch = !!settings?.gamePath && bepinexStatus?.installed

  async function handleLaunch() {
    if (!canLaunch) return
    setLaunching(true)
    setError(null)
    try {
      await window.electronAPI.launchGame()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to launch game')
    } finally {
      setLaunching(false)
    }
  }

  async function handleInstallBepInEx() {
    setInstallingBep(true)
    setError(null)
    try {
      const removeListener = window.electronAPI.onProgress((p) => {
        setInstallProgress(p)
      })
      const status = await window.electronAPI.installBepInEx()
      setBepInEx(status)
      removeListener()
      setInstallProgress(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to install BepInEx')
    } finally {
      setInstallingBep(false)
    }
  }

  const enabledMods = installedMods.filter(m => m.enabled)

  return (
    <div className="flex-1 flex flex-col p-8 overflow-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-repo-text tracking-tight">
          R.E.P.O Mod Manager
        </h1>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <StatusCard
          label="Game Path"
          value={settings?.gamePath ? 'Detected' : 'Not set'}
          sub={settings?.gamePath ?? 'Go to Settings'}
          ok={!!settings?.gamePath}
        />
        <StatusCard
          label="BepInEx"
          value={bepinexStatus?.installed ? 'Installed' : 'Not installed'}
          sub={bepinexStatus?.version ?? 'Required for mods'}
          ok={!!bepinexStatus?.installed}
        />
        <StatusCard
          label="Active Mods"
          value={`${enabledMods.length} / ${installedMods.length}`}
          sub={installedMods.length === 0 ? 'No mods installed' : `${installedMods.length - enabledMods.length} disabled`}
          ok={installedMods.length > 0}
        />
      </div>

      {/* Action area */}
      <div className="flex flex-col items-start gap-4">
        {/* BepInEx missing warning */}
        {settings?.gamePath && !bepinexStatus?.installed && (
          <div className="w-full max-w-md glass-card rounded-xl p-4">
            <div className="text-repo-yellow font-medium mb-1">BepInEx not installed</div>
            <p className="text-repo-subtext text-sm mb-3">
              BepInEx is required to load mods. Install it automatically below.
            </p>
            <button
              onClick={handleInstallBepInEx}
              disabled={installingBep}
              className="inline-flex items-center gap-2 px-4 py-2 bg-repo-yellow text-black text-sm font-semibold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {installingBep ? (
                <>
                  <Wrench className="w-4 h-4 animate-spin" />
                  Installing...
                </>
              ) : (
                'Install BepInEx'
              )}
            </button>
          </div>
        )}

        {/* No game path */}
        {!settings?.gamePath && (
          <div className="w-full max-w-md glass-card rounded-xl p-4">
            <div className="text-repo-red font-medium mb-1">Game not found</div>
            <p className="text-repo-subtext text-sm mb-3">
              Set your REPO game folder path in Settings.
            </p>
            <button
              onClick={() => setPage('settings')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-repo-red text-white text-sm font-semibold rounded-lg hover:brightness-110 transition-all"
            >
              Open Settings
            </button>
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={!canLaunch || launching}
          className={`
            inline-flex items-center gap-2 px-10 py-4 rounded-xl text-lg font-bold tracking-wide
            transition-all duration-200
            ${canLaunch && !launching
              ? 'bg-repo-accent hover:bg-repo-accent-hover shadow-accent hover:shadow-lg hover:-translate-y-0.5 text-white'
              : 'bg-repo-surface border border-repo-border text-repo-muted cursor-not-allowed'
            }
          `}
        >
          {launching ? (
            <>
              <Rocket className="w-5 h-5 animate-pulse" />
              Launching...
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5" />
              Launch REPO
            </>
          )}
        </button>

        {canLaunch && (
          <p className="text-repo-muted text-xs font-mono">
            {enabledMods.length} mod{enabledMods.length !== 1 ? 's' : ''} will be loaded by BepInEx
          </p>
        )}

        {error && (
          <div className="text-repo-red text-sm bg-repo-red/10 border border-repo-red/20 px-4 py-2 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Installed mod quick list */}
      {installedMods.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-repo-text font-semibold">Installed Mods</h2>
            <button
              onClick={() => setPage('installed')}
              className="text-repo-accent text-sm hover:underline"
            >
              Manage all →
            </button>
          </div>
          <div className="space-y-2">
            {installedMods.slice(0, 5).map(mod => (
              <div
                key={mod.id}
                className="flex items-center gap-3 glass-card rounded-lg px-4 py-2.5"
              >
                <span className={`w-2 h-2 rounded-full ${mod.enabled ? 'bg-repo-green shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-repo-muted'}`} />
                <span className="text-repo-text text-sm font-medium">{mod.name}</span>
                <span className="text-repo-muted text-xs ml-auto font-mono">v{mod.version}</span>
              </div>
            ))}
            {installedMods.length > 5 && (
              <div className="text-repo-muted text-xs text-center py-1">
                +{installedMods.length - 5} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
