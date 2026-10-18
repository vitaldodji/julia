import { describe, expect, it } from 'vitest'

import type { AnswerResponse } from '../domain/answer'
import {
  type Exchange,
  MAX_CONVERSATIONS,
  addExchange,
  loadConversations,
  rateExchange,
  saveConversations,
} from './conversations'

function exchange(id: string, question = `Question ${id}`): Exchange {
  const answer: AnswerResponse = {
    requestId: id,
    conversationId: 'serveur',
    status: 'answered',
    answerMarkdown: `Réponse ${id} [1]`,
    sources: [],
  }
  return { id, question, answer, askedAt: '2026-10-18T09:00:00.000Z' }
}

describe('conversation history', () => {
  it('appends to an existing conversation and moves it to the top', () => {
    let history = addExchange([], 'c1', exchange('r1', 'Quel est le taux de la TVA ?'))
    history = addExchange(history, 'c2', exchange('r2'))
    history = addExchange(history, 'c1', exchange('r3'))

    expect(history.map((conversation) => conversation.id)).toEqual(['c1', 'c2'])
    expect(history[0].title).toBe('Quel est le taux de la TVA ?')
    expect(history[0].exchanges.map((item) => item.id)).toEqual(['r1', 'r3'])
  })

  it('keeps a bounded number of conversations', () => {
    let history = addExchange([], 'c0', exchange('r0'))
    for (let index = 1; index <= MAX_CONVERSATIONS + 3; index += 1) {
      history = addExchange(history, `c${index}`, exchange(`r${index}`))
    }

    expect(history).toHaveLength(MAX_CONVERSATIONS)
  })

  it('records the rating of one exchange', () => {
    const history = rateExchange(addExchange([], 'c1', exchange('r1')), 'r1', 'down')

    expect(history[0].exchanges[0].rating).toBe('down')
  })

  it('survives a reload and ignores corrupted data', () => {
    const history = addExchange([], 'c1', exchange('r1'))

    saveConversations(history, localStorage)
    expect(loadConversations(localStorage)).toEqual(history)

    localStorage.setItem('julia-conversations-v1', '{pas du json')
    expect(loadConversations(localStorage)).toEqual([])
  })

  it('drops the oldest conversations when the browser quota is reached', () => {
    const history = [1, 2, 3].reduce((acc, index) => addExchange(acc, `c${index}`, exchange(`r${index}`)), [] as ReturnType<typeof addExchange>)
    const saved: string[] = []
    const tinyStorage = {
      setItem: (_key: string, value: string) => {
        if (JSON.parse(value).length > 1) throw new DOMException('quota', 'QuotaExceededError')
        saved.push(value)
      },
    } as unknown as Storage

    saveConversations(history, tinyStorage)

    expect(JSON.parse(saved[0]).map((conversation: { id: string }) => conversation.id)).toEqual(['c3'])
  })
})
