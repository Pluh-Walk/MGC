import { Request, Response } from 'express'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import pool from '../config/db'

// ─── Get all reviews for an attorney ──────────────────────
export const getAttorneyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.id AS client_id, u.fullname AS client_name
       FROM attorney_reviews r
       JOIN users u ON u.id = r.client_id
       WHERE r.attorney_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    )

    const [[agg]] = await pool.query<RowDataPacket[]>(
      `SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS total
       FROM attorney_reviews WHERE attorney_id = ?`,
      [id]
    )

    res.json({ success: true, data: rows, avg_rating: agg.avg_rating ?? 0, total: agg.total ?? 0 })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Get the logged-in client's review for an attorney ────
export const getMyReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, rating, comment FROM attorney_reviews WHERE attorney_id = ? AND client_id = ?`,
      [id, user.id]
    )

    res.json({ success: true, data: rows[0] ?? null })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Submit / update a review (client only) ───────────────
export const submitReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params
    const { rating, comment } = req.body

    if (Number(id) === user.id) {
      res.status(400).json({ success: false, message: 'You cannot review yourself.' })
      return
    }
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' })
      return
    }

    await pool.query<ResultSetHeader>(
      `INSERT INTO attorney_reviews (attorney_id, client_id, rating, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = NOW()`,
      [id, user.id, rating, comment ?? null]
    )

    res.json({ success: true, message: 'Review submitted.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}

// ─── Delete own review (client only) ─────────────────────
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { id } = req.params

    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM attorney_reviews WHERE attorney_id = ? AND client_id = ?`,
      [id, user.id]
    )

    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: 'No review found to delete.' })
      return
    }

    res.json({ success: true, message: 'Review deleted.' })
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message })
  }
}
