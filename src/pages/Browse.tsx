import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { ThunderstoreMod } from '../types'
import { ModCard } from '../components/ModCard'
import { RefreshCw, Wifi, ChevronLeft, ChevronRight, Search } from 'lucide-react'

const PER_PAGE_OPTIONS = [10, 25, 50] as const

export function BrowsePage() {
  const {
    browseMods, setBrowseMods, isLoadingBrowse, setLoadingBrowse,
    installedMods, setInstalledMods,
    installingModId, setInstallingModId, setInstallProgress,
    updates, setUpdates
  } = useAppStore()

  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<typeof PER_PAGE_OPTIONS[number]>(10)

  useEffect(() => {
    if (browseMods.length === 0) loadMods()
  }, [])

  useEffect(() => {
    setPage(1)
  }, [query, pageSize, browseMods.length])

  async function loadMods() {
    setLoadingBrowse(true)
    setError(null)
    try {
      const mods = await window.electronAPI.fetchMods()
      mods.sort((a, b) => b.rating_score - a.rating_score)
      setBrowseMods(mods)
      setPage(1)
    } catch {
      setError('Failed to load mods from Thunderstore. Check your internet connection.')
    } finally {
      setLoadingBrowse(false)
    }
  }

  async function handleCheckUpdates() {
    setCheckingUpdates(true)
    setError(null)
    setUpdateStatus(null)
    try {
      const result = await window.electronAPI.checkUpdates()
      setUpdates(result as Record<string, { hasUpdate: true; latestVersion: string }>)
      const count = Object.keys(result).length
      if (count > 0) {
        setUpdateStatus(`Found ${count} update(s)`)
      } else {
        setUpdateStatus('All installed mods are up to date')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check updates')
    } finally {
      setCheckingUpdates(false)
    }
  }

  async function handleInstall(mod: ThunderstoreMod) {
    setInstallingModId(mod.full_name)
    setInstallProgress(null)
    setError(null)

    const removeListener = window.electronAPI.onProgress((p) => {
      setInstallProgress(p)
    })

    try {
      await window.electronAPI.installMod(mod.full_name)
      const updated = await window.electronAPI.getInstalledMods()
      setInstalledMods(updated)
      setInstallProgress(null)
    } catch (e) {
      const raw = e instanceof Error ? e.message : ''
      if (raw.includes('cancelled')) {
        setError('Download dibatalkan.')
      } else if (raw.includes('network') || raw.includes('ENOTFOUND') || raw.includes('ETIMEDOUT')) {
        setError('Koneksi internet bermasalah. Periksa jaringan Anda.')
      } else if (raw.includes('API') || raw.includes('502') || raw.includes('503')) {
        setError('Layanan Thunderstore sedang gangguan. Coba lagi nanti.')
      } else if (raw) {
        setError(raw)
      } else {
        setError('Gagal menginstall mod.')
      }
    } finally {
      removeListener()
      setInstallingModId(null)
    }
  }

  const installedIds = useMemo(
    () => new Set(installedMods.map(m => m.id)),
    [installedMods]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return browseMods
    return browseMods.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.owner.toLowerCase().includes(q) ||
      m.versions[0]?.description.toLowerCase().includes(q)
    )
  }, [query, browseMods])

  const totalItems = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const visibleMods = filtered.slice(start, start + pageSize)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="px-8 pt-8 pb-5 border-b border-repo-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-repo-text">Browse Mods</h1>
            <p className="text-repo-muted text-sm">
              {isLoadingBrowse ? 'Loading...' : `${totalItems} mods`}
            </p>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-repo-muted" />
          <input
            type="text"
            placeholder="Search mods by name, author, or description..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full glass-card rounded-xl pl-10 pr-4 py-2.5 text-sm text-repo-text placeholder:text-repo-muted focus:outline-none focus:border-repo-accent/50"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={loadMods}
              disabled={isLoadingBrowse}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-card rounded-lg text-xs font-medium text-repo-subtext hover:text-repo-text hover:border-repo-accent/40 disabled:opacity-50 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleCheckUpdates}
              disabled={checkingUpdates}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 glass-card rounded-lg text-xs font-medium text-repo-subtext hover:text-repo-text hover:border-repo-accent/40 disabled:opacity-50 transition-all"
            >
              <Wifi className="w-3.5 h-3.5" />
              {checkingUpdates ? 'Checking...' : 'Check Updates'}
            </button>
          </div>
        </div>
        {updateStatus && (
          <div className="text-xs text-repo-subtext bg-repo-surface/80 border border-repo-border rounded-lg px-3 py-2 mt-3">
            {updateStatus}
          </div>
        )}
      </div>

      {/* Mod list */}
      <div className="flex-1 overflow-auto px-8 py-4 space-y-3">
        {error && (
          <div className="text-repo-red bg-repo-red/10 border border-repo-red/20 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {isLoadingBrowse && (
          <div className="flex items-center justify-center py-20">
            <div className="text-repo-muted text-sm animate-pulse">Loading mods from Thunderstore...</div>
          </div>
        )}

        {!isLoadingBrowse && visibleMods.map(mod => {
          const hasUpdate = !!updates[mod.full_name]?.hasUpdate
          const isLocked = !!installingModId && installingModId !== mod.full_name
          return (
            <ModCard
              key={mod.full_name}
              mod={mod}
              installed={installedIds.has(mod.full_name)}
              isInstalling={installingModId === mod.full_name}
              updateAvailable={installedIds.has(mod.full_name) && hasUpdate}
              onInstall={handleInstall}
              disabled={isLocked}
            />
          )
        })}

        {!isLoadingBrowse && totalItems > 0 && (
          <div className="flex items-center justify-between pt-3 pb-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 glass-card rounded-lg text-xs font-medium text-repo-subtext hover:text-repo-text hover:border-repo-accent/40 disabled:opacity-40 transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>
            <span className="text-repo-muted text-xs font-mono">
              Page {safePage} / {totalPages} · {totalItems} mods
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 glass-card rounded-lg text-xs font-medium text-repo-subtext hover:text-repo-text hover:border-repo-accent/40 disabled:opacity-40 transition-all"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
