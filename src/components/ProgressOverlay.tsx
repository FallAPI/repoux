import { Loader2, X } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export function ProgressOverlay() {
  const { installProgress, installingModId, setInstalledMods, setInstallingModId, setInstallProgress } = useAppStore()

  if (!installProgress || installProgress.step === 'done') return null

  async function handleCancel() {
    try {
      if (installingModId) {
        await window.electronAPI.cancelInstall(installingModId)
        const updated = await window.electronAPI.getInstalledMods()
        setInstalledMods(updated)
      }
    } catch {
      // ignore cancel errors
    } finally {
      setInstallingModId(null)
      setInstallProgress(null)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 glass-card border-repo-accent/40 rounded-xl
      p-4 shadow-glass w-72 z-50 animate-in">
      <div className="flex items-center gap-3 mb-2.5">
        <Loader2 className="w-4 h-4 text-repo-accent animate-spin" />
        <span className="text-repo-text text-sm font-semibold flex-1">{installProgress.message}</span>
        <button
          onClick={handleCancel}
          className="text-repo-muted hover:text-repo-red transition-colors"
          title="Cancel download"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {installProgress.percent !== undefined && (
        <div className="w-full bg-repo-surface/80 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-repo-accent h-full rounded-full transition-all duration-300"
            style={{ width: `${installProgress.percent}%` }}
          />
        </div>
      )}
    </div>
  )
}
