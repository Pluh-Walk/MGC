import { z } from 'zod'

// ─── Case ─────────────────────────────────────────────────
export const createCaseSchema = z.object({
  title:            z.string().min(2, 'Title must be at least 2 characters.').max(300),
  case_type:        z.string().min(1, 'case_type is required.').max(100),
  client_id:        z.coerce.number().int().positive('client_id must be a positive integer.'),
  court_name:       z.string().max(200).optional().nullable(),
  judge_name:       z.string().max(200).optional().nullable(),
  filing_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'filing_date must be YYYY-MM-DD.').optional().nullable(),
  description:      z.string().max(5000).optional().nullable(),
  docket_number:    z.string().max(100).optional().nullable(),
  opposing_party:   z.string().max(300).optional().nullable(),
  opposing_counsel: z.string().max(300).optional().nullable(),
  retainer_amount:  z.coerce.number().min(0).optional().nullable(),
})

export const updateCaseSchema = z.object({
  title:            z.string().min(2).max(300).optional(),
  case_type:        z.string().max(100).optional(),
  court_name:       z.string().max(200).optional().nullable(),
  judge_name:       z.string().max(200).optional().nullable(),
  filing_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  description:      z.string().max(5000).optional().nullable(),
  docket_number:    z.string().max(100).optional().nullable(),
  opposing_party:   z.string().max(300).optional().nullable(),
  opposing_counsel: z.string().max(300).optional().nullable(),
  retainer_amount:  z.coerce.number().min(0).optional().nullable(),
  status:           z.enum(['active', 'pending', 'closed', 'archived', 'draft']).optional(),
  outcome:          z.string().max(1000).optional().nullable(),
  closed_at:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' })

// ─── Case Note ────────────────────────────────────────────
export const addNoteSchema = z.object({
  content:      z.string().min(1, 'Note content cannot be empty.').max(10000),
  is_private:   z.boolean().optional().default(false),
  is_privileged:z.boolean().optional().default(false),
})

// ─── Billing Entry ────────────────────────────────────────
export const addBillingSchema = z.object({
  entry_type:     z.enum(['hourly', 'flat_fee', 'court_fee', 'filing_fee', 'expense', 'retainer_deduction', 'other']),
  description:    z.string().min(1, 'description is required.').max(500),
  hours:          z.coerce.number().min(0).max(1000).optional().nullable(),
  rate:           z.coerce.number().min(0).optional().nullable(),
  amount:         z.coerce.number().min(0, 'amount must be non-negative.'),
  billing_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'billing_date must be YYYY-MM-DD.').optional(),
  is_billed:      z.boolean().optional().default(false),
  invoice_number: z.string().max(100).optional().nullable(),
  notes:          z.string().max(1000).optional().nullable(),
})

export const updateBillingSchema = addBillingSchema.partial().refine(
  d => Object.keys(d).length > 0, { message: 'At least one field required.' }
)

// ─── Deadline ─────────────────────────────────────────────
export const createDeadlineSchema = z.object({
  title:         z.string().min(1, 'Title is required.').max(300),
  due_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be YYYY-MM-DD.'),
  deadline_type: z.enum([
    'statute_of_limitations','filing_deadline','response_deadline',
    'discovery_deadline','trial_date','hearing_date','pleading_deadline',
    'appeal_deadline','other',
  ]).optional().default('other'),
  priority:      z.enum(['normal', 'high', 'critical']).optional().default('normal'),
  description:   z.string().max(1000).optional().nullable(),
})

export const updateDeadlineSchema = createDeadlineSchema.partial().refine(
  d => Object.keys(d).length > 0, { message: 'At least one field required.' }
)

// ─── Hearing ──────────────────────────────────────────────
export const createHearingSchema = z.object({
  title:        z.string().min(1, 'Title is required.').max(300),
  hearing_type: z.string().max(100).optional().nullable(),
  scheduled_at: z.string().datetime({ message: 'scheduled_at must be an ISO 8601 datetime.' }),
  location:     z.string().max(500).optional().nullable(),
  notes:        z.string().max(2000).optional().nullable(),
  case_id:      z.coerce.number().int().positive(),
})

export const updateHearingSchema = z.object({
  title:        z.string().min(1).max(300).optional(),
  hearing_type: z.string().max(100).optional().nullable(),
  scheduled_at: z.string().datetime().optional(),
  location:     z.string().max(500).optional().nullable(),
  notes:        z.string().max(2000).optional().nullable(),
  status:       z.enum(['scheduled', 'completed', 'postponed', 'cancelled']).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field required.' })

// ─── Party ────────────────────────────────────────────────
export const addPartySchema = z.object({
  name:         z.string().min(1, 'Name is required.').max(200),
  party_type:   z.enum(['plaintiff','defendant','petitioner','respondent','witness','third_party','other']),
  address:      z.string().max(500).optional().nullable(),
  contact:      z.string().max(200).optional().nullable(),
  notes:        z.string().max(1000).optional().nullable(),
})

// ─── Case Tag ─────────────────────────────────────────────
export const createTagSchema = z.object({
  name:  z.string().min(1, 'Tag name is required.').max(50)
           .regex(/^[a-zA-Z0-9 _\-]+$/, 'Tag may only contain letters, numbers, spaces, hyphens and underscores.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'color must be a hex color like #1a2b3c.').optional(),
})

// ─── Message ──────────────────────────────────────────────
export const sendMessageSchema = z.object({
  receiver_id: z.coerce.number().int().positive('receiver_id must be a positive integer.'),
  content:     z.string().max(10000).optional().nullable(),
  // attachment is handled by multer, not validated here
}).refine(d => d.content?.trim() || true, { message: 'Message cannot be blank without an attachment.' })

// ─── Announcement ─────────────────────────────────────────
export const createAnnouncementSchema = z.object({
  title:   z.string().min(1, 'Title is required.').max(300),
  body:    z.string().min(1, 'Body is required.').max(10000),
  case_id: z.coerce.number().int().positive().optional().nullable(),
})

// ─── Admin: create user ───────────────────────────────────
export const adminCreateUserSchema = z.object({
  fullname: z.string().min(2).max(100),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  email:    z.string().email().max(254),
  password: z.string().min(8).max(128),
  role:     z.enum(['attorney', 'client', 'secretary', 'admin']),
})

// ─── Admin: suspend user ──────────────────────────────────
export const suspendUserSchema = z.object({
  reason: z.string().min(5, 'Reason must be at least 5 characters.').max(500),
})

// ─── Password Reset ───────────────────────────────────────
export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address.'),
})

export const resetPasswordSchema = z
  .object({
    token:           z.string().min(1, 'Token is required.'),
    password:        z.string().min(8, 'Password must be at least 8 characters.').max(128),
    confirmPassword: z.string(),
  })
  .refine(d => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

// ─── Settings ─────────────────────────────────────────────
export const updateSettingSchema = z.object({
  key:   z.string().min(1, 'key is required.').max(100),
  value: z.string().max(1000),
})

// ─── Task Management ─────────────────────────────────────
export const createTaskSchema = z.object({
  title:       z.string().min(1, 'Title is required.').max(300),
  description: z.string().max(2000).optional().nullable(),
  assigned_to: z.coerce.number().int().positive().optional().nullable(),
  due_date:    z.string().optional().nullable(),
  priority:    z.enum(['low','normal','high','critical']).optional().default('normal'),
})
export const updateTaskSchema = createTaskSchema.partial().refine(
  (d) => Object.keys(d).length > 0,
  { message: 'At least one field required.' }
)

// ─── Time Entry ───────────────────────────────────────────
export const createTimeEntrySchema = z.object({
  description: z.string().min(1, 'description is required.').max(500),
  started_at:  z.string().datetime().optional(),
  ended_at:    z.string().datetime().optional().nullable(),
  duration_sec:z.coerce.number().int().min(0).optional().nullable(),
  is_billable: z.boolean().optional().default(true),
})
