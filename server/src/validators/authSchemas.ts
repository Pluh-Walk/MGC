import { z } from 'zod'

// ─── Login ────────────────────────────────────────────────
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required.').max(254),
  password:   z.string().min(1, 'Password is required.').max(128),
})

// ─── Register ─────────────────────────────────────────────
export const registerSchema = z
  .object({
    fullname:        z.string().min(2, 'Full name must be at least 2 characters.').max(100),
    username:        z
      .string()
      .min(3, 'Username must be at least 3 characters.')
      .max(50)
      .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores.'),
    email:           z.string().email('Invalid email format.').max(254),
    password:        z.string().min(8, 'Password must be at least 8 characters.').max(128),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
    role:            z.enum(['attorney', 'client'] as const, {
      error: 'Role must be attorney or client.',
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })
