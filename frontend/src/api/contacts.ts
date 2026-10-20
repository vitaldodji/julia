import type { SubmitContact } from '../domain/contact'
import { type Fetcher, getClientId, toApiError } from './client'

export function createContactClient(fetcher: Fetcher = fetch): SubmitContact {
  return async ({ fullName, email, phone, company, position, consent }) => {
    const response = await fetcher('/api/v1/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
      body: JSON.stringify({ full_name: fullName, email, phone, company, position, consent }),
    })

    if (!response.ok) {
      throw await toApiError(response)
    }
  }
}
