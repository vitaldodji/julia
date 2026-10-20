import { describe, expect, it } from 'vitest'

import { type ContactForm, toContactInput, validateContact } from './contact'

const valid: ContactForm = {
  fullName: 'Awa Dossou',
  email: 'awa@cabinet-dossou.bj',
  phone: '',
  company: '',
  position: '',
  consent: true,
}

describe('contact form rules', () => {
  it('accepts the required fields alone', () => {
    expect(validateContact(valid)).toEqual({})
  })

  it('applies the same rules as the API', () => {
    const errors = validateContact({ ...valid, fullName: ' A ', email: 'awa@cabinet', phone: '01-AB', consent: false })

    expect(Object.keys(errors).sort()).toEqual(['consent', 'email', 'fullName', 'phone'])
  })

  it('accepts a Beninese number in international format', () => {
    expect(validateContact({ ...valid, phone: '+229 01 97 00 00 00' })).toEqual({})
  })

  it('trims the values and leaves out empty optional fields', () => {
    expect(toContactInput({ ...valid, fullName: '  Awa Dossou ', company: '   ', position: ' Expert-comptable ' })).toEqual({
      fullName: 'Awa Dossou',
      email: 'awa@cabinet-dossou.bj',
      phone: undefined,
      company: undefined,
      position: 'Expert-comptable',
      consent: true,
    })
  })
})
