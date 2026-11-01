export const CATEGORIES = [
  { id: 'transport', label: 'Transport' },
  { id: 'plaisirs', label: 'Petits plaisirs' },
  { id: 'famille', label: 'Famille' },
  { id: 'etudes', label: 'Études' },
  { id: 'nourriture', label: 'Nourriture' },
  { id: 'logement', label: 'Logement' },
  { id: 'communication', label: 'Communication' },
  { id: 'sante', label: 'Santé' },
  { id: 'education', label: 'Éducation' },
  { id: 'factures', label: 'Factures' },
  { id: 'vetements', label: 'Vêtements' },
  { id: 'loisirs', label: 'Loisirs' },
  { id: 'dettes', label: 'Dettes' },
  { id: 'autre', label: 'Autre' },
] as const

export const QUICK_CATEGORIES = ['transport', 'plaisirs', 'famille', 'etudes', 'autre'] as const satisfies readonly CategoryId[]

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const INCOME_KINDS = [
  { id: 'cours_maison', label: 'Cours à domicile' },
  { id: 'cours_college', label: 'Cours au collège' },
  { id: 'salaire', label: 'Salaire' },
  { id: 'activite', label: 'Activité' },
  { id: 'aide', label: 'Aide' },
  { id: 'autre', label: 'Autre' },
] as const

export const QUICK_INCOMES = ['cours_maison', 'cours_college', 'autre'] as const satisfies readonly IncomeKind[]

export type IncomeKind = (typeof INCOME_KINDS)[number]['id']

export type Currency = 'XOF' | 'EUR' | 'USD'

export interface Person {
  id: string
  name: string
}

export interface Template {
  id: string
  kind: 'income' | 'expense'
  title: string
  amount: number
  dayOfMonth: number
  personId: string
  category?: CategoryId
  nature?: 'besoin' | 'envie'
  incomeKind?: IncomeKind
  active: boolean
}

export interface Income {
  id: string
  title: string
  amount: number
  date: string
  personId: string
  kind: IncomeKind
  templateId?: string
  note?: string
}

export type ExpenseWhen = 'faite' | 'a_venir'

export interface Expense {
  id: string
  title: string
  amount: number
  date: string
  personId: string
  category: CategoryId
  nature: 'besoin' | 'envie'
  when?: ExpenseWhen
  templateId?: string
  note?: string
}

export function expenseWhen(expense: Expense): ExpenseWhen {
  return expense.when === 'a_venir' ? 'a_venir' : 'faite'
}

export interface Goal {
  id: string
  title: string
  target: number
  deadline?: string
  monthlyPlan?: number
  personId?: string
  note?: string
  paused: boolean
  featured: boolean
  createdAt: string
}

export interface Contribution {
  id: string
  goalId: string
  amount: number
  date: string
  note?: string
}

export interface Budget {
  category: CategoryId
  limit: number
}

export interface Review {
  periodKey: string
  label: string
  closedAt: string
}

export interface Rule {
  needs: number
  wants: number
  savings: number
}

export interface Space {
  v: 1
  id: string
  displayName: string
  loginName?: string
  currency: Currency
  monthStartsOn: number
  rule: Rule
  people: Person[]
  templates: Template[]
  incomes: Income[]
  expenses: Expense[]
  goals: Goal[]
  contributions: Contribution[]
  budgets: Budget[]
  reviews: Review[]
  createdAt: string
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((item) => item.id === id)?.label ?? id
}

export function incomeKindLabel(id: IncomeKind): string {
  return INCOME_KINDS.find((item) => item.id === id)?.label ?? id
}

export function blankSpace(id: string, name: string, today: string): Space {
  const trimmed = name.trim()
  return {
    v: 1,
    id,
    displayName: trimmed,
    currency: 'XOF',
    monthStartsOn: 1,
    rule: { needs: 50, wants: 30, savings: 20 },
    people: [{ id: crypto.randomUUID(), name: trimmed }],
    templates: [],
    incomes: [],
    expenses: [],
    goals: [],
    contributions: [],
    budgets: [],
    reviews: [],
    createdAt: today,
  }
}

export function isSpace(value: unknown): value is Space {
  if (!value || typeof value !== 'object') return false
  const space = value as Partial<Space>
  return space.v === 1
    && typeof space.id === 'string'
    && typeof space.displayName === 'string'
    && Array.isArray(space.people)
    && Array.isArray(space.incomes)
    && Array.isArray(space.expenses)
    && Array.isArray(space.goals)
    && Array.isArray(space.contributions)
    && Array.isArray(space.templates)
    && Array.isArray(space.budgets)
    && Array.isArray(space.reviews)
}
