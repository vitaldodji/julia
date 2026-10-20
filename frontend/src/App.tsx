import { useState } from 'react'

import { ChatPage } from './components/ChatPage'
import { ContactGate } from './components/ContactGate'
import { LandingPage } from './components/LandingPage'
import type { AskQuestion, SendFeedback } from './domain/answer'
import { type SubmitContact, loadContactDecision } from './domain/contact'

export interface AppProps {
  askQuestion: AskQuestion
  sendFeedback?: SendFeedback
  /** Sans cette fonction, la fenêtre « Restons en contact » n'est jamais proposée. */
  submitContact?: SubmitContact
  initialView?: 'landing' | 'chat'
}

export function App({ askQuestion, sendFeedback, submitContact, initialView = 'landing' }: AppProps) {
  const [view, setView] = useState<'landing' | 'chat'>(initialView)
  const [contactPending, setContactPending] = useState(() => loadContactDecision() === null)

  if (view === 'chat') {
    return (
      <>
        <ChatPage askQuestion={askQuestion} sendFeedback={sendFeedback} onBack={() => setView('landing')} />
        {submitContact && contactPending && (
          <ContactGate submitContact={submitContact} onClose={() => setContactPending(false)} />
        )}
      </>
    )
  }

  return <LandingPage onStart={() => setView('chat')} />
}
