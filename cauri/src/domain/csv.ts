import { exponent } from './money'
import { inPeriod, type Period } from './period'
import { categoryLabel, incomeKindLabel, type Currency, type Space } from './types'

function cell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function amountCell(amount: number, currency: Currency): string {
  const digits = exponent(currency)
  const major = amount / 10 ** digits
  return digits === 0 ? String(major) : major.toFixed(digits).replace('.', ',')
}

export function monthCsv(space: Space, period: Period): string {
  const people = new Map(space.people.map((person) => [person.id, person.name]))
  const lines = [['type', 'date', 'titre', 'montant', 'detail', 'personne', 'note']]
  for (const income of space.incomes.filter((item) => inPeriod(item.date, period))) {
    lines.push([
      'revenu',
      income.date,
      income.title,
      amountCell(income.amount, space.currency),
      incomeKindLabel(income.kind),
      people.get(income.personId) ?? '',
      income.note ?? '',
    ])
  }
  for (const expense of space.expenses.filter((item) => inPeriod(item.date, period))) {
    lines.push([
      'depense',
      expense.date,
      expense.title,
      amountCell(expense.amount, space.currency),
      `${categoryLabel(expense.category)} · ${expense.nature}`,
      people.get(expense.personId) ?? '',
      expense.note ?? '',
    ])
  }
  for (const contribution of space.contributions.filter((item) => inPeriod(item.date, period))) {
    const goal = space.goals.find((item) => item.id === contribution.goalId)
    lines.push([
      'versement',
      contribution.date,
      goal?.title ?? 'Objectif',
      amountCell(contribution.amount, space.currency),
      'objectif',
      '',
      contribution.note ?? '',
    ])
  }
  return `\uFEFF${lines.map((line) => line.map(cell).join(';')).join('\n')}`
}
