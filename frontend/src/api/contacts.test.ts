import { describe, expect, it, vi } from 'vitest'

import { createContactClient } from './contacts'

describe('contact API client', () => {
  it('sends the details and the explicit consent to the API', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))

    await createContactClient(fetcher)({
      fullName: 'Awa Dossou',
      email: 'awa@cabinet-dossou.bj',
      company: 'Cabinet Dossou',
      consent: true,
    })

    const [url, init] = fetcher.mock.calls[0]
    expect(url).toBe('/api/v1/contacts')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({
      full_name: 'Awa Dossou',
      email: 'awa@cabinet-dossou.bj',
      company: 'Cabinet Dossou',
      consent: true,
    })
    expect(init.headers['X-Client-Id']).toMatch(/^[A-Za-z0-9-]{8,64}$/)
  })

  it('rejects with the message written by the API', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'RATE_LIMITED', message: 'Trop de requêtes depuis ce réseau. Réessayez dans un instant.' },
        }),
        { status: 429 },
      ),
    )

    await expect(
      createContactClient(fetcher)({ fullName: 'Awa Dossou', email: 'awa@cabinet-dossou.bj', consent: true }),
    ).rejects.toMatchObject({ status: 429, message: 'Trop de requêtes depuis ce réseau. Réessayez dans un instant.' })
  })
})
