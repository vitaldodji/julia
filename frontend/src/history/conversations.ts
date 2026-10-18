import { z } from 'zod'

import { browserStorage, randomId } from '../api/client'
import type { AnswerResponse, FeedbackRating } from '../domain/answer'

/**
 * Historique des conversations, gardé dans le navigateur (pas de comptes en V0).
 * Chaque question reste traitée séparément par le backend : l'historique sert à relire, pas de contexte.
 */

export interface Exchange {
  id: string
  question: string
  answer: AnswerResponse
  askedAt: string
  rating?: FeedbackRating
}

export interface Conversation {
  id: string
  title: string
  updatedAt: string
  exchanges: Exchange[]
}

const STORAGE_KEY = 'julia-conversations-v1'
export const MAX_CONVERSATIONS = 20
export const MAX_EXCHANGES = 20
const TITLE_LENGTH = 70

const sourceSchema = z.object({
  citationId: z.string(),
  documentId: z.string(),
  title: z.string(),
  article: z.string().optional(),
  page: z.number().optional(),
  version: z.string().optional(),
  status: z.enum(['en_vigueur', 'archive', 'a_verifier']),
  excerpt: z.string(),
  documentUrl: z.string(),
  isOcr: z.boolean(),
})

const conversationsSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string(),
    updatedAt: z.string(),
    exchanges: z.array(
      z.object({
        id: z.string(),
        question: z.string(),
        askedAt: z.string(),
        rating: z.enum(['up', 'down']).optional(),
        answer: z.object({
          requestId: z.string(),
          conversationId: z.string(),
          status: z.enum(['answered', 'insufficient_sources', 'clarification_required']),
          answerMarkdown: z.string(),
          sources: z.array(sourceSchema),
        }),
      }),
    ),
  }),
)

export function newConversationId(): string {
  return randomId()
}

export function loadConversations(storage: Storage | null = browserStorage()): Conversation[] {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = conversationsSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

/** Enregistre l'historique ; si le quota du navigateur est atteint, retire les plus anciennes. */
export function saveConversations(conversations: Conversation[], storage: Storage | null = browserStorage()): void {
  let kept = conversations.slice(0, MAX_CONVERSATIONS)
  while (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(kept))
      return
    } catch {
      if (kept.length === 0) return
      kept = kept.slice(0, -1)
    }
  }
}

/** Ajoute un échange à la conversation (créée si besoin) et la place en tête de l'historique. */
export function addExchange(
  conversations: Conversation[],
  conversationId: string,
  exchange: Exchange,
): Conversation[] {
  const existing = conversations.find((conversation) => conversation.id === conversationId)
  const updated: Conversation = existing
    ? {
        ...existing,
        updatedAt: exchange.askedAt,
        exchanges: [...existing.exchanges, exchange].slice(-MAX_EXCHANGES),
      }
    : {
        id: conversationId,
        title: titleFrom(exchange.question),
        updatedAt: exchange.askedAt,
        exchanges: [exchange],
      }
  const others = conversations.filter((conversation) => conversation.id !== conversationId)
  return [updated, ...others].slice(0, MAX_CONVERSATIONS)
}

export function rateExchange(
  conversations: Conversation[],
  exchangeId: string,
  rating: FeedbackRating,
): Conversation[] {
  return conversations.map((conversation) => ({
    ...conversation,
    exchanges: conversation.exchanges.map((exchange) =>
      exchange.id === exchangeId ? { ...exchange, rating } : exchange,
    ),
  }))
}

function titleFrom(question: string): string {
  const flat = question.replace(/\s+/g, ' ').trim()
  return flat.length > TITLE_LENGTH ? `${flat.slice(0, TITLE_LENGTH - 1)}…` : flat
}
