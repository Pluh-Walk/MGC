import { JwtPayload } from '../middleware/auth'

/**
 * Returns a WHERE clause fragment and params to scope case queries by user role.
 * Expects the cases table to be aliased as `c`.
 */
export function getCaseScope(user: JwtPayload): { clause: string; params: any[] } {
  switch (user.role) {
    case 'admin':
      return { clause: '1=1', params: [] }
    case 'attorney':
      return { clause: 'c.attorney_id = ?', params: [user.id] }
    case 'secretary':
      return { clause: 'c.attorney_id = ?', params: [user.attorneyId!] }
    case 'client':
      return { clause: 'c.client_id = ?', params: [user.id] }
  }
}

/**
 * Returns the effective attorney ID for the current user.
 * For attorneys, returns their own ID. For secretaries, returns the linked attorney's ID.
 * Returns null for other roles.
 */
export function getEffectiveAttorneyId(user: JwtPayload): number | null {
  if (user.role === 'attorney') return user.id
  if (user.role === 'secretary') return user.attorneyId ?? null
  return null
}
