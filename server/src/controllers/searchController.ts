/**
 * Global Search Controller — MySQL FULLTEXT search
 *
 * GET /api/search?q=query[&type=cases|users|documents]
 */
import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'

export const globalSearch = async (req: Request, res: Response): Promise<void> => {
  const user  = (req as any).user
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const type  = typeof req.query.type === 'string' ? req.query.type : 'all'

  if (!query || query.length < 2) {
    res.status(400).json({ success: false, message: 'Search query must be at least 2 characters.' })
    return
  }

  // Sanitize query for FULLTEXT boolean mode: strip special chars that break the parser
  const safeFT = query.replace(/[+\-><()~*"@]/g, ' ').trim()
  const likeQ  = `%${query}%`

  const results: { cases: RowDataPacket[]; users: RowDataPacket[]; documents: RowDataPacket[] } = {
    cases: [], users: [], documents: [],
  }

  const eid = getEffectiveAttorneyId(user)

  try {
    // ── Cases ─────────────────────────────────────────────
    if (type === 'all' || type === 'cases') {
      let caseWhere = 'c.deleted_at IS NULL'
      const caseParams: any[] = []

      if (user.role === 'client') {
        caseWhere += ' AND c.client_id = ?'
        caseParams.push(user.id)
      } else if (user.role === 'attorney' || user.role === 'secretary') {
        caseWhere += ' AND c.attorney_id = ?'
        caseParams.push(eid)
      }

      const [cases] = await pool.query<RowDataPacket[]>(
        `SELECT c.id, c.case_number, c.title, c.status, c.case_type,
                cl.fullname AS client_name,
                MATCH(c.title, c.description, c.opposing_party, c.docket_number) AGAINST (? IN BOOLEAN MODE) AS relevance
         FROM cases c
         LEFT JOIN users cl ON cl.id = c.client_id
         WHERE ${caseWhere}
           AND (
             MATCH(c.title, c.description, c.opposing_party, c.docket_number) AGAINST (? IN BOOLEAN MODE)
             OR c.case_number LIKE ?
             OR c.title LIKE ?
             OR c.client_id IN (SELECT id FROM users WHERE fullname LIKE ?)
           )
         ORDER BY relevance DESC LIMIT 10`,
        [safeFT, ...caseParams, safeFT, safeFT, likeQ, likeQ, likeQ]
      )
      results.cases = cases as RowDataPacket[]
    }

    // ── Users (admin sees all; attorney sees their clients) ─
    if ((type === 'all' || type === 'users') && user.role !== 'client') {
      let userWhere = "u.status != 'inactive'"
      const userParams: any[] = [safeFT, safeFT, likeQ, likeQ, likeQ]

      if (user.role === 'attorney' || user.role === 'secretary') {
        // Only show clients belonging to this attorney
        userWhere += ` AND (u.role = 'client' AND u.id IN
          (SELECT DISTINCT client_id FROM cases WHERE attorney_id = ? AND deleted_at IS NULL))`
        userParams.push(eid)
      }

      const [users] = await pool.query<RowDataPacket[]>(
        `SELECT u.id, u.fullname, u.email, u.role, u.status,
                MATCH(u.fullname, u.email, u.username) AGAINST (? IN BOOLEAN MODE) AS relevance
         FROM users u
         WHERE ${userWhere}
           AND (
             MATCH(u.fullname, u.email, u.username) AGAINST (? IN BOOLEAN MODE)
             OR u.fullname LIKE ?
             OR u.email LIKE ?
             OR u.username LIKE ?
           )
         ORDER BY relevance DESC LIMIT 10`,
        userParams
      ).catch(() => [[] as RowDataPacket[]])
      results.users = users as RowDataPacket[]
    }

    // ── Documents ─────────────────────────────────────────
    if (type === 'all' || type === 'documents') {
      let docWhere = 'd.deleted_at IS NULL'
      const docParams: any[] = [safeFT, safeFT, likeQ, likeQ]

      if (user.role === 'client') {
        docWhere += ' AND d.client_visible = 1 AND d.case_id IN (SELECT id FROM cases WHERE client_id = ?)'
        docParams.push(user.id)
      } else if (user.role === 'attorney' || user.role === 'secretary') {
        docWhere += ' AND d.case_id IN (SELECT id FROM cases WHERE attorney_id = ? AND deleted_at IS NULL)'
        docParams.push(eid)
      }

      const [docs] = await pool.query<RowDataPacket[]>(
        `SELECT d.id, d.original_name, d.category, d.case_id,
                c.case_number, c.title AS case_title,
                MATCH(d.original_name) AGAINST (? IN BOOLEAN MODE) AS relevance
         FROM documents d
         LEFT JOIN cases c ON c.id = d.case_id
         WHERE ${docWhere}
           AND (
             MATCH(d.original_name) AGAINST (? IN BOOLEAN MODE)
             OR d.original_name LIKE ?
             OR c.case_number LIKE ?
           )
         ORDER BY relevance DESC LIMIT 10`,
        docParams
      ).catch(() => [[] as RowDataPacket[]])
      results.documents = docs as RowDataPacket[]
    }

    const total = results.cases.length + results.users.length + results.documents.length
    res.json({ success: true, query, total, results })
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Search error.' })
  }
}
