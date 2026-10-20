import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { App } from '../App'
import { ApiRequestError } from '../api/client'

function contactDialog() {
  return screen.getByRole('dialog', { name: /restons en contact/i })
}

describe('contact gate', () => {
  it('is offered once per browser when entering the chat', async () => {
    const user = userEvent.setup()
    const submitContact = vi.fn()

    const { unmount } = render(<App askQuestion={vi.fn()} submitContact={submitContact} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /poser une question/i }))
    await user.click(within(contactDialog()).getByRole('button', { name: /plus tard/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /votre question juridique/i })).toHaveFocus()
    expect(localStorage.getItem('julia-contact-v1')).toBe('skipped')
    expect(submitContact).not.toHaveBeenCalled()

    unmount()
    render(<App askQuestion={vi.fn()} submitContact={submitContact} initialView="chat" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('can be dismissed with the Escape key', async () => {
    const user = userEvent.setup()

    render(<App askQuestion={vi.fn()} submitContact={vi.fn()} initialView="chat" />)
    expect(contactDialog()).toHaveFocus()
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem('julia-contact-v1')).toBe('skipped')
  })

  it('sends the details only with the explicit consent', async () => {
    const user = userEvent.setup()
    const submitContact = vi.fn().mockResolvedValue(undefined)

    render(<App askQuestion={vi.fn()} submitContact={submitContact} initialView="chat" />)
    const dialog = within(contactDialog())
    await user.type(dialog.getByLabelText(/nom complet/i), 'Awa Dossou')
    await user.type(dialog.getByLabelText(/adresse e-mail/i), 'awa@cabinet-dossou.bj')
    await user.type(dialog.getByLabelText(/téléphone/i), '+229 01 97 00 00 00')
    await user.type(dialog.getByLabelText(/entreprise ou cabinet/i), 'Cabinet Dossou')
    await user.type(dialog.getByLabelText(/fonction/i), 'Expert-comptable')
    await user.click(dialog.getByRole('button', { name: /envoyer/i }))

    expect(submitContact).not.toHaveBeenCalled()
    expect(dialog.getByText(/cochez cette case/i)).toBeVisible()
    expect(dialog.getByRole('checkbox')).toHaveFocus()

    await user.click(dialog.getByRole('checkbox', { name: /j’accepte que vitalia/i }))
    await user.click(dialog.getByRole('button', { name: /envoyer/i }))

    expect(submitContact).toHaveBeenCalledWith({
      fullName: 'Awa Dossou',
      email: 'awa@cabinet-dossou.bj',
      phone: '+229 01 97 00 00 00',
      company: 'Cabinet Dossou',
      position: 'Expert-comptable',
      consent: true,
    })
    expect(await screen.findByRole('heading', { name: /merci, c’est noté/i })).toBeVisible()
    expect(localStorage.getItem('julia-contact-v1')).toBe('sent')

    await user.click(screen.getByRole('button', { name: /poser ma question/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('flags invalid fields before sending anything', async () => {
    const user = userEvent.setup()
    const submitContact = vi.fn()

    render(<App askQuestion={vi.fn()} submitContact={submitContact} initialView="chat" />)
    const dialog = within(contactDialog())
    await user.type(dialog.getByLabelText(/nom complet/i), 'A')
    await user.type(dialog.getByLabelText(/adresse e-mail/i), 'awa@cabinet')
    await user.click(dialog.getByRole('checkbox'))
    await user.click(dialog.getByRole('button', { name: /envoyer/i }))

    expect(submitContact).not.toHaveBeenCalled()
    expect(dialog.getByLabelText(/nom complet/i)).toHaveAttribute('aria-invalid', 'true')
    expect(dialog.getByLabelText(/nom complet/i)).toHaveAccessibleDescription(/indiquez votre nom complet/i)
    expect(dialog.getByLabelText(/adresse e-mail/i)).toHaveAccessibleDescription(/adresse e-mail valide/i)
    expect(dialog.getByLabelText(/nom complet/i)).toHaveFocus()
  })

  it('keeps the details and explains the failure when sending fails', async () => {
    const user = userEvent.setup()
    const submitContact = vi
      .fn()
      .mockRejectedValue(new ApiRequestError('Trop de requêtes depuis ce réseau. Réessayez dans un instant.', 429))

    render(<App askQuestion={vi.fn()} submitContact={submitContact} initialView="chat" />)
    const dialog = within(contactDialog())
    await user.type(dialog.getByLabelText(/nom complet/i), 'Awa Dossou')
    await user.type(dialog.getByLabelText(/adresse e-mail/i), 'awa@cabinet-dossou.bj')
    await user.click(dialog.getByRole('checkbox'))
    await user.click(dialog.getByRole('button', { name: /envoyer/i }))

    expect(await dialog.findByRole('alert')).toHaveTextContent(/réessayez dans un instant/i)
    expect(dialog.getByLabelText(/nom complet/i)).toHaveValue('Awa Dossou')
    expect(localStorage.getItem('julia-contact-v1')).toBeNull()
  })

  it('is never shown without a contact client', () => {
    render(<App askQuestion={vi.fn()} initialView="chat" />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
