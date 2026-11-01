import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchDirectory, loginKey, normalizeLogin, publishRecord } from './cloud'
import { createRecord, vaultConfig } from './vault'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('nom de compte', () => {
  it('ignore les majuscules et les espaces en trop', () => {
    expect(normalizeLogin('  Amina  ')).toBe('amina')
    expect(normalizeLogin('Jean   Pierre')).toBe('jean pierre')
  })

  it('retrouve la même clé pour le même nom', async () => {
    expect(await loginKey('Amina')).toBe(await loginKey(' amina '))
  })
})

describe('publication', () => {
  it('refuse un nom déjà pris par un autre coffre', async () => {
    vaultConfig.iterations = 1_000
    const created = await createRecord('Amina', 'secret-solide', '2026-11-01')
    const pages = new Map<string, unknown>([
      ['Annuaire-11-01', { v: 1, accounts: { [(await loginKey('Amina'))]: 'autre' } }],
      ['autre', { ...created.record, id: 'pas-le-meme' }],
    ])
    vi.stubGlobal('fetch', async (url: string) => pageResponse(pages, String(url)))
    await expect(publishRecord(created.record, 'Amina')).rejects.toThrow(/existe déjà/)
  })

  it('crée un coffre puis l’inscrit au nom demandé', async () => {
    vaultConfig.iterations = 1_000
    const created = await createRecord('Koffi', 'secret-solide', '2026-11-01')
    const key = await loginKey('Koffi')
    const pages = new Map<string, unknown>([['Annuaire-11-01', { v: 1, accounts: {} }]])
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      const target = String(url)
      if (target.includes('/createPage')) {
        pages.set('nouveau', JSON.parse(posted(init).get('content') ? textOf(posted(init).get('content')!) : '{}'))
        return json({ ok: true, result: { path: 'nouveau' } })
      }
      if (target.includes('/editPage/')) {
        const path = decodeURIComponent(target.split('/editPage/')[1]?.split('?')[0] ?? '')
        pages.set(path, JSON.parse(textOf(posted(init).get('content') ?? '')))
        return json({ ok: true, result: { path } })
      }
      return pageResponse(pages, target)
    })
    const link = await publishRecord(created.record, 'Koffi')
    expect(link).toMatchObject({ loginKey: key, binId: 'nouveau', loginName: 'koffi' })
    const directory = await fetchDirectory()
    expect(directory.accounts[key]).toBe('nouveau')
  })
})

function posted(init?: RequestInit): URLSearchParams {
  return new URLSearchParams(String(init?.body ?? ''))
}

function textOf(content: string): string {
  const nodes = JSON.parse(content) as Array<{ children?: string[] }>
  return nodes[0]?.children?.[0] ?? '{}'
}

function pageResponse(pages: Map<string, unknown>, url: string): Response {
  const path = decodeURIComponent(url.split('/getPage/')[1]?.split('?')[0] ?? '')
  const data = pages.get(path)
  if (!data) return json({ ok: false, error: 'PAGE_NOT_FOUND' })
  return json({ ok: true, result: { path, content: [{ tag: 'p', children: [JSON.stringify(data)] }] } })
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}
