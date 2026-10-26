import { useEffect, useState, type ReactNode } from 'react'
import type { Space } from './domain/types'

export function Mark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#231e19" />
      <ellipse cx="16" cy="16" rx="8" ry="10" fill="#f4e4d4" />
      <path d="M14.2 11.5c2.2 2 2.2 7 0 9" fill="none" stroke="#231e19" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function Brand({ href = '#/' }: { href?: string }) {
  return (
    <a className="brand" href={href}>
      <Mark />
      <span>Cauri</span>
    </a>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function personName(space: Space, id?: string): string {
  if (!id) return 'Tout l’espace'
  return space.people.find((person) => person.id === id)?.name ?? 'Personne'
}

export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}
