import { describe, expect, it } from 'vitest'
import { addContribution, addExpense, addGoal, addIncome, pointTemplate } from './edit'
import { summarize, verdict } from './insights'
import { periodContaining } from './period'
import { blankSpace, type Space, type Template } from './types'

const today = '2026-10-10'
const period = periodContaining(today, 1)

function space(): Space {
  return blankSpace('space-1', 'Amina', '2026-10-01')
}

describe('bilan', () => {
  it('calcule le reste, le rythme du jour et la projection', () => {
    let book = space()
    const personId = book.people[0].id
    book = addIncome(book, {
      title: 'Salaire',
      amount: 300_000,
      date: '2026-10-02',
      personId,
      kind: 'salaire',
      recurring: true,
    })
    book = addExpense(book, {
      title: 'Marché',
      amount: 60_000,
      date: '2026-10-04',
      personId,
      category: 'nourriture',
      nature: 'besoin',
      recurring: false,
    })
    book = addExpense(book, {
      title: 'Sortie',
      amount: 40_000,
      date: '2026-10-06',
      personId,
      category: 'loisirs',
      nature: 'envie',
      recurring: false,
    })
    book = addGoal(book, { title: 'Scolarité', target: 80_000, monthlyPlan: 20_000 }, today)
    book = addContribution(book, book.goals[0].id, 20_000, '2026-10-07')

    const summary = summarize(book, period, today)
    expect(summary.income).toBe(300_000)
    expect(summary.expenses).toBe(100_000)
    expect(summary.contributions).toBe(20_000)
    expect(summary.leftover).toBe(180_000)
    expect(summary.needs).toBe(60_000)
    expect(summary.wants).toBe(40_000)
    expect(summary.daysElapsed).toBe(10)
    expect(summary.daysLeft).toBe(22)
    expect(summary.dailyAllowance).toBe(Math.round(180_000 / 22))
    expect(summary.projection).toBe(Math.round(300_000 - (100_000 / 10) * 31 - 20_000))
    expect(summary.missing).toHaveLength(0)
    expect(summary.goals[0].onTrack).toBe(true)
    expect(summary.byPerson[0].expenses).toBe(100_000)
    book = addExpense(book, {
      title: 'Scolarité',
      amount: 5_000,
      date: '2026-10-20',
      personId,
      category: 'etudes',
      nature: 'besoin',
      when: 'a_venir',
      recurring: false,
    })
    const withPlan = summarize(book, period, today)
    expect(withPlan.expenses).toBe(100_000)
    expect(withPlan.upcoming).toBe(5_000)
    expect(withPlan.leftover).toBe(180_000)
  })

  it('signale un prévu non pointé et un objectif en retard', () => {
    let book = space()
    const personId = book.people[0].id
    const template: Template = {
      id: 'loyer',
      kind: 'expense',
      title: 'Loyer',
      amount: 40_000,
      dayOfMonth: 5,
      personId,
      category: 'logement',
      nature: 'besoin',
      active: true,
    }
    book = { ...book, templates: [template] }
    book = addIncome(book, {
      title: 'Salaire',
      amount: 200_000,
      date: '2026-10-01',
      personId,
      kind: 'salaire',
      recurring: false,
    })
    book = addGoal(book, { title: 'Téléphone', target: 90_000, deadline: '2026-12-01' }, today)
    const summary = summarize(book, period, today)
    expect(summary.missing.map((item) => item.title)).toEqual(['Loyer'])
    expect(summary.goals[0].planned).toBe(true)
    expect(summary.goals[0].onTrack).toBe(false)
    expect(verdict(summary).tone).toBe('wait')

    book = pointTemplate(book, template, period)
    const pointed = summarize(book, period, today)
    expect(pointed.missing).toHaveLength(0)
    expect(pointed.expenses).toBe(40_000)
    expect(verdict(pointed).tone).toBe('short')
  })

  it('dit quand le mois est tenu', () => {
    let book = space()
    const personId = book.people[0].id
    book = addIncome(book, {
      title: 'Salaire',
      amount: 100_000,
      date: '2026-10-01',
      personId,
      kind: 'salaire',
      recurring: false,
    })
    book = addExpense(book, {
      title: 'Repas',
      amount: 20_000,
      date: '2026-10-03',
      personId,
      category: 'nourriture',
      nature: 'besoin',
      recurring: false,
    })
    expect(verdict(summarize(book, period, today)).tone).toBe('good')
  })
})
