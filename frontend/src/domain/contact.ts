import { browserStorage } from '../api/client'

/**
 * Coordonnées laissées volontairement à l'entrée du chat (formulaire facultatif).
 * Ce n'est pas une inscription : Julia reste accessible sans elles.
 */

export interface ContactInput {
  fullName: string
  email: string
  phone?: string
  company?: string
  position?: string
  consent: true
}

export type SubmitContact = (input: ContactInput) => Promise<void>

export interface ContactForm {
  fullName: string
  email: string
  phone: string
  company: string
  position: string
  consent: boolean
}

export type ContactErrors = Partial<Record<keyof ContactForm, string>>

// Mêmes règles que ContactRequest côté API : un formulaire validé ici n'est pas refusé en 422.
// Les longueurs maximales sont imposées par les champs eux-mêmes (maxLength).
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const PHONE_PATTERN = /^\+?[0-9 ().-]{6,30}$/

export function validateContact(form: ContactForm): ContactErrors {
  const errors: ContactErrors = {}
  if (form.fullName.trim().length < 2) errors.fullName = 'Indiquez votre nom complet.'
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Indiquez une adresse e-mail valide.'
  const phone = form.phone.trim()
  if (phone && !PHONE_PATTERN.test(phone)) errors.phone = 'Indiquez un numéro valide, par exemple +229 01 97 00 00 00.'
  if (!form.consent) errors.consent = 'Cochez cette case pour que nous puissions vous recontacter.'
  return errors
}

/** Coordonnées prêtes à envoyer : espaces retirés, champs facultatifs vides omis. */
export function toContactInput(form: ContactForm): ContactInput {
  return {
    fullName: form.fullName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || undefined,
    company: form.company.trim() || undefined,
    position: form.position.trim() || undefined,
    consent: true,
  }
}

export type ContactDecision = 'sent' | 'skipped'

const DECISION_KEY = 'julia-contact-v1'

/** Choix déjà fait dans ce navigateur ; la fenêtre n'est proposée qu'une fois. */
export function loadContactDecision(storage: Storage | null = browserStorage()): ContactDecision | null {
  try {
    const value = storage?.getItem(DECISION_KEY)
    return value === 'sent' || value === 'skipped' ? value : null
  } catch {
    return null
  }
}

export function saveContactDecision(decision: ContactDecision, storage: Storage | null = browserStorage()): void {
  try {
    storage?.setItem(DECISION_KEY, decision)
  } catch {
    // Navigation privée stricte : la fenêtre sera reproposée à la prochaine visite.
  }
}
