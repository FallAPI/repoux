import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { ModProfile, ProfileSummary } from '../types'

export function ProfileManager() {
  const { setProfiles, setActiveProfile, activeProfile, installedMods } = useAppStore()

  const [profiles, setLocalProfiles] = useState<ProfileSummary[]>([])
  const [selectedProfile, setSelectedProfile] = useState<ModProfile | null>(null)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshProfiles = useCallback(async () => {
    try {
      const list = await window.electronAPI.getProfiles()
      setLocalProfiles(list)
      setProfiles(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load profiles')
    }
  }, [setProfiles])

  useEffect(() => {
    refreshProfiles()
  }, [refreshProfiles])

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading(true)
    setError(null)
    try {
      const enabledMods = installedMods.filter(m => m.enabled).map(m => m.id)
      await window.electronAPI.saveProfile({ profileName: newName.trim(), mods: enabledMods })
      setNewName('')
      await refreshProfiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleApply(item: ProfileSummary) {
    setLoading(true)
    setError(null)
    try {
      const full = await window.electronAPI.loadProfile(item.profileName)
      if (!full) throw new Error('Profile not found')
      await window.electronAPI.applyProfile(item.profileName)
      setActiveProfile(item.profileName)
      setSelectedProfile(full)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply profile')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(item: ProfileSummary) {
    setLoading(true)
    setError(null)
    try {
      await window.electronAPI.deleteProfile(item.profileName)
      if (activeProfile === item.profileName) setActiveProfile(null)
      await refreshProfiles()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-repo-card border border-repo-border rounded-xl p-5">
      <div className="mb-4">
        <div className="text-repo-text font-semibold mb-0.5">Profiles</div>
        <div className="text-repo-muted text-xs">Save and load your mod configurations</div>
      </div>

      {error && (
        <div className="text-repo-red text-sm bg-repo-red/10 border border-repo-red/20 px-3 py-2 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Profile name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
          className="flex-1 bg-repo-surface border border-repo-border text-repo-text text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-repo-accent"
        />
        <button
          onClick={handleCreate}
          disabled={loading || !newName.trim()}
          className="px-4 py-2 bg-repo-accent text-white text-sm font-medium rounded-lg hover:bg-repo-accent-hover disabled:opacity-50 transition-all"
        >
          Save
        </button>
      </div>

      <div className="space-y-2">
        {profiles.length === 0 && (
          <p className="text-repo-muted text-xs text-center py-4">No profiles saved yet</p>
        )}

        {profiles.map(p => (
          <div key={p.profileName} className="flex items-center justify-between bg-repo-surface border border-repo-border rounded-lg px-3 py-2">
            <div className="min-w-0">
              <div className="text-repo-text text-sm font-medium truncate">{p.profileName}</div>
              <div className="text-repo-muted text-xs">{p.modCount} mods</div>
            </div>

            <div className="flex items-center gap-2 ml-2">
              {activeProfile === p.profileName && (
                <span className="text-xs bg-repo-green/10 text-repo-green border border-repo-green/20 px-2 py-1 rounded-md">
                  Active
                </span>
              )}
              <button
                onClick={() => handleApply(p)}
                disabled={loading || activeProfile === p.profileName}
                className="text-xs px-3 py-1.5 bg-repo-accent text-white rounded-md hover:bg-repo-accent-hover disabled:opacity-50 transition-all"
              >
                Apply
              </button>
              <button
                onClick={() => handleDelete(p)}
                disabled={loading}
                className="text-xs px-3 py-1.5 border border-repo-border text-repo-muted rounded-md hover:border-repo-red/40 hover:text-repo-red transition-all disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
