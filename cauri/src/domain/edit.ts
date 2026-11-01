import { inPeriod, occurrenceDate, parseISO, type Period } from './period'
import type { CategoryId, Contribution, Expense, ExpenseWhen, Goal, Income, IncomeKind, Review, Space, Template } from './types'

export interface IncomeDraft {
  title: string
  amount: number
  date: string
  personId: string
  kind: IncomeKind
  note?: string
  recurring: boolean
}

export interface ExpenseDraft {
  title: string
  amount: number
  date: string
  personId: string
  category: CategoryId
  nature: 'besoin' | 'envie'
  when?: ExpenseWhen
  note?: string
  recurring: boolean
}

function cleanNote(note?: string): string | undefined {
  const trimmed = note?.trim()
  return trimmed ? trimmed : undefined
}

function dayOfMonth(iso: string): number {
  return Math.min(28, Math.max(1, parseISO(iso).d))
}

export function addIncome(space: Space, draft: IncomeDraft): Space {
  const title = draft.title.trim()
  let templates = space.templates
  let templateId: string | undefined
  if (draft.recurring) {
    const found = templates.find((item) =>
      item.active
      && item.kind === 'income'
      && item.personId === draft.personId
      && item.title.toLowerCase() === title.toLowerCase(),
    )
    if (found) {
      templateId = found.id
      templates = templates.map((item) => item.id === found.id
        ? { ...item, amount: draft.amount, dayOfMonth: dayOfMonth(draft.date), incomeKind: draft.kind, title }
        : item)
    } else {
      templateId = crypto.randomUUID()
      templates = [...templates, incomeTemplate(templateId, title, draft)]
    }
  }
  const income: Income = {
    id: crypto.randomUUID(),
    title,
    amount: draft.amount,
    date: draft.date,
    personId: draft.personId,
    kind: draft.kind,
    templateId,
    note: cleanNote(draft.note),
  }
  return { ...space, templates, incomes: [...space.incomes, income] }
}

function incomeTemplate(id: string, title: string, draft: IncomeDraft): Template {
  return {
    id,
    kind: 'income',
    title,
    amount: draft.amount,
    dayOfMonth: dayOfMonth(draft.date),
    personId: draft.personId,
    incomeKind: draft.kind,
    active: true,
  }
}

export function updateIncome(space: Space, id: string, draft: Omit<IncomeDraft, 'recurring'>): Space {
  return {
    ...space,
    incomes: space.incomes.map((item) => item.id === id
      ? {
          ...item,
          title: draft.title.trim(),
          amount: draft.amount,
          date: draft.date,
          personId: draft.personId,
          kind: draft.kind,
          note: cleanNote(draft.note),
        }
      : item),
  }
}

export function deleteIncome(space: Space, id: string): Space {
  return { ...space, incomes: space.incomes.filter((item) => item.id !== id) }
}

export function addExpense(space: Space, draft: ExpenseDraft): Space {
  const title = draft.title.trim()
  let templates = space.templates
  let templateId: string | undefined
  if (draft.recurring) {
    const found = templates.find((item) =>
      item.active
      && item.kind === 'expense'
      && item.personId === draft.personId
      && item.title.toLowerCase() === title.toLowerCase(),
    )
    if (found) {
      templateId = found.id
      templates = templates.map((item) => item.id === found.id
        ? {
            ...item,
            amount: draft.amount,
            dayOfMonth: dayOfMonth(draft.date),
            category: draft.category,
            nature: draft.nature,
            title,
          }
        : item)
    } else {
      templateId = crypto.randomUUID()
      templates = [...templates, {
        id: templateId,
        kind: 'expense',
        title,
        amount: draft.amount,
        dayOfMonth: dayOfMonth(draft.date),
        personId: draft.personId,
        category: draft.category,
        nature: draft.nature,
        active: true,
      }]
    }
  }
  const expense: Expense = {
    id: crypto.randomUUID(),
    title,
    amount: draft.amount,
    date: draft.date,
    personId: draft.personId,
    category: draft.category,
    nature: draft.nature,
    when: draft.when === 'a_venir' ? 'a_venir' : 'faite',
    templateId,
    note: cleanNote(draft.note),
  }
  return { ...space, templates, expenses: [...space.expenses, expense] }
}

export function updateExpense(space: Space, id: string, draft: Omit<ExpenseDraft, 'recurring'>): Space {
  return {
    ...space,
    expenses: space.expenses.map((item) => item.id === id
      ? {
          ...item,
          title: draft.title.trim(),
          amount: draft.amount,
          date: draft.date,
          personId: draft.personId,
          category: draft.category,
          nature: draft.nature,
          when: draft.when === 'a_venir' ? 'a_venir' : 'faite',
          note: cleanNote(draft.note),
        }
      : item),
  }
}

export function deleteExpense(space: Space, id: string): Space {
  return { ...space, expenses: space.expenses.filter((item) => item.id !== id) }
}

export function deleteTemplate(space: Space, id: string): Space {
  return { ...space, templates: space.templates.filter((item) => item.id !== id) }
}

export function pointTemplate(space: Space, template: Template, period: Period): Space {
  const date = occurrenceDate(period, template.dayOfMonth)
  if (template.kind === 'income') {
    const already = space.incomes.some((item) => item.templateId === template.id && inPeriod(item.date, period))
    return already ? space : appendPointedIncome(space, template, date)
  }
  const already = space.expenses.some((item) => item.templateId === template.id && inPeriod(item.date, period))
  return already ? space : appendPointedExpense(space, template, date)
}

function appendPointedIncome(space: Space, template: Template, date: string): Space {
  const income: Income = {
    id: crypto.randomUUID(),
    title: template.title,
    amount: template.amount,
    date,
    personId: template.personId,
    kind: template.incomeKind ?? 'autre',
    templateId: template.id,
  }
  return { ...space, incomes: [...space.incomes, income] }
}

function appendPointedExpense(space: Space, template: Template, date: string): Space {
  const expense: Expense = {
    id: crypto.randomUUID(),
    title: template.title,
    amount: template.amount,
    date,
    personId: template.personId,
    category: template.category ?? 'autre',
    nature: template.nature ?? 'besoin',
    templateId: template.id,
  }
  return { ...space, expenses: [...space.expenses, expense] }
}

export interface GoalDraft {
  title: string
  target: number
  deadline?: string
  monthlyPlan?: number
  personId?: string
  note?: string
}

export function addGoal(space: Space, draft: GoalDraft, today: string): Space {
  const goal: Goal = {
    id: crypto.randomUUID(),
    title: draft.title.trim(),
    target: draft.target,
    deadline: draft.deadline || undefined,
    monthlyPlan: draft.monthlyPlan && draft.monthlyPlan > 0 ? draft.monthlyPlan : undefined,
    personId: draft.personId || undefined,
    note: cleanNote(draft.note),
    paused: false,
    featured: space.goals.every((item) => !item.featured),
    createdAt: today,
  }
  return { ...space, goals: [...space.goals, goal] }
}

export function updateGoal(space: Space, id: string, draft: GoalDraft): Space {
  return {
    ...space,
    goals: space.goals.map((item) => item.id === id
      ? {
          ...item,
          title: draft.title.trim(),
          target: draft.target,
          deadline: draft.deadline || undefined,
          monthlyPlan: draft.monthlyPlan && draft.monthlyPlan > 0 ? draft.monthlyPlan : undefined,
          personId: draft.personId || undefined,
          note: cleanNote(draft.note),
        }
      : item),
  }
}

export function deleteGoal(space: Space, id: string): Space {
  return {
    ...space,
    goals: space.goals.filter((item) => item.id !== id),
    contributions: space.contributions.filter((item) => item.goalId !== id),
  }
}

export function featureGoal(space: Space, id: string): Space {
  return {
    ...space,
    goals: space.goals.map((item) => ({ ...item, featured: item.id === id })),
  }
}

export function setGoalPaused(space: Space, id: string, paused: boolean): Space {
  return {
    ...space,
    goals: space.goals.map((item) => item.id === id ? { ...item, paused } : item),
  }
}

export function addContribution(space: Space, goalId: string, amount: number, date: string, note?: string): Space {
  const contribution: Contribution = {
    id: crypto.randomUUID(),
    goalId,
    amount,
    date,
    note: cleanNote(note),
  }
  return { ...space, contributions: [...space.contributions, contribution] }
}

export function deleteContribution(space: Space, id: string): Space {
  return { ...space, contributions: space.contributions.filter((item) => item.id !== id) }
}

export function setBudget(space: Space, category: CategoryId, limit: number): Space {
  const budgets = space.budgets.filter((item) => item.category !== category)
  if (limit <= 0) return { ...space, budgets }
  return { ...space, budgets: [...budgets, { category, limit }] }
}

export function addPerson(space: Space, name: string): Space {
  return { ...space, people: [...space.people, { id: crypto.randomUUID(), name: name.trim() }] }
}

export function renamePerson(space: Space, id: string, name: string): Space {
  return {
    ...space,
    people: space.people.map((item) => item.id === id ? { ...item, name: name.trim() } : item),
  }
}

export function removePerson(space: Space, personId: string): Space | null {
  if (space.people.length <= 1) return null
  const fallback = space.people.find((item) => item.id !== personId)
  if (!fallback) return null
  const mapId = (id: string) => (id === personId ? fallback.id : id)
  return {
    ...space,
    people: space.people.filter((item) => item.id !== personId),
    incomes: space.incomes.map((item) => ({ ...item, personId: mapId(item.personId) })),
    expenses: space.expenses.map((item) => ({ ...item, personId: mapId(item.personId) })),
    templates: space.templates.map((item) => ({ ...item, personId: mapId(item.personId) })),
    goals: space.goals.map((item) => ({
      ...item,
      personId: item.personId ? mapId(item.personId) : undefined,
    })),
  }
}

export function closeMonth(space: Space, period: Period, closedAt: string): Space {
  const review: Review = { periodKey: period.key, label: period.label, closedAt }
  return {
    ...space,
    reviews: [...space.reviews.filter((item) => item.periodKey !== period.key), review],
  }
}

export function reopenMonth(space: Space, periodKey: string): Space {
  return { ...space, reviews: space.reviews.filter((item) => item.periodKey !== periodKey) }
}
