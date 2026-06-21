const THUNDERSTORE_BASE = process.env.THUNDERSTORE_API_URL || 'https://thunderstore.io/c/repo/api/v1';
const APP_USER_AGENT = process.env.APP_USER_AGENT || 'REPX/1.0';

export interface ThunderstoreVersion {
  name: string;
  full_name: string;
  description: string;
  icon: string;
  version_number: string;
  dependencies: string[];
  download_url: string;
  downloads: number;
  date_created: string;
  website_url: string;
  is_active: boolean;
  file_size: number;
}

export interface ThunderstoreMod {
  name: string;
  full_name: string;
  owner: string;
  package_url: string;
  date_created: string;
  date_updated: string;
  rating_score: number;
  file_size: string;
  is_pinned: boolean;
  is_deprecated: boolean;
  has_nsfw_content: boolean;
  categories: string[];
  versions: ThunderstoreVersion[];
}

let cachedMods: ThunderstoreMod[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; 


export async function fetchAllMods(): Promise<ThunderstoreMod[]> {
  const now = Date.now();
  if (cachedMods && now - cacheTime < CACHE_TTL) {
    return cachedMods;
  }

  const { default: got } = await import('got');

  const data = await got(`${THUNDERSTORE_BASE}/package/`, {
    headers: { 'User-Agent': 'REPO-Mod-Manager/1.0' },
    timeout: { request: 15000 },
  }).json<ThunderstoreMod[]>();

  cachedMods = data.filter((m) => !m.is_deprecated);
  cacheTime = now;
  return cachedMods;
}


export async function searchMods(query: string): Promise<ThunderstoreMod[]> {
  const mods = await fetchAllMods();
  if (!query.trim()) return mods;

  const q = query.toLowerCase();
  return mods.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.owner.toLowerCase().includes(q) ||
      m.versions[0]?.description.toLowerCase().includes(q),
  );
}


export function getLatestVersion(mod: ThunderstoreMod): ThunderstoreVersion {
  return mod.versions[0];
}


export function getDownloadUrl(mod: ThunderstoreMod, version?: string): string {
  if (!version) return getLatestVersion(mod).download_url;
  const v = mod.versions.find((v) => v.version_number === version);
  return v ? v.download_url : getLatestVersion(mod).download_url;
}
