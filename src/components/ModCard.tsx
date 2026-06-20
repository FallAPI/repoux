
import type { ThunderstoreMod } from '../types'
import { ModIcon } from './ModIcon'
import { ArrowDown } from 'lucide-react'

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ''
  const mb = bytes / 1024 / 1024
  return `${mb.toFixed(1)} MB`
}
interface ModCardProps {
  mod: ThunderstoreMod
  installed: boolean
  isInstalling: boolean
  updateAvailable?: boolean
  onInstall: (mod: ThunderstoreMod) => void
  disabled?: boolean
}

export function ModCard({ mod, installed, isInstalling, updateAvailable, onInstall, disabled }: ModCardProps) {
  const latest = mod.versions[0]

  return (
    <div
      className="glass-card rounded-xl p-4 flex gap-4 transition-all duration-200
        hover:border-repo-accent/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.08)]"
    >
      <ModIcon src={latest?.icon} alt={mod.name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-repo-text font-semibold text-sm">{mod.name}</div>
            <div className="text-repo-muted text-xs">by {mod.owner}</div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-repo-muted text-xs font-mono">★ {mod.rating_score}</span>
            <span className="text-repo-muted text-xs font-mono">↓ {(latest?.downloads ?? 0).toLocaleString()}</span>

          </div>
        </div>
        <p className="text-repo-subtext text-xs mt-1.5 line-clamp-2">{latest?.description}</p>
        <div className="flex flex-row items-center justify-between mt-3">
          <div className='flex flex-row gap-3'>
            <span className="text-repo-muted text-xs font-mono">v{latest?.version_number}</span>
            <div className='flex flex-row justify-center items-center'>
              <ArrowDown className='w-2.5 h-2.5 text-repo-muted' />
              <span className='text-repo-muted text-xs font-mono'>{formatFileSize(latest?.file_size)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {updateAvailable && (
              <span className="text-xs text-repo-yellow font-semibold px-2.5 py-0.5 bg-repo-yellow/10 border border-repo-yellow/20 rounded-lg">
                ↓ Update
              </span>
            )}
            {installed ? (
              <span className="text-xs text-repo-green font-semibold px-3 py-1 bg-repo-green/10 border border-repo-green/20 rounded-lg">
                ✓ Installed
              </span>
            ) : (
              <button
                onClick={() => onInstall(mod)}
                disabled={disabled || !!isInstalling}
                className={`text-xs font-semibold px-3 py-1 rounded-lg transition-all
                  ${isInstalling
                    ? 'bg-repo-accent/50 text-white cursor-wait'
                    : disabled
                      ? 'bg-repo-border text-repo-muted cursor-not-allowed'
                      : 'bg-repo-accent hover:bg-repo-accent-hover text-white'
                  }`}
              >
                {isInstalling ? 'Installing...' : disabled ? 'Busy' : 'Install'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
