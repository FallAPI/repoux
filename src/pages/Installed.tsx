import { useAppStore } from '../store/useAppStore'
import { ModIcon } from '../components/ModIcon'
import { useState, useEffect } from 'react'
import { Download, AlertTriangle, X } from 'lucide-react'

export function InstalledPage() {
  const {
    installedMods, setInstalledMods, conflicts, setConflicts,
    installProgress, installingModId, browseMods,
    setInstallProgress, setInstallingModId
  } = useAppStore()
  const [installingZip, setInstallingZip] = useState(false)
  const [errorZip, setErrorZip] = useState<string | null>(null)
  const [checkingConflicts, setCheckingConflicts] = useState(false)

  useEffect(() => {
    window.electronAPI.getInstalledMods().then(setInstalledMods).catch(() => { })
  }, [setInstalledMods])

  async function handleToggle(modId: string, currentEnabled: boolean) {
    await window.electronAPI.toggleMod(modId, !currentEnabled)
    const updated = await window.electronAPI.getInstalledMods()
    setInstalledMods(updated)
  }

  async function handleUninstall(modId: string) {
    await window.electronAPI.uninstallMod(modId)
    const updated = await window.electronAPI.getInstalledMods()
    setInstalledMods(updated)
  }

  async function handleCheckConflicts() {
    setCheckingConflicts(true)
    setErrorZip(null)
    try {
      const result = await window.electronAPI.checkConflicts()
      setConflicts(result)
    } catch (e) {
      setErrorZip(e instanceof Error ? e.message : 'Failed to check conflicts')
    } finally {
      setCheckingConflicts(false)
    }
  }

  useEffect(() => {
    handleCheckConflicts()
  }, [])

  async function handleInstallZip() {
    setInstallingZip(true)
    setErrorZip(null)
    try {
      const zipPath = await window.electronAPI.browseForZip()
      if (!zipPath) return

      const removeListener = window.electronAPI.onProgress((p) => {
        setInstallProgress(p)
      })

      const installed = await window.electronAPI.installModFromZip(zipPath)
      const updated = await window.electronAPI.getInstalledMods()
      setInstalledMods(updated)
      removeListener()
      setInstallProgress(null)
    } catch (e) {
      const raw = e instanceof Error ? e.message : ''
      if (raw.includes('cancelled')) {
        setErrorZip('Download dibatalkan.')
      } else if (raw.includes('network') || raw.includes('ENOTFOUND') || raw.includes('ETIMEDOUT')) {
        setErrorZip('Koneksi internet bermasalah. Periksa jaringan Anda.')
      } else if (raw.includes('API') || raw.includes('502') || raw.includes('503')) {
        setErrorZip('Layanan Thunderstore sedang gangguan. Coba lagi nanti.')
      } else if (raw) {
        setErrorZip(raw)
      } else {
        setErrorZip('Gagal menginstall mod.')
      }
    } finally {
      setInstallingZip(false)
      setInstallingModId(null)
    }
  }

  async function handleCancelInstall(modId: string) {
    try {
      await window.electronAPI.cancelInstall(modId)
      const updated = await window.electronAPI.getInstalledMods()
      setInstalledMods(updated)
      setInstallProgress(null)
      setInstallingZip(false)
      setInstallingModId(null)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to cancel install'
      if (message !== 'Download cancelled') {
        setErrorZip(message)
      }
    }
  }

  const installingModFromBrowse = installingModId
    ? browseMods.find(m => m.full_name === installingModId)
    : null
  const isInstalling = !!installingModId
  const progress = installProgress

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-repo-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-repo-text">Installed Mods</h1>
            <p className="text-repo-muted text-sm">
              {installedMods.length} mod{installedMods.length !== 1 ? 's' : ''} installed
              {' · '}
              {installedMods.filter(m => m.enabled).length} active
            </p>
          </div>
          <button
            onClick={handleInstallZip}
            disabled={installingZip || isInstalling}
            className="px-4 py-2 bg-repo-accent text-white text-sm font-medium rounded-lg
              hover:bg-repo-accent-hover disabled:opacity-50 transition-all"
          >
            {installingZip ? 'Installing...' : '+ Install from ZIP'}
          </button>
        </div>
      </div>

      {/* Conflict Alert */}
      {conflicts.length > 0 && (
        <div className="mx-8 mt-4 glass-card border-repo-red/40 rounded-xl p-4">
          <div className="flex items-center gap-2 text-repo-red font-semibold text-sm mb-2">
            <AlertTriangle className="w-4 h-4" />
            Mod Conflict Detected
          </div>
          <div className="space-y-2">
            {conflicts.map((c, idx) => (
              <div key={idx} className="text-repo-subtext text-xs">
                <span className="text-repo-text font-medium">{c.modA}</span>
                <span className="text-repo-muted mx-1">vs</span>
                <span className="text-repo-text font-medium">{c.modB}</span>
                <span className="text-repo-muted ml-2">— {c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {errorZip && (
        <div className="text-repo-red text-sm bg-repo-red/10 border border-repo-red/20 px-4 py-2 rounded-lg mx-8 mt-4">
          {errorZip}
        </div>
      )}

      {/* Ghost Card - Install Progress */}
      {(installingModFromBrowse || installingZip) && progress && (
        <div className="mx-8 mt-4 glass-card border-repo-accent/40 rounded-xl p-4 flex gap-4">
          <div className="w-12 h-12 rounded-lg bg-repo-surface flex-shrink-0 flex items-center justify-center">
            {installingModFromBrowse ? (
              <ModIcon src={installingModFromBrowse.versions[0]?.icon} alt={installingModFromBrowse.name} />
            ) : (
              <Download className='w-5 h-5 text-repo-accent animate-bounce' />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-repo-text font-semibold text-sm truncate">
              {installingModFromBrowse
                ? `Installing ${installingModFromBrowse.name}...`
                : 'Installing from ZIP...'}
            </div>
            <div className="text-repo-subtext text-xs mb-2">{progress.message}</div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-repo-subtext">Progress</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-repo-accent font-mono">
                  {progress.percent !== undefined ? `${progress.percent}%` : ''}
                </span>
                <button
                  onClick={() => handleCancelInstall(installingModFromBrowse?.full_name ?? installingModId ?? '')}
                  className="text-repo-muted hover:text-repo-red transition-colors"
                  title="Cancel download"
                >
                  <X className='w-3.5 h-3.5' />
                </button>
              </div>
            </div>
            <div className="w-full bg-repo-surface rounded-full h-2 overflow-hidden">
              <div
                className="bg-repo-accent h-full rounded-full transition-all duration-300"
                style={{ width: `${progress.percent ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-auto px-8 py-4 space-y-3">
        {installedMods.length === 0 && !installingModId && !installingZip && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-4xl mb-3 text-repo-muted">◈</div>
            <div className="text-repo-text font-medium mb-1">No mods installed</div>
            <div className="text-repo-muted text-sm">Browse and install mods from the Browse tab.</div>
          </div>
        )}

        {installedMods.map(mod => {
          const modIsInstalling = isInstalling && mod.id === installingModId
          const modProgress = modIsInstalling ? progress : null

          return (
            <div
              key={mod.id}
              className={`glass-card rounded-xl p-4 flex gap-4 transition-all duration-200
                ${mod.enabled ? 'border-repo-border/70' : 'border-repo-border/40 opacity-60'}
                ${modIsInstalling ? 'border-repo-accent/60 shadow-accent' : ''}`}
            >
              <ModIcon src={mod.iconUrl} alt={mod.name} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-repo-text font-semibold text-sm">{mod.name}</div>
                    <div className="text-repo-muted text-xs">by {mod.author}</div>
                  </div>
                  <span className="text-repo-muted text-xs font-mono flex-shrink-0">
                    v{mod.version}
                  </span>
                </div>
                <p className="text-repo-subtext text-xs mt-1 line-clamp-1">{mod.description}</p>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3">
                  {modIsInstalling && modProgress ? (
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-repo-subtext">{modProgress.message}</span>
                        <span className="text-xs text-repo-accent font-mono">
                          {modProgress.percent !== undefined ? `${modProgress.percent}%` : ''}
                        </span>
                      </div>
                      <div className="w-full bg-repo-surface rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-repo-accent h-full rounded-full transition-all duration-300"
                          style={{ width: `${modProgress.percent ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleToggle(mod.id, mod.enabled)}
                        disabled={modIsInstalling}
                        className={`text-xs px-4 py-1.5 rounded-lg font-bold transition-all border
                          ${mod.enabled
                            ? 'border-repo-green text-repo-green bg-repo-green/10'
                            : 'border-repo-red text-repo-red bg-repo-red/10'
                          } disabled:opacity-60 disabled:cursor-not-allowed`}
                      >
                        {mod.enabled ? '● ACTIVE' : '○ DISABLED'}
                      </button>

                      <button
                        onClick={() => handleUninstall(mod.id)}
                        disabled={modIsInstalling}
                        className="text-xs px-3 py-1 rounded-lg font-medium border border-repo-border
                          text-repo-muted hover:border-repo-red/40 hover:text-repo-red hover:bg-repo-red/10
                          transition-all ml-auto disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Uninstall
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
