import { Request, Response, NextFunction } from 'express'
import { ZodSchema } from 'zod'

/**
 * Express middleware that validates req.body against a Zod schema.
 * On failure, returns 400 with the first validation message.
 * On success, replaces req.body with the parsed (coerced) value.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const issues = result.error.issues
      const first = issues[0]
      res.status(400).json({ success: false, message: first?.message ?? 'Validation failed.' })
      return
    }
    req.body = result.data
    next()
  }
