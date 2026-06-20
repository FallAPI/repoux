# REPX (STB)

> Mod Manager for R.E.P.O game — install, manage, and launch mods with ease.

## Features

- Auto-detect game path via Steam registry
- One-click install mods from Thunderstore
- Install from local ZIP
- Enable/disable mods with toggle
- Uninstall mods (removes files + registry)
- BepInEx installer integration
- Progress tracking with percentage
- Cancel ongoing downloads
- Crash-safe data storageWS

## Download

Download the latest Windows executable from the [Releases](https://github.com/YOUR_USERNAME/repoux/releases) page.

## Building from source

### Prerequisites

- Node.js 18+
- npm 9+
- Windows (for building Windows executable)

### Setup

```bash
git clone https://github.com/FallAPI/repoux.git
cd repoux
npm install
```

### Development

```bash
npm run dev
```

### Build Windows executable

```bash
npm run build:win
```

Output will be in `release/` folder.

## Tech Stack

- Electron
- React
- TypeScript
- Zustand (state management)
- Tailwind CSS
- electron-vite
- adm-zip
- got

## Configuration

Copy `.env.example` to `.env` and adjust values if needed.

| Variable               | Default                                 | Description                 |
| ---------------------- | --------------------------------------- | --------------------------- |
| `THUNDERSTORE_API_URL` | `https://thunderstore.io/c/repo/api/v1` | Thunderstore API base URL   |
| `APP_USER_AGENT`       | `REPX/1.0`                              | User agent for API requests |
| `GAME_PATH`            | _(auto-detect)_                         | Override REPO game path     |
| `USER_DATA_PATH`       | _(platform default)_                    | Override app data folder    |

## Project Structure

```
electron/
  main.ts              # Main process entry
  preload.ts           # Preload script (IPC bridge)
  modules/
    settings.ts        # App settings (atomic read/write)
    modRegistry.ts     # Mods database (atomic read/write)
    modInstaller.ts    # Install/uninstall/toggle logic
    gameDetector.ts    # Steam registry + game path detection
    bepinex.ts         # BepInEx install/check
    launcher.ts        # Game launch
    atomicFs.ts        # Atomic file I/O helper
src/
  App.tsx              # Root component + startup init
  store/
    useAppStore.ts     # Zustand store
  pages/
    Home.tsx
    Browse.tsx
    Installed.tsx
    Settings.tsx
  components/
    ModCard.tsx
    ModIcon.tsx
    ...
```

## License

MIT
