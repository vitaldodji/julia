import { isVaultRecord, type VaultRecord } from './vault'

const API = 'https://api.telegra.ph'
const TOKEN = '0fcc32d97c77b2e41682f122ef0883e97c16f1a7a35a8e10591e9cd2fb1a'
const DIRECTORY_PATH = 'Annuaire-11-01'

export interface CloudLink {
  loginKey: string
  binId: string
  loginName: string
}

export interface Directory {
  v: 1
  accounts: Record<string, string>
}

interface TelegraphPage {
  path?: string
  content?: TelegraphNode[]
}

interface TelegraphNode {
  children?: Array<string | TelegraphNode>
}

interface TelegraphResponse {
  ok?: boolean
  error?: string
  result?: TelegraphPage
}

export function normalizeLogin(name: string): string {
  return name.trim().normalize('NFC').toLowerCase().replace(/\s+/g, ' ')
}

export async function loginKey(name: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeLogin(name)))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function fetchDirectory(): Promise<Directory> {
  const data = await readJsonPage(DIRECTORY_PATH)
  if (!data || typeof data !== 'object') throw new Error('Le compte n’a pas pu être retrouvé. Réessaie.')
  const directory = data as Partial<Directory>
  const accounts = directory.accounts && typeof directory.accounts === 'object' ? directory.accounts : {}
  return { v: 1, accounts: Object.fromEntries(Object.entries(accounts).filter((entry) => typeof entry[1] === 'string')) }
}

export async function registerAccount(key: string, binId: string): Promise<void> {
  await mutateDirectory((accounts) => ({ ...accounts, [key]: binId }))
}

export async function releaseAccount(key: string): Promise<void> {
  await mutateDirectory((accounts) => {
    const next = { ...accounts }
    delete next[key]
    return next
  })
}

export async function findAccount(loginName: string): Promise<{ loginKey: string; binId: string; record: VaultRecord } | null> {
  const name = normalizeLogin(loginName)
  if (name.length < 2) throw new Error('Le nom du compte est trop court.')
  const key = await loginKey(name)
  const directory = await fetchDirectory()
  const binId = directory.accounts[key]
  if (!binId) return null
  return { loginKey: key, binId, record: await fetchVaultBin(binId) }
}

export async function createVaultBin(record: VaultRecord): Promise<string> {
  return writePage(null, record, 'Cahier')
}

export async function fetchVaultBin(id: string): Promise<VaultRecord> {
  const data = await readJsonPage(id)
  if (!isVaultRecord(data)) throw new Error('Ce compte est illisible.')
  return data
}

export async function saveVaultBin(id: string, record: VaultRecord): Promise<void> {
  const path = await writePage(id, record, 'Cahier')
  if (path !== id) throw new Error('L’enregistrement n’a pas atteint les autres appareils. Réessaie.')
}

export async function publishRecord(record: VaultRecord, loginName: string): Promise<CloudLink> {
  const name = normalizeLogin(loginName)
  if (name.length < 2) throw new Error('Le nom du compte est trop court.')
  const key = await loginKey(name)
  const directory = await fetchDirectory()
  const existing = directory.accounts[key]
  if (existing) {
    const remote = await fetchVaultBin(existing)
    if (remote.id !== record.id) throw new Error('Ce nom de compte existe déjà. Ouvre-le avec son mot de passe, ou choisis un autre nom.')
    await saveVaultBin(existing, record)
    return { loginKey: key, binId: existing, loginName: name }
  }
  const binId = await createVaultBin(record)
  await registerAccount(key, binId)
  const again = await fetchDirectory()
  if (again.accounts[key] !== binId) throw new Error('Ce nom de compte vient d’être pris. Choisis-en un autre.')
  return { loginKey: key, binId, loginName: name }
}

async function mutateDirectory(change: (accounts: Record<string, string>) => Record<string, string>): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const directory = await fetchDirectory()
    const accounts = change(directory.accounts)
    await writePage(DIRECTORY_PATH, { v: 1, accounts }, 'Annuaire')
    const again = await fetchDirectory()
    if (sameAccounts(again.accounts, accounts)) return
  }
  throw new Error('Le compte n’a pas pu être inscrit. Réessaie.')
}

function sameAccounts(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key])
}

async function readJsonPage(path: string): Promise<unknown> {
  const payload = await request<TelegraphResponse>(`${API}/getPage/${encodeURIComponent(path)}?return_content=true&t=${Date.now()}`)
  const text = pageText(payload.result?.content)
  if (!text) throw new Error('Ce compte est illisible.')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('Ce compte est illisible.')
  }
}

async function writePage(path: string | null, data: unknown, title: string): Promise<string> {
  const form = new URLSearchParams({
    access_token: TOKEN,
    title,
    content: JSON.stringify([{ tag: 'p', children: [JSON.stringify(data)] }]),
    return_content: 'false',
  })
  const url = path ? `${API}/editPage/${encodeURIComponent(path)}` : `${API}/createPage`
  const payload = await request<TelegraphResponse>(url, { method: 'POST', body: form })
  if (!payload.ok) {
    if (payload.error === 'CONTENT_TOO_BIG') throw new Error('Le cahier est trop lourd pour être envoyé aux autres appareils.')
    throw new Error('Le compte n’a pas pu être joint. Réessaie.')
  }
  if (!payload.result?.path) throw new Error('Le compte n’a pas pu être créé. Réessaie.')
  return payload.result.path
}

function pageText(nodes: TelegraphNode[] | undefined): string | null {
  const first = nodes?.[0]?.children?.[0]
  return typeof first === 'string' ? first : null
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, { ...init, cache: 'no-store', signal: init?.signal ?? AbortSignal.timeout(12_000) })
  } catch {
    throw new Error('Connexion impossible. Vérifie le réseau, puis réessaie.')
  }
  if (!response.ok) throw new Error('Le compte n’a pas pu être joint. Réessaie.')
  return response.json() as Promise<T>
}
