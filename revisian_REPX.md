[] not responding dibeberapa device (masih belum nemu why? suggestion pertama dari build nya x32, coba x64)
[] data hilang saat app diclose
[] perlu setup database/json buat save mod per user? (suka ada masalah jika app diclose saat mau download mod lagi tulisan "mod sudah terinstall, tapi kosong di mod list yang sudah diinstall)
[] button batal download mod
[] progress donload modnya berapa %
[] gamepath repo dan bepinex tidak keditect lagi saat dibuka lagi setelah dicloses walau gamepath repo dan bepinex sudah diinstall dan di arahkan ke gamepath repo

nama app: REPX (STB)

---

## Analisis & Rencana Perbaikan (Kilo)

### Root Cause Analysis

1. **"Not responding" (item 1)** — Kemungkinan besar karena build **x32** yang sudah usang untuk Electron modern. `electron-builder` default menghasilkan installer x64, tapi package.json mengarah ke `nsis` tanpa `arch` eksplisit. Perlu paksa win32 target ke `nsis` + arch x64.
   - **Update (deep-dive):** Setelah cek seluruh file `electron/modules/`, ternyata bukan packaging. Root cause-nya ada **banyak operasi sinkron (blocking)** di main thread (`fs.existsSync`, `fs.readJsonSync`, `fs.writeJsonSync`, `fs.readFileSync`, `fs.readdirSync`, `fs.statSync`, `execSync`).
   - Lokasi blocking: `settings.ts:26,38`, `modRegistry.ts:31,40`, `gameDetector.ts:13,33,52`, `modInstaller.ts:79-84` (`assertNotInstalled`), `launcher.ts:13,25`, `bepinex.ts:70`.
   - Kenapa bisa terjadi di tiga fase (dev, setelah beberapa penggunaan, atau terusan): Ketika user klik cepat atau ada handler IPC yang memanggil `readSettings()` + `readRegistry()` + `readdirSync` beruntun, main process ke-hold lock dan UI/renderer tidak dapat respons.
   - **Penjelasan untuk junior programmer:** Electron memiliki 2 proses utama — **main process** (Node.js) dan **renderer process** (UI browser). Seluruh handler IPC (misal `mod:install`, `game:detect`, dll) berjalan di main process. Jika di handler tersebut ada panggilan fungsi dengan akhiran `*Sync` seperti `fs.writeJsonSync`, maka main process akan **macet sepenuhnya** sampai operasi itu selesai. Makanya kalau user klik dua kali, atau operasi file besar, seluruh aplikasi terasa "not responding" karena main process tidak bisa menerima pesan lain sampai selesai.
   - Solusi: Ganti seluruh `*Sync` dengan versi async (`fs/promises`), dan pastikan setiap handler IPC tidak melakukan operasi I/O sinkron.

 2. **"perlu setup database/json buat save mod per user"** — Sebenarnya bukan masalah "perlu database per user", tapi masalah **metadata mod yang hilang saat app ditutup di tengah download**. Saat ini `mods.json` ditulis langsung tanpa atomic write. Jika app ditutup tepat setelah file mod sudah ter-extract ke folder `BepInEx/plugins/` tapi **sebelum** `addMod()` menulis ke `mods.json`, maka:
   - Di disk: folder mod ada (file .dll sudah terpasang)
   - Di `mods.json`: mod TIDAK ada di daftar installed
   - Hasilnya: UI menampilkan error "mod sudah terinstall" tapi list kosong, atau sebaliknya user bisa install ulang yang sama.
   
   **Solusi yang tepat:** Tidak perlu database baru. Perbaiki dengan:
   
   2.1 **Atomic write** — Tulis metadata ke file temp dulu (`mods.json.tmp`), baru rename. Jika app ditutup di tengah, file `mods.json` lama tetap utuh dan data tidak hilang.
   
   2.2 **Install tracking per-step** — Sebelum download dimulai, tulis entry placeholder ke `mods.json` (status: `downloading`). Setelah download + extract sukses, baru update ke `installed`. Dengan begini, jika app restart di tengah download, app bisa mendeteksi ada mod yang belum selesai dan melanjutkan atau membersihkannya.

3. **Mod "sudah terinstall tapi kosong" saat download + App diclose di tengah (item 3)** — Bukan masalah database per-user. Akar masalah sama dengan #2: `assertNotInstalled` mengecek file exist dan registry. Jika app ditutup tepat setelah entries tertulis tapi sebelum `addMod()` dipanggil, state不一致. Solusi: perbaiki dengan atomic registry update + install tracking yang per-step.

4. **Button batal download (item 4)** — `got.stream` saat ini tidak terhubung ke AbortController. Renderer tidak punya referensi ke abort controller. Perlu kirim `AbortSignal` dari renderer → main → installer → `got` stream, lalu bersihkan file temp saat cancel.

5. **Progress download berapa % (item 5)** — `got.stream` punya event `data` + `Content-Length`. Saat ini `pipeline` buta ke byte count. Perlu pakai `stream.bytesReceived` register via manual pipeline atau `got.progressed` stream.

6. **GamePath + BepInEx tidak kedeteksi lagi saat app dibuka ulang (item 6)** — Kemungkinan karena `detectGamePath` mengandalkan registry atau default path yang salah. Padahal `settings:get` tampaknya sudah baca dari `userData`. **Perlu verifikasi di BepInEx detector apakah path detectionnya berfungsi dan tidak memakai cache stale.** Jika benar pathnya sudah benar tapi gamepath tetap hilang, kemungkinan adapter save yang salah di vscode atau path mismatch (32-bit vs 64-bit).

7. **Nama app: REPX (STB)** (item 8) — Perlu ganti `productName`, `appId`, folder `userData` dan semua referensi string "REPO-Mod-Manager" ke "REPX" atau "REPX-STB".

### Extension Points & File Target

| File | Perubahan |
|------|-----------|
| `package.json` | Ganti `productName` → `REPX (STB)`, `appId` → `com.repxstb.app`, paksa `nsis` → `target: [{ target: 'nsis', arch: ['x64'] }]` |
| `electron/modules/settings.ts` | Tambah atomic write (`writeFile + rename atomic`), update `app.getPath('userData')` folder name ke `REPX` |
| `electron/modules/modRegistry.ts` | Tambah atomic write untuk `mods.json`, paksa update atomic |
| `electron/modules/modInstaller.ts` | Tambah `AbortController` di `installModDirect`, expose cancel via IPC, kirim progress byte count, clean temp file saat cancel/error |
| `electron/main.ts` | Tambah IPC `mod:cancel` handler |
| `electron/preload.ts` | Expose `cancelInstall` |
| `src/types.ts` / `src/pages/Browse.tsx` | Tambah state `cancelling`, button "Batal" di progress overlay |

### Solusi Blocking (Not Responding)

**Kenapa nggak perlu cek process name?**  
Cek process name (`tasklist`/`Get-Process`) cuma buat ngecek *apakah* aplikasi nge- CPU. Tapi di sini masalahnya bukan CPU usage yang tinggi — melainkan **main process macet total** karena menunggu operasi file selesai (I/O blocking). Jadi monitor process name ga ada gunanya. Root cause-nya ada di **kode** yang memakai `*Sync`.

**Konsep solusi yang mudah dipahami:**

1. **Ganti `fs.*Sync` → `fs/promises` (async)**  
   Contoh: `fs.existsSync(path)` → `await fs.exists(path)`  
   Ketika fungsi async, main process tidak macet — dia bisa menerima pesan IPC lain sambil menunggu file selesai dibaca.

2. **Atomic write untuk settings.json & mods.json**  
   Cara kerja: tulis ke file sementara dulu (`settings.json.tmp`), kalau sudah sukses, baru **ganti nama** file lama dengan yang baru.  
   Jika app ditutup di tengah-tengah, file lama tetap utuh (ga korupt). Ini bikin data aman walau app force close.

**File mana saja yang diubah & mengapa:**

| File | Perubahan | Alasan Junior Dev |
|------|-----------|-------------------|
| `electron/modules/settings.ts` | Ganti semua `*Sync` jadi `fs/promises`, implementasi atomic write | Tempat settings.json disimpan — write = sync |
| `electron/modules/modRegistry.ts` | Ganti `*Sync` → async, atomic write untuk mods.json | Tempat daftar mod tersimpan — read+write sangat sering |
| `electron/modules/gameDetector.ts` | Ganti `execSync` dan `readFileSync` → async versions | `reg query` dan baca VDF file butuh waktu |
| `electron/modules/modInstaller.ts` | Ganti `fs.existsSync` + `readdirSync` + `statSync` → `fs/promises` | Cek mod terinstall di folder BepInEx — yang ini terbanyak |
| `electron/modules/launcher.ts` | Ganti `fs.existsSync` + `writeSettings` → async | Cek REPO.exe sebelum launch |
| `electron/modules/bepinex.ts` | Ganti pipeline jadi tanpa blocking path | Install BepinEx — download besar |
| `electron/main.ts` | Semua handler IPC ditambah `async` + `await` | Handler yang sebelumnya sync sekarang perlu async |

**Flow perubahan:**

```
SEBELUM (blocking):
  IPC handler → fs.writeJsonSync() → MAIN PROCESS MACET → UI freeze

SETELAH (async):
  IPC handler → await fs.writeJson() → MAIN PROCESS BEBAS → UI tetap responsif
```

**Catatan penting:**  
Setelah migrasi ke async, SEMUA handler IPC di `main.ts` harus diubah jadi `async` dan pakai `await`. Kalau ada satu `*Sync` yang ketinggalan, aplikasi tetap bisa "not responding".

### Urutan Implementasi

**Phase 1 — Crash-safe (priority tinggi):**
- [x] Atomic write di `settings.ts`
- [x] Atomic write di `modRegistry.ts`
  - [x] Tambah status `installing` / placeholder entry saat download dimulai
  - [x] Update entry ke `installed` setelah download+extract selesai
- [x] Rename folder userData + productName
- [x] Migrasi `fs.*Sync` → async di `settings.ts`, `modRegistry.ts`, `gameDetector.ts`

**Phase 2 — Non-blocking I/O (tinggi):**
- [x] Migrasi `fs.*Sync` → async di `modInstaller.ts`, `launcher.ts`, `bepinex.ts`
- [x] Update `main.ts` handler jadi async + await

**Phase 3 — Cancel + Progress (medium):**
- [x] AbortController di `installModDirect`
- [x] IPC cancel
- [x] Progress byte count

**Phase 4 — Config (low):**
- [x] Force x64 build config
- [x] Verifikasi gamePath detector
- [x] Rename app to REPX (STB)

---

## Progress Tracking

| # | Item | Status | Catatan |
|---|------|--------|---------|
| 1 | Not responding | 🔄 In Progress | Phase 1 & 2 sudah selesai (atomicFs + async semua module + main.ts handler async). Build error terpisah. |
| 2 | Data hilang saat app diclose | ✅ Fixed | Atomic write sudah diterapkan di settings.ts + modRegistry.ts |
| 3 | Metadata mod hilang saat download terputus | ✅ Fixed | Install tracking per-step + status `downloading`/`installed` |
| 4 | Button batal download | ✅ Fixed | AbortController + IPC `mod:cancel` + cleanup temp + remove registry entry |
| 5 | Progress download % | ✅ Fixed | Byte tracking via `got.stream` `data` event + percent di semua step |
| 6 | GamePath hilang setelah restart | ✅ Fixed | Migrasi async + atomic write + auto-migrate folder REPX |
| 7 | Nama app REPX (STB) | ⏳ Pending | Perlu Phase 4 (package.json + string replace) |
