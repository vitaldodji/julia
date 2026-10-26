import { todayISO } from './period'
import { blankSpace, isSpace, type Space } from './types'

export const vaultConfig = { iterations: 120_000 }

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface VaultRecord {
  v: 1
  id: string
  displayName: string
  updatedAt: string
  passwordSalt: string
  passwordIv: string
  wrappedByPassword: string
  recoverySalt: string
  recoveryIv: string
  wrappedByRecovery: string
  payloadIv: string
  ciphertext: string
}

export interface OpenVault {
  space: Space
  dataKey: CryptoKey
  record: VaultRecord
}

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const raw = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`
}

export function normalizeRecovery(secret: string): string {
  return secret.trim().toUpperCase().replace(/[\s-]/g, '')
}

export function looksLikeRecovery(secret: string): boolean {
  return /^[A-Z0-9]{16}$/.test(normalizeRecovery(secret))
}

export function isVaultRecord(value: unknown): value is VaultRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<VaultRecord>
  return record.v === 1
    && typeof record.id === 'string'
    && typeof record.displayName === 'string'
    && typeof record.passwordSalt === 'string'
    && typeof record.passwordIv === 'string'
    && typeof record.wrappedByPassword === 'string'
    && typeof record.recoverySalt === 'string'
    && typeof record.recoveryIv === 'string'
    && typeof record.wrappedByRecovery === 'string'
    && typeof record.payloadIv === 'string'
    && typeof record.ciphertext === 'string'
}

export async function createRecord(name: string, password: string, today = todayISO()): Promise<OpenVault & { recoveryCode: string }> {
  const id = crypto.randomUUID()
  const space = blankSpace(id, name, today)
  const dataKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const recoveryCode = generateRecoveryCode()
  const sealed = await sealPayload(skeleton(id, name.trim(), today), dataKey, space)
  const withPassword = await wrapSecret(sealed, dataKey, password, 'password')
  const record = await wrapSecret(withPassword, dataKey, normalizeRecovery(recoveryCode), 'recovery')
  return { space, dataKey, record, recoveryCode }
}

export async function unlockRecord(record: VaultRecord, secret: string): Promise<OpenVault | null> {
  const byPassword = await openWith(record, secret, 'password')
  if (byPassword) return byPassword
  if (!looksLikeRecovery(secret)) return null
  return openWith(record, normalizeRecovery(secret), 'recovery')
}

async function openWith(record: VaultRecord, secret: string, which: 'password' | 'recovery'): Promise<OpenVault | null> {
  const dataKey = await unwrap(record, secret, which).catch(() => null)
  if (!dataKey) return null
  const space = await readPayload(record, dataKey).catch(() => null)
  if (!space || space.id !== record.id) return null
  return { space, dataKey, record }
}

export async function openWithKey(record: VaultRecord, dataKey: CryptoKey): Promise<OpenVault | null> {
  const space = await readPayload(record, dataKey).catch(() => null)
  if (!space || space.id !== record.id) return null
  return { space, dataKey, record }
}

export async function exportDataKey(dataKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', dataKey)
  return bytesToB64(new Uint8Array(raw))
}

export async function importDataKey(encoded: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', asBuffer(b64ToBytes(encoded)), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

export async function sealPayload(record: VaultRecord, dataKey: CryptoKey, space: Space): Promise<VaultRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBuffer(iv) },
    dataKey,
    new TextEncoder().encode(JSON.stringify(space)),
  )
  return {
    ...record,
    displayName: space.displayName,
    updatedAt: new Date().toISOString(),
    payloadIv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(cipher)),
  }
}

export async function rewrapPassword(record: VaultRecord, dataKey: CryptoKey, password: string): Promise<VaultRecord> {
  return wrapSecret(record, dataKey, password, 'password')
}

export async function rewrapRecovery(record: VaultRecord, dataKey: CryptoKey): Promise<{ record: VaultRecord; recoveryCode: string }> {
  const recoveryCode = generateRecoveryCode()
  return {
    recoveryCode,
    record: await wrapSecret(record, dataKey, normalizeRecovery(recoveryCode), 'recovery'),
  }
}

async function wrapSecret(
  record: VaultRecord,
  dataKey: CryptoKey,
  secret: string,
  which: 'password' | 'recovery',
): Promise<VaultRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(secret, salt)
  const wrapped = await encryptBytes(key, await crypto.subtle.exportKey('raw', dataKey))
  if (which === 'password') {
    return {
      ...record,
      passwordSalt: bytesToB64(salt),
      passwordIv: wrapped.iv,
      wrappedByPassword: wrapped.ciphertext,
    }
  }
  return {
    ...record,
    recoverySalt: bytesToB64(salt),
    recoveryIv: wrapped.iv,
    wrappedByRecovery: wrapped.ciphertext,
  }
}

async function unwrap(record: VaultRecord, secret: string, which: 'password' | 'recovery'): Promise<CryptoKey> {
  const salt = b64ToBytes(which === 'password' ? record.passwordSalt : record.recoverySalt)
  const iv = which === 'password' ? record.passwordIv : record.recoveryIv
  const wrapped = which === 'password' ? record.wrappedByPassword : record.wrappedByRecovery
  const key = await deriveKey(secret, salt)
  const raw = await decryptBytes(key, iv, wrapped)
  return crypto.subtle.importKey('raw', asBuffer(raw), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
}

async function readPayload(record: VaultRecord, dataKey: CryptoKey): Promise<Space> {
  const plain = await decryptBytes(dataKey, record.payloadIv, record.ciphertext)
  const parsed: unknown = JSON.parse(new TextDecoder().decode(plain))
  if (!isSpace(parsed)) throw new Error('espace illisible')
  return parsed
}

function skeleton(id: string, displayName: string, updatedAt: string): VaultRecord {
  return {
    v: 1,
    id,
    displayName,
    updatedAt,
    passwordSalt: '',
    passwordIv: '',
    wrappedByPassword: '',
    recoverySalt: '',
    recoveryIv: '',
    wrappedByRecovery: '',
    payloadIv: '',
    ciphertext: '',
  }
}

async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBuffer(salt), iterations: vaultConfig.iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, data)
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(cipher)) }
}

async function decryptBytes(key: CryptoKey, iv: string, ciphertext: string): Promise<Uint8Array> {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBuffer(b64ToBytes(iv)) },
    key,
    asBuffer(b64ToBytes(ciphertext)),
  )
  return new Uint8Array(plain)
}

function asBuffer(bytes: Uint8Array): BufferSource {
  return bytes
}

export function bytesToB64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}
