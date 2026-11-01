import { diffDays, inPeriod, monthsLeft, type Period } from './period'
import { expenseWhen, type CategoryId, type Goal, type Space } from './types'

export interface GoalProgress {
  goal: Goal
  saved: number
  remaining: number
  suggested: number
  contributed: number
  reached: boolean
  onTrack: boolean
  planned: boolean
}

export interface CategorySpend {
  category: CategoryId
  spent: number
  needs: number
  wants: number
  limit: number | null
  over: boolean
}

export interface PersonFlow {
  id: string
  name: string
  income: number
  expenses: number
}

export interface Summary {
  income: number
  expenses: number
  upcoming: number
  contributions: number
  leftover: number
  savingsRate: number | null
  needs: number
  wants: number
  needsShare: number | null
  wantsShare: number | null
  savingsShare: number | null
  byCategory: CategorySpend[]
  byPerson: PersonFlow[]
  goals: GoalProgress[]
  missing: Space['templates']
  daysElapsed: number
  daysLeft: number
  viewing: 'past' | 'current' | 'future'
  dailyAllowance: number | null
  projection: number | null
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

export function summarize(space: Space, period: Period, today: string): Summary {
  const incomes = space.incomes.filter((item) => inPeriod(item.date, period))
  const inMonth = space.expenses.filter((item) => inPeriod(item.date, period))
  const expenses = inMonth.filter((item) => expenseWhen(item) === 'faite')
  const upcomingRows = inMonth.filter((item) => expenseWhen(item) === 'a_venir')
  const contributions = space.contributions.filter((item) => inPeriod(item.date, period))
  const income = sum(incomes.map((item) => item.amount))
  const spent = sum(expenses.map((item) => item.amount))
  const upcoming = sum(upcomingRows.map((item) => item.amount))
  const saved = sum(contributions.map((item) => item.amount))
  const needs = sum(expenses.filter((item) => item.nature === 'besoin').map((item) => item.amount))
  const wants = sum(expenses.filter((item) => item.nature === 'envie').map((item) => item.amount))
  const share = (part: number) => (income > 0 ? part / income : null)

  const byCategory = space.budgets
    .map((budget) => budget.category)
    .concat(expenses.map((item) => item.category))
    .filter((category, index, all) => all.indexOf(category) === index)
    .map((category) => {
      const rows = expenses.filter((item) => item.category === category)
      const categorySpent = sum(rows.map((item) => item.amount))
      const limit = space.budgets.find((budget) => budget.category === category)?.limit ?? null
      return {
        category,
        spent: categorySpent,
        needs: sum(rows.filter((item) => item.nature === 'besoin').map((item) => item.amount)),
        wants: sum(rows.filter((item) => item.nature === 'envie').map((item) => item.amount)),
        limit: limit && limit > 0 ? limit : null,
        over: Boolean(limit && limit > 0 && categorySpent > limit),
      }
    })
    .sort((a, b) => b.spent - a.spent)

  const byPerson = space.people.map((person) => ({
    id: person.id,
    name: person.name,
    income: sum(incomes.filter((item) => item.personId === person.id).map((item) => item.amount)),
    expenses: sum(expenses.filter((item) => item.personId === person.id).map((item) => item.amount)),
  }))

  const goals = space.goals
    .map((goal) => goalProgress(space, goal, period, today))
    .sort((a, b) => rankGoal(a) - rankGoal(b) || a.goal.title.localeCompare(b.goal.title, 'fr'))

  const missing = space.templates.filter((template) => {
    if (!template.active) return false
    const rows = template.kind === 'income' ? incomes : expenses
    return !rows.some((row) => row.templateId === template.id)
  })

  const viewing = today < period.start ? 'future' : today > period.end ? 'past' : 'current'
  const daysElapsed = viewing === 'future' ? 0 : viewing === 'past' ? period.days : diffDays(period.start, today) + 1
  const daysLeft = viewing === 'past' ? 0 : viewing === 'future' ? period.days : diffDays(today, period.end) + 1
  const leftover = income - spent - saved
  const dailyAllowance = viewing === 'current' && leftover > 0 && daysLeft > 0
    ? Math.round(leftover / daysLeft)
    : null
  const projection = viewing === 'past'
    ? leftover
    : viewing === 'current' && daysElapsed >= 3 && spent > 0
      ? Math.round(income - (spent / daysElapsed) * period.days - saved)
      : null

  return {
    income,
    expenses: spent,
    upcoming,
    contributions: saved,
    leftover,
    savingsRate: share(saved),
    needs,
    wants,
    needsShare: share(needs),
    wantsShare: share(wants),
    savingsShare: share(saved),
    byCategory,
    byPerson,
    goals,
    missing,
    daysElapsed,
    daysLeft,
    viewing,
    dailyAllowance,
    projection,
  }
}

function rankGoal(progress: GoalProgress): number {
  if (progress.goal.featured) return 0
  if (progress.reached) return 3
  if (progress.goal.paused) return 2
  return 1
}

export function goalProgress(space: Space, goal: Goal, period: Period, today: string): GoalProgress {
  const rows = space.contributions.filter((item) => item.goalId === goal.id)
  const saved = sum(rows.map((item) => item.amount))
  const remaining = Math.max(0, goal.target - saved)
  const contributed = sum(rows.filter((item) => inPeriod(item.date, period)).map((item) => item.amount))
  const reached = goal.target > 0 && saved >= goal.target
  let suggested = 0
  let planned = false
  if (!goal.paused && !reached && remaining > 0) {
    if (goal.monthlyPlan && goal.monthlyPlan > 0) {
      suggested = Math.min(goal.monthlyPlan, remaining)
      planned = true
    } else if (goal.deadline) {
      suggested = Math.ceil(remaining / monthsLeft(today, goal.deadline))
      planned = true
    }
  }
  return {
    goal,
    saved,
    remaining,
    suggested,
    contributed,
    reached,
    onTrack: !planned || contributed >= suggested,
    planned,
  }
}

export interface Verdict {
  tone: 'wait' | 'good' | 'short' | 'over'
  title: string
  detail: string
}

export function verdict(summary: Summary): Verdict {
  if (summary.income === 0 && summary.expenses === 0 && summary.contributions === 0) {
    return {
      tone: 'wait',
      title: 'Ce mois est encore vide.',
      detail: 'Note les revenus, puis chaque dépense avec un titre. Le bilan se remplit tout seul.',
    }
  }
  if (summary.missing.length > 0) {
    const count = summary.missing.length
    return {
      tone: 'wait',
      title: count > 1 ? `${count} prévus manquent encore.` : 'Un prévu manque encore.',
      detail: 'Pointe-les avant de conclure. Comme ça, la fin du mois n’oublie ni un revenu ni une dépense fixe.',
    }
  }
  const overBudget = summary.byCategory.some((item) => item.over)
  const missedGoal = summary.goals.some((item) => item.planned && !item.onTrack && !item.reached)
  if (summary.leftover < 0) {
    return {
      tone: 'over',
      title: 'Les sorties dépassent les entrées.',
      detail: 'Le mois n’est pas tenu. Regarde les envies et les plafonds avant d’ajouter autre chose.',
    }
  }
  if (overBudget) {
    return {
      tone: 'over',
      title: 'Un plafond est dépassé.',
      detail: 'Les comptes sont complets. Certaines catégories ont passé la limite que tu t’étais fixée.',
    }
  }
  if (missedGoal) {
    return {
      tone: 'short',
      title: 'Les objectifs ne sont pas encore remplis.',
      detail: 'Les dépenses tiennent. Il reste à verser ce que tu avais prévu de mettre de côté.',
    }
  }
  return {
    tone: 'good',
    title: 'Ce mois-ci, tu as tenu.',
    detail: summary.goals.some((item) => item.planned)
      ? 'Les prévus sont pointés, les plafonds tiennent, et les versements du mois sont faits.'
      : 'Les prévus sont pointés et les plafonds tiennent. Fixe un objectif si tu veux juger l’épargne aussi.',
  }
}

export function percent(value: number | null): string {
  if (value === null) return '—'
  return `${Math.round(value * 100)}\u00a0%`
}
