import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { browserStore, readRecords, upsertRecord, writeRecords } from './domain/storage'
import type { Space } from './domain/types'
import {
  createRecord,
  exportDataKey,
  importDataKey,
  isVaultRecord,
  openWithKey,
  rewrapPassword,
  rewrapRecovery,
  sealPayload,
  unlockRecord,
  type VaultRecord,
} from './domain/vault'

const SESSION_KEY = 'cauri.session.v1'

interface Session {
  space: Space
  dataKey: CryptoKey
  record: VaultRecord
}

interface VaultApi {
  ready: boolean
  spaces: Array<{ id: string; displayName: string }>
  session: Session | null
  storageError: string | null
  persistError: string | null
  createSpace: (name: string, password: string) => Promise<string>
  unlock: (id: string, secret: string) => Promise<boolean>
  lock: () => void
  commit: (recipe: (space: Space) => Space) => void
  changePassword: (current: string, next: string) => Promise<boolean>
  rotateRecovery: (password: string) => Promise<string | null>
  removeSpace: (id: string) => void
  importRecord: (record: VaultRecord) => string | null
  exportRecord: () => Promise<VaultRecord | null>
}

const VaultContext = createContext<VaultApi | null>(null)

async function restoreSession(records: VaultRecord[]): Promise<Session | null> {
  const saved = sessionStorage.getItem(SESSION_KEY)
  if (!saved) return null
  try {
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object') return null
    const { id, key } = parsed as { id?: string; key?: string }
    if (!id || !key) return null
    const record = records.find((item) => item.id === id)
    if (!record) return null
    const opened = await openWithKey(record, await importDataKey(key))
    return opened ? { space: opened.space, dataKey: opened.dataKey, record: opened.record } : null
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [records, setRecords] = useState<VaultRecord[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [persistError, setPersistError] = useState<string | null>(null)
  const sessionRef = useRef<Session | null>(null)
  const recordsRef = useRef<VaultRecord[]>([])
  const blockedRef = useRef(false)
  const chain = useRef(Promise.resolve())

  const remember = useCallback((next: VaultRecord[]) => {
    recordsRef.current = next
    setRecords(next)
  }, [])

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = chain.current.then(task)
    chain.current = run.then(() => undefined, () => undefined)
    return run
  }, [])

  useEffect(() => {
    const loaded = readRecords(browserStore())
    recordsRef.current = loaded.records
    setRecords(loaded.records)
    blockedRef.current = loaded.broken
    setStorageError(loaded.broken ? 'La mémoire de cet appareil est illisible. Rien n’a été écrasé.' : null)
    void restoreSession(loaded.records).then((restored) => {
      if (!restored) return
      sessionRef.current = restored
      setSession(restored)
    }).finally(() => setReady(true))
  }, [])

  useEffect(() => {
    const id = session?.space.id
    const dataKey = session?.dataKey
    if (!id || !dataKey) return
    void exportDataKey(dataKey).then((key) => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, key }))
    })
  }, [session?.space.id, session?.dataKey])

  const saveRecords = useCallback((next: VaultRecord[]) => {
    writeRecords(browserStore(), next)
    remember(next)
  }, [remember])

  const persist = useCallback(() => {
    void enqueue(async () => {
      const current = sessionRef.current
      if (!current || blockedRef.current) return
      const sealed = await sealPayload(current.record, current.dataKey, current.space)
      const latest = sessionRef.current
      if (!latest || latest.space !== current.space) {
        persist()
        return
      }
      const next = { ...latest, record: sealed }
      sessionRef.current = next
      setSession(next)
      saveRecords(upsertRecord(recordsRef.current, sealed))
      setPersistError(null)
    }).catch(() => {
      setPersistError('La sauvegarde sur cet appareil a échoué.')
    })
  }, [enqueue, saveRecords])

  const createSpace = useCallback(async (name: string, password: string) => {
    if (blockedRef.current) throw new Error('mémoire illisible')
    const created = await createRecord(name, password)
    const next = { space: created.space, dataKey: created.dataKey, record: created.record }
    sessionRef.current = next
    setSession(next)
    saveRecords(upsertRecord(recordsRef.current, created.record))
    return created.recoveryCode
  }, [saveRecords])

  const unlock = useCallback(async (id: string, secret: string) => {
    const record = recordsRef.current.find((item) => item.id === id)
    if (!record) return false
    const opened = await unlockRecord(record, secret)
    if (!opened) return false
    const next = { space: opened.space, dataKey: opened.dataKey, record: opened.record }
    sessionRef.current = next
    setSession(next)
    return true
  }, [])

  const lock = useCallback(() => {
    sessionRef.current = null
    setSession(null)
    sessionStorage.removeItem(SESSION_KEY)
  }, [])

  const commit = useCallback((recipe: (space: Space) => Space) => {
    const current = sessionRef.current
    if (!current) return
    const next = { ...current, space: recipe(current.space) }
    sessionRef.current = next
    setSession(next)
    persist()
  }, [persist])

  const changePassword = useCallback((currentPassword: string, nextPassword: string) => enqueue(async () => {
    const current = sessionRef.current
    if (!current) return false
    const check = await unlockRecord(current.record, currentPassword)
    if (!check) return false
    const record = await rewrapPassword(current.record, current.dataKey, nextPassword)
    const next = { ...current, record }
    sessionRef.current = next
    setSession(next)
    saveRecords(upsertRecord(recordsRef.current, record))
    return true
  }), [enqueue, saveRecords])

  const rotateRecovery = useCallback((password: string) => enqueue(async () => {
    const current = sessionRef.current
    if (!current) return null
    const check = await unlockRecord(current.record, password)
    if (!check) return null
    const rotated = await rewrapRecovery(current.record, current.dataKey)
    const next = { ...current, record: rotated.record }
    sessionRef.current = next
    setSession(next)
    saveRecords(upsertRecord(recordsRef.current, rotated.record))
    return rotated.recoveryCode
  }), [enqueue, saveRecords])

  const removeSpace = useCallback((id: string) => {
    saveRecords(recordsRef.current.filter((item) => item.id !== id))
    if (sessionRef.current?.space.id === id) {
      sessionRef.current = null
      setSession(null)
    }
  }, [saveRecords])

  const importRecord = useCallback((record: VaultRecord) => {
    if (!isVaultRecord(record)) return 'Ce fichier n’est pas une sauvegarde Cauri.'
    if (recordsRef.current.some((item) => item.id === record.id)) return 'Cet espace est déjà sur cet appareil.'
    saveRecords(upsertRecord(recordsRef.current, record))
    return null
  }, [saveRecords])

  const exportRecord = useCallback(async () => {
    const current = sessionRef.current
    if (!current) return null
    return sealPayload(current.record, current.dataKey, current.space)
  }, [])

  const api = useMemo<VaultApi>(() => ({
    ready,
    spaces: records.map((item) => ({ id: item.id, displayName: item.displayName })),
    session,
    storageError,
    persistError,
    createSpace,
    unlock,
    lock,
    commit,
    changePassword,
    rotateRecovery,
    removeSpace,
    importRecord,
    exportRecord,
  }), [
    ready,
    records,
    session,
    storageError,
    persistError,
    createSpace,
    unlock,
    lock,
    commit,
    changePassword,
    rotateRecovery,
    removeSpace,
    importRecord,
    exportRecord,
  ])

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
}

export function useVault(): VaultApi {
  const value = useContext(VaultContext)
  if (!value) throw new Error('Coffre absent')
  return value
}
