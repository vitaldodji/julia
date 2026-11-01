import { beforeAll, describe, expect, it } from 'vitest'
import { readRecords, upsertRecord, writeRecords, type KeyValueStore } from './storage'
import { addIncome } from './edit'
import { createRecord, unlockRecord, vaultConfig } from './vault'

beforeAll(() => {
  vaultConfig.iterations = 1_000
})

function memory(): KeyValueStore & { raw: string } {
  const box = { raw: '' }
  return {
    get raw() {
      return box.raw
    },
    getItem: () => box.raw || null,
    setItem: (_key, value) => {
      box.raw = value
    },
  }
}

describe('coffre', () => {
  it('ouvre avec le mot de passe et avec le code de secours', async () => {
    const created = await createRecord('Amina', 'secret-solide', '2026-10-01')
    const filled = {
      ...created,
      space: addIncome(created.space, {
        title: 'Salaire',
        amount: 180_000,
        date: '2026-10-02',
        personId: created.space.people[0].id,
        kind: 'salaire',
        recurring: false,
      }),
    }
    const { sealPayload } = await import('./vault')
    const record = await sealPayload(created.record, created.dataKey, filled.space)

    expect(record.ciphertext).not.toContain('Salaire')
    expect(await unlockRecord(record, 'mauvais')).toBeNull()

    const byPassword = await unlockRecord(record, 'secret-solide')
    expect(byPassword?.space.incomes[0].title).toBe('Salaire')

    const byRecovery = await unlockRecord(record, created.recoveryCode)
    expect(byRecovery?.space.displayName).toBe('Amina')
  })

  it('range plusieurs espaces sans écraser le voisin', () => {
    const store = memory()
    const first = fake('un')
    const second = fake('deux')
    writeRecords(store, upsertRecord(upsertRecord([], first), second))
    const renamed = { ...first, displayName: 'Amina K.' }
    writeRecords(store, upsertRecord(readRecords(store).records, renamed))
    const records = readRecords(store).records
    expect(records.map((item) => item.displayName).sort()).toEqual(['Amina K.', 'deux'])
    expect(readRecords({ getItem: () => '{', setItem() {} }).broken).toBe(true)
  })
})

function fake(name: string) {
  return {
    v: 1 as const,
    id: name,
    displayName: name,
    updatedAt: '2026-10-01T00:00:00.000Z',
    passwordSalt: 'aa',
    passwordIv: 'bb',
    wrappedByPassword: 'cc',
    recoverySalt: 'dd',
    recoveryIv: 'ee',
    wrappedByRecovery: 'ff',
    payloadIv: 'gg',
    ciphertext: 'hh',
  }
}
