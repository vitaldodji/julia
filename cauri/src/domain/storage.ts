import type { CloudLink } from './cloud'
import { isVaultRecord, type VaultRecord } from './vault'

export const STORAGE_KEY = 'cauri.vaults.v1'
export const LINKS_KEY = 'cauri.links.v1'

export interface KeyValueStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function browserStore(): KeyValueStore {
  return localStorage
}

export function readRecords(store: KeyValueStore): { records: VaultRecord[]; broken: boolean } {
  const raw = store.getItem(STORAGE_KEY)
  if (!raw) return { records: [], broken: false }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isVaultRecord)) return { records: [], broken: true }
    return { records: parsed, broken: false }
  } catch {
    return { records: [], broken: true }
  }
}

export function writeRecords(store: KeyValueStore, records: VaultRecord[]): void {
  store.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function upsertRecord(records: VaultRecord[], record: VaultRecord): VaultRecord[] {
  const index = records.findIndex((item) => item.id === record.id)
  if (index === -1) return [...records, record]
  return records.map((item) => (item.id === record.id ? record : item))
}

export function readLinks(store: KeyValueStore): Record<string, CloudLink> {
  try {
    const raw = store.getItem(LINKS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const links: Record<string, CloudLink> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object') continue
      const link = value as Partial<CloudLink>
      if (typeof link.loginKey === 'string' && typeof link.binId === 'string' && typeof link.loginName === 'string') {
        links[id] = { loginKey: link.loginKey, binId: link.binId, loginName: link.loginName }
      }
    }
    return links
  } catch {
    return {}
  }
}

export function writeLinks(store: KeyValueStore, links: Record<string, CloudLink>): void {
  store.setItem(LINKS_KEY, JSON.stringify(links))
}
