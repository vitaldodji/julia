import { isVaultRecord, type VaultRecord } from './vault'

export const STORAGE_KEY = 'cauri.vaults.v1'

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
