import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCircle2, CircleAlert } from 'lucide-react'

import { ApiRequestError } from '../api/client'
import {
  type ContactErrors,
  type ContactForm,
  type SubmitContact,
  saveContactDecision,
  toContactInput,
  validateContact,
} from '../domain/contact'

interface ContactGateProps {
  submitContact: SubmitContact
  onClose: () => void
}

type TextField = Exclude<keyof ContactForm, 'consent'>

const fields: {
  name: TextField
  label: string
  type: 'text' | 'email' | 'tel'
  autoComplete: string
  maxLength: number
  optional?: boolean
  wide?: boolean
  placeholder?: string
}[] = [
  { name: 'fullName', label: 'Nom complet', type: 'text', autoComplete: 'name', maxLength: 120, wide: true },
  { name: 'email', label: 'Adresse e-mail', type: 'email', autoComplete: 'email', maxLength: 200 },
  { name: 'phone', label: 'Téléphone', type: 'tel', autoComplete: 'tel', maxLength: 30, optional: true, placeholder: '+229 01 97 00 00 00' },
  { name: 'company', label: 'Entreprise ou cabinet', type: 'text', autoComplete: 'organization', maxLength: 150, optional: true },
  { name: 'position', label: 'Fonction', type: 'text', autoComplete: 'organization-title', maxLength: 150, optional: true },
]

const emptyForm: ContactForm = { fullName: '', email: '', phone: '', company: '', position: '', consent: false }

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/** Fenêtre « Restons en contact », proposée une fois à l'entrée du chat. */
export function ContactGate({ submitContact, onClose }: ContactGateProps) {
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [errors, setErrors] = useState<ContactErrors>({})
  const [status, setStatus] = useState<'editing' | 'sending' | 'sent'>('editing')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const doneRef = useRef<HTMLButtonElement>(null)
  const sending = status === 'sending'

  const dismiss = useCallback(() => {
    if (status !== 'sent') saveContactDecision('skipped')
    onClose()
  }, [status, onClose])

  // Le focus va à la fenêtre (sans ouvrir le clavier sur mobile) puis revient au champ de question.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    return () => previous?.focus()
  }, [])

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus()
  }, [status])

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') dismiss()
      if (event.key === 'Tab') keepFocusInside(event, dialogRef.current)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dismiss])

  function update<K extends keyof ContactForm>(name: K, value: ContactForm[K]) {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return

    const found = validateContact(form)
    setErrors(found)
    setSubmitError(null)
    const firstInvalid = [...fields.map((field) => field.name), 'consent' as const].find((name) => found[name])
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstInvalid}"]`)?.focus()
      return
    }

    setStatus('sending')
    try {
      await submitContact(toContactInput(form))
      saveContactDecision('sent')
      setStatus('sent')
    } catch (caught) {
      setSubmitError(submitErrorMessage(caught))
      setStatus('editing')
    }
  }

  return (
    <div className="contact-layer">
      <div className="contact-scrim" />
      <section
        ref={dialogRef}
        className="contact-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-title"
        aria-describedby="contact-intro"
        tabIndex={-1}
      >
        {status === 'sent' ? (
          <div className="contact-thanks">
            <span className="contact-thanks__mark"><CheckCircle2 size={26} /></span>
            <h2 id="contact-title">Merci, c’est noté</h2>
            <p id="contact-intro">L’équipe Vitalia vous recontactera prochainement. Vous pouvez maintenant interroger Julia.</p>
            <button ref={doneRef} className="contact-button contact-button--primary" type="button" onClick={onClose}>
              Poser ma question <ArrowRight size={16} />
            </button>
          </div>
        ) : (
          <>
            <header className="contact-dialog__header">
              <span>Facultatif</span>
              <h2 id="contact-title">Restons en contact</h2>
              <p id="contact-intro">
                Vous souhaitez suivre l’évolution de Julia ou l’utiliser dans votre structure ?
                Laissez vos coordonnées, l’équipe Vitalia vous recontactera. Julia reste accessible sans inscription.
              </p>
            </header>
            <form ref={formRef} className="contact-form" noValidate onSubmit={handleSubmit}>
              <div className="contact-grid">
                {fields.map(({ name, label, optional, wide, ...input }) => (
                  <div key={name} className={`contact-field${wide ? ' contact-field--wide' : ''}`}>
                    <label htmlFor={`contact-${name}`}>
                      {label}{optional && <small> · facultatif</small>}
                    </label>
                    <input
                      {...input}
                      id={`contact-${name}`}
                      name={name}
                      value={form[name]}
                      onChange={(event) => update(name, event.target.value)}
                      aria-invalid={errors[name] ? true : undefined}
                      aria-describedby={errors[name] ? `contact-${name}-error` : undefined}
                      disabled={sending}
                    />
                    {errors[name] && <small id={`contact-${name}-error`} className="contact-field__error">{errors[name]}</small>}
                  </div>
                ))}
              </div>
              <label className="contact-consent">
                <input
                  type="checkbox"
                  name="consent"
                  checked={form.consent}
                  onChange={(event) => update('consent', event.target.checked)}
                  aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? 'contact-consent-error' : undefined}
                  disabled={sending}
                />
                <span>J’accepte que Vitalia conserve ces informations pour me recontacter au sujet de Julia.</span>
              </label>
              {errors.consent && <small id="contact-consent-error" className="contact-field__error">{errors.consent}</small>}
              {submitError && (
                <div className="contact-error" role="alert">
                  <CircleAlert size={17} /><p>{submitError}</p>
                </div>
              )}
              <div className="contact-actions">
                <button className="contact-button" type="button" onClick={dismiss} disabled={sending}>Plus tard</button>
                <button className="contact-button contact-button--primary" type="submit" disabled={sending}>
                  {sending && <span className="spinner" />} Envoyer
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </div>
  )
}

function submitErrorMessage(caught: unknown): string {
  // Les messages 422 de l'API sont techniques ; les autres (limite atteinte…) sont écrits pour l'utilisateur.
  if (caught instanceof ApiRequestError && caught.status === 422) {
    return 'Certaines informations n’ont pas été acceptées. Vérifiez-les puis réessayez.'
  }
  if (caught instanceof ApiRequestError) return caught.message
  return 'Vos coordonnées n’ont pas pu être envoyées. Vérifiez votre connexion et réessayez.'
}

/** Garde la tabulation dans la fenêtre tant qu'elle est ouverte. */
function keepFocusInside(event: globalThis.KeyboardEvent, container: HTMLElement | null) {
  if (!container) return
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement
  const outside = active === container || !container.contains(active)

  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault()
    first.focus()
  }
}
