import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Section } from '../components/Section'
import { RotateCcw, FolderOpen, Download, Shield, Info } from 'lucide-react'

export function SettingsPage() {
  const { settings, setSettings, bepinexStatus, setBepInEx } = useAppStore()
  const [detecting, setDetecting] = useState(false)
  const [installingBep, setInstallingBep] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  function showStatus(msg: string, error = false) {
    setStatus(msg)
    setIsError(error)
    setTimeout(() => setStatus(null), 4000)
  }

  async function handleAutoDetect() {
    setDetecting(true)
    try {
      const detected = await window.electronAPI.detectGamePath()
      if (detected) {
        const updated = await window.electronAPI.getSettings()
        setSettings(updated)
        const bep = await window.electronAPI.checkBepInEx()
        setBepInEx(bep)
        showStatus(`Game found at: ${detected}`)
      } else {
        showStatus('Could not auto-detect. Try browsing manually.', true)
      }
    } finally {
      setDetecting(false)
    }
  }

  async function handleBrowse() {
    const gamePath = await window.electronAPI.browseForGamePath()
    if (gamePath) {
      const updated = await window.electronAPI.getSettings()
      setSettings(updated)
      const bep = await window.electronAPI.checkBepInEx()
      setBepInEx(bep)
      showStatus(`Game path set: ${gamePath}`)
    } else {
      showStatus('Selected folder does not contain REPO.exe', true)
    }
  }

  async function handleInstallBepInEx() {
    setInstallingBep(true)
    try {
      const updated = await window.electronAPI.installBepInEx()
      setBepInEx(updated)
      showStatus('BepInEx installed successfully!')
    } catch (e) {
      showStatus(e instanceof Error ? e.message : 'Installation failed', true)
    } finally {
      setInstallingBep(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-repo-text tracking-tight">Settings</h1>
        <p className="text-repo-muted text-sm mt-1">Manage your REPO installation and mod loader</p>
      </div>

      <div className="space-y-6">
        {/* Status message */}
        {status && (
          <div className={`text-sm px-4 py-3 rounded-xl border ${isError
            ? 'text-repo-red bg-repo-red/10 border-repo-red/30'
            : 'text-repo-green bg-repo-green/10 border-repo-green/30'
            }`}>
            {status}
          </div>
        )}

        {/* Game Path */}
        <Section title="Game Path" desc="Path to your REPO installation folder (where REPO.exe is).">
          <div className="glass-card rounded-lg px-4 py-3 font-mono text-sm text-repo-subtext mb-4 min-h-[44px] break-all">
            {settings?.gamePath ?? <span className="text-repo-muted italic">Not set</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAutoDetect}
              disabled={detecting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-repo-accent text-white text-sm font-semibold rounded-lg hover:bg-repo-accent-hover disabled:opacity-50 transition-all"
            >
              {detecting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <FolderOpen className="w-3.5 h-3.5" />
                  Auto-detect
                </>
              )}
            </button>
            <button
              onClick={handleBrowse}
              className="inline-flex items-center gap-2 px-4 py-2 glass-card text-sm font-semibold rounded-lg hover:border-repo-accent/40 transition-all"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Browse...
            </button>
          </div>
        </Section>

        {/* BepInEx */}
        <Section title="BepInEx" desc="Mod loader required for all R.E.P.O mods to work.">
          <div className="glass-card rounded-lg px-4 py-3 mb-4">
            <div className="flex items-center gap-3">
              {bepinexStatus?.installed ? (
                <Shield className="w-5 h-5 text-repo-green" />
              ) : (
                <Shield className="w-5 h-5 text-repo-yellow" />
              )}
              <div>
                <div className={`text-sm font-semibold ${bepinexStatus?.installed ? 'text-repo-green' : 'text-repo-yellow'}`}>
                  {bepinexStatus?.installed ? `Installed (${bepinexStatus.version ?? 'v5.4.23.x'})` : 'Not installed'}
                </div>
                {bepinexStatus?.pluginsPath && (
                  <div className="text-xs text-repo-muted font-mono mt-0.5">
                    {bepinexStatus.pluginsPath}
                  </div>
                )}
              </div>
            </div>
          </div>
          {!bepinexStatus?.installed && settings?.gamePath && (
            <button
              onClick={handleInstallBepInEx}
              disabled={installingBep}
              className="inline-flex items-center gap-2 px-4 py-2 bg-repo-yellow text-black text-sm font-bold rounded-lg hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {installingBep ? (
                <>
                  <Download className="w-3.5 h-3.5 animate-spin" />
                  Installing...
                </>
              ) : (
                'Install BepInEx'
              )}
            </button>
          )}
          {!settings?.gamePath && (
            <p className="text-repo-muted text-xs">Set game path first.</p>
          )}
        </Section>

        {/* About */}
        <Section title="About" desc="">
          <div className="glass-card rounded-lg px-4 py-3 text-xs text-repo-muted space-y-1 font-mono">
            <div>REPO Mod Manager v1.0.0</div>
            <div>Mods sourced from Thunderstore.io</div>
            <div>BepInEx 5.4.23.x (Mono/Unity)</div>
          </div>
        </Section>
      </div>
    </div>
  )
}
