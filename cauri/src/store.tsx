import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchVaultBin, findAccount, normalizeLogin, publishRecord, releaseAccount, saveVaultBin, type CloudLink } from './domain/cloud'
import { browserStore, readLinks, readRecords, upsertRecord, writeLinks, writeRecords } from './domain/storage'
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

export type OpenResult = 'opened' | 'unknown' | 'denied'

interface VaultApi {
  ready: boolean
  spaces: Array<{ id: string; displayName: string }>
  session: Session | null
  storageError: string | null
  persistError: string | null
  createSpace: (name: string, password: string) => Promise<string>
  openAccount: (name: string, secret: string) => Promise<OpenResult>
  lock: () => void
  commit: (recipe: (space: Space) => Space) => void
  changePassword: (current: string, next: string) => Promise<boolean>
  rotateRecovery: (password: string) => Promise<string | null>
  relink: (loginName: string) => Promise<void>
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
  const linksRef = useRef<Record<string, CloudLink>>({})
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

  const rememberLink = useCallback((spaceId: string, link: CloudLink) => {
    linksRef.current = { ...linksRef.current, [spaceId]: link }
    try {
      writeLinks(browserStore(), linksRef.current)
    } catch {
      /* La copie locale est facultative : le compte reste joignable par son nom. */
    }
  }, [])

  const forgetLink = useCallback((spaceId: string) => {
    if (!linksRef.current[spaceId]) return
    const next = { ...linksRef.current }
    delete next[spaceId]
    linksRef.current = next
    try {
      writeLinks(browserStore(), next)
    } catch {
      /* Même sans copie locale, le compte distant n’est pas effacé. */
    }
  }, [])

  const saveRecords = useCallback((next: VaultRecord[]) => {
    if (!blockedRef.current) {
      try {
        writeRecords(browserStore(), next)
      } catch {
        /* Navigation privée : la session tient, le compte distant aussi. */
      }
    }
    remember(next)
  }, [remember])

  const pushRemote = useCallback(async (record: VaultRecord, space: Space) => {
    const link = linksRef.current[record.id]
    if (link) {
      await saveVaultBin(link.binId, record)
      return
    }
    const published = await publishRecord(record, space.loginName || space.displayName)
    rememberLink(record.id, published)
  }, [rememberLink])

  useEffect(() => {
    let loaded = { records: [] as VaultRecord[], broken: false }
    try {
      loaded = readRecords(browserStore())
    } catch {
      loaded = { records: [], broken: true }
    }
    recordsRef.current = loaded.records
    setRecords(loaded.records)
    blockedRef.current = loaded.broken
    linksRef.current = readLinks(browserStore())
    setStorageError(loaded.broken ? 'La mémoire de cet appareil est illisible. Rien n’a été écrasé.' : null)
    void (async () => {
      const restored = await restoreSession(loaded.records)
      if (!restored) return
      const link = linksRef.current[restored.record.id]
      let next = restored
      if (link) {
        try {
          const remote = await fetchRemoteIfNewer(link.binId, restored)
          if (remote) next = remote
        } catch {
          /* On garde la copie de cet appareil si le réseau manque. */
        }
      }
      sessionRef.current = next
      setSession(next)
      if (next.record !== restored.record) saveRecords(upsertRecord(recordsRef.current, next.record))
    })().finally(() => setReady(true))
  }, [saveRecords])

  useEffect(() => {
    const id = session?.space.id
    const dataKey = session?.dataKey
    if (!id || !dataKey) return
    void exportDataKey(dataKey).then((key) => {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, key }))
    })
  }, [session?.space.id, session?.dataKey])

  const persist = useCallback(() => {
    void enqueue(async () => {
      const current = sessionRef.current
      if (!current) return
      const space = current.space.loginName
        ? current.space
        : { ...current.space, loginName: normalizeLogin(current.space.displayName) }
      const sealed = await sealPayload(current.record, current.dataKey, space)
      const latest = sessionRef.current
      if (!latest || (latest.space !== current.space && latest.space !== space)) {
        persist()
        return
      }
      const next = { ...latest, space, record: sealed }
      sessionRef.current = next
      setSession(next)
      saveRecords(upsertRecord(recordsRef.current, sealed))
      try {
        await pushRemote(sealed, space)
        setPersistError(null)
      } catch (error) {
        setPersistError(error instanceof Error ? error.message : 'L’enregistrement n’a pas atteint les autres appareils.')
      }
    }).catch(() => {
      setPersistError('La sauvegarde a échoué.')
    })
  }, [enqueue, pushRemote, saveRecords])

  useEffect(() => {
    const current = sessionRef.current
    if (!current) return
    if (linksRef.current[current.space.id]) return
    persist()
  }, [session?.space.id, persist])

  const adopt = useCallback((space: Space, dataKey: CryptoKey, record: VaultRecord) => {
    const next = { space, dataKey, record }
    sessionRef.current = next
    setSession(next)
    saveRecords(upsertRecord(recordsRef.current, record))
  }, [saveRecords])

  const createSpace = useCallback(async (name: string, password: string) => {
    const created = await createRecord(name, password)
    const space = { ...created.space, loginName: normalizeLogin(name) }
    const record = await sealPayload(created.record, created.dataKey, space)
    const link = await publishRecord(record, name)
    rememberLink(record.id, link)
    adopt(space, created.dataKey, record)
    setPersistError(null)
    return created.recoveryCode
  }, [adopt, rememberLink])

  const openAccount = useCallback(async (name: string, secret: string): Promise<OpenResult> => {
    const normalized = normalizeLogin(name)
    if (normalized.length < 2) throw new Error('Le nom du compte est trop court.')
    const found = await findAccount(name)
    if (found) {
      const local = recordsRef.current.find((item) => item.id === found.record.id)
      const preferLocal = Boolean(local && local.updatedAt > found.record.updatedAt)
      const first = preferLocal && local ? local : found.record
      const second = first === found.record ? null : found.record
      let opened = await unlockRecord(first, secret)
      let record = first
      if (!opened && second) {
        opened = await unlockRecord(second, secret)
        record = second
      }
      if (!opened) return 'denied'
      rememberLink(record.id, { loginKey: found.loginKey, binId: found.binId, loginName: normalized })
      const space = opened.space.loginName === normalized ? opened.space : { ...opened.space, loginName: normalized }
      adopt(space, opened.dataKey, record)
      if (space !== opened.space || record !== found.record) persist()
      return 'opened'
    }
    const locals = recordsRef.current.filter((item) =>
      normalizeLogin(item.displayName) === normalized || linksRef.current[item.id]?.loginName === normalized,
    )
    for (const candidate of locals) {
      const opened = await unlockRecord(candidate, secret)
      if (!opened) continue
      adopt({ ...opened.space, loginName: normalized }, opened.dataKey, candidate)
      return 'opened'
    }
    return locals.length > 0 ? 'denied' : 'unknown'
  }, [adopt, persist, rememberLink])

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
    try {
      await pushRemote(record, current.space)
      setPersistError(null)
    } catch (error) {
      setPersistError(error instanceof Error ? error.message : 'Le mot de passe a changé ici. Les autres appareils ne l’ont pas encore.')
    }
    return true
  }), [enqueue, pushRemote, saveRecords])

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
    try {
      await pushRemote(rotated.record, current.space)
      setPersistError(null)
    } catch (error) {
      setPersistError(error instanceof Error ? error.message : 'Le nouveau code est prêt ici. Les autres appareils ne l’ont pas encore.')
    }
    return rotated.recoveryCode
  }), [enqueue, pushRemote, saveRecords])

  const relink = useCallback((loginName: string) => enqueue(async () => {
    const current = sessionRef.current
    if (!current) throw new Error('Ouvre d’abord le coffre.')
    const name = normalizeLogin(loginName)
    if (name.length < 2) throw new Error('Le nom du compte est trop court.')
    const previous = linksRef.current[current.record.id]
    const space = { ...current.space, loginName: name }
    const sealed = await sealPayload(current.record, current.dataKey, space)
    if (previous?.loginName === name) {
      await saveVaultBin(previous.binId, sealed)
      adopt(space, current.dataKey, sealed)
      setPersistError(null)
      return
    }
    forgetLink(current.record.id)
    try {
      const published = await publishRecord(sealed, name)
      rememberLink(current.record.id, published)
      adopt(space, current.dataKey, sealed)
      if (previous && previous.loginKey !== published.loginKey) {
        try {
          await releaseAccount(previous.loginKey)
        } catch {
          setPersistError('Le nouveau nom fonctionne. L’ancien nom répond encore pour l’instant.')
          return
        }
      }
      setPersistError(null)
    } catch (error) {
      if (previous) rememberLink(current.record.id, previous)
      throw error
    }
  }), [adopt, enqueue, forgetLink, rememberLink])

  const removeSpace = useCallback((id: string) => {
    saveRecords(recordsRef.current.filter((item) => item.id !== id))
    forgetLink(id)
    if (sessionRef.current?.space.id === id) {
      sessionRef.current = null
      setSession(null)
      sessionStorage.removeItem(SESSION_KEY)
    }
  }, [forgetLink, saveRecords])

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
    openAccount,
    lock,
    commit,
    changePassword,
    rotateRecovery,
    relink,
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
    openAccount,
    lock,
    commit,
    changePassword,
    rotateRecovery,
    relink,
    removeSpace,
    importRecord,
    exportRecord,
  ])

  return <VaultContext.Provider value={api}>{children}</VaultContext.Provider>
}

async function fetchRemoteIfNewer(binId: string, local: Session): Promise<Session | null> {
  const remote = await fetchVaultBin(binId)
  if (remote.updatedAt <= local.record.updatedAt) return null
  const opened = await openWithKey(remote, local.dataKey)
  if (!opened) return null
  return { space: opened.space, dataKey: local.dataKey, record: remote }
}

export function useVault(): VaultApi {
  const value = useContext(VaultContext)
  if (!value) throw new Error('Coffre absent')
  return value
}
