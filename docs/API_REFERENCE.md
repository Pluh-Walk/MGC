# MGC Legal Case Management — API Reference

> Base URL: `http://localhost:5000/api`

## Authentication

All authenticated endpoints require the header:

```
Authorization: Bearer <jwt_token>
```

SSE endpoints (`/notifications/stream`) also accept `?token=<jwt>` as a query parameter.

### Standard Response Shapes

**Success:** `{ success: true, data?: any, message?: string }`  
**Error:** `{ success: false, message: string }`

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized (invalid / expired token) |
| 403 | Forbidden (wrong role or suspended) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 422 | Unprocessable Entity (validation failure) |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Middleware Reference

| Name | Description |
|------|-------------|
| `verifyToken` | Validates JWT, checks user is active in DB. Rejects suspended/inactive. |
| `sseVerifyToken` | Same as verifyToken but also reads token from `?token=` query param. |
| `requireRole(...roles)` | Returns 403 if the user's role is not in the allowed list. |
| `requireAttorneyScope` | For secretaries, resolves the linked attorney and injects `req.user.attorneyId`. Attorneys, admins, and clients pass through. |

---

## Auth (`/api/auth`) — Rate limited: 20 req / 15 min

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login |
| GET | `/auth/me` | verifyToken | Get current user info |
| POST | `/auth/verify-ibp` | No | Attorney IBP card verification (multipart) |
| POST | `/auth/verify-client-id` | No | Client ID verification (multipart) |

### POST `/auth/register`

**Body:** `{ fullname, username, email, password, confirmPassword, role: "attorney" | "client" }`  
**Response 201:** `{ success, message, userId }`

### POST `/auth/login`

**Body:** `{ identifier, password }` — identifier can be username or email  
**Response 200:** `{ success, message, token, user: { id, fullname, username, email, role, status } }`

### GET `/auth/me`

**Response 200:** `{ success, data: { id, fullname, username, email, role, status, created_at } }`

### POST `/auth/verify-ibp`

**Multipart:** field `ibp_card` (image), field `userId`  
**Response 200:** `{ success, message }`

### POST `/auth/verify-client-id`

**Multipart:** field `id_image` (image), field `userId`  
**Response 200:** `{ success, message }`

---

## Password Reset (`/api/password-reset`) — Rate limited: 5 req / 1 hr

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/password-reset/request` | No | Request reset email |
| POST | `/password-reset/reset` | No | Reset password with token |

### POST `/password-reset/request`

**Body:** `{ email }`  
**Response 200:** `{ success, message }` — always 200 to prevent enumeration

### POST `/password-reset/reset`

**Body:** `{ token, password, confirmPassword }`  
**Response 200:** `{ success, message }`

---

## Cases (`/api/cases`) — Requires: verifyToken + requireAttorneyScope

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/cases` | attorney | Create a case |
| GET | `/cases` | attorney, client, admin, secretary | List cases |
| GET | `/cases/:id` | attorney, client, admin, secretary | Case detail with timeline & notes |
| PUT | `/cases/:id` | attorney, secretary | Update a case |
| DELETE | `/cases/:id` | attorney | Delete a case |
| GET | `/cases/clients` | attorney | List attorney's clients |
| POST | `/cases/:id/notes` | attorney, secretary | Add a case note |

### POST `/cases`

**Body:** `{ title, case_type, client_id, court_name?, judge_name?, filing_date? }`  
**Response 201:** `{ success, message, caseId, case_number }`

### GET `/cases`

**Query:** `status?, search?, page?, limit?`  
**Response 200:** `{ success, data: [...], total, page, limit }`

### GET `/cases/:id`

**Response 200:** `{ success, data: { ...case_data, timeline: [], notes: [] } }`

### PUT `/cases/:id`

**Body:** `{ title?, case_type?, status?, court_name?, judge_name?, filing_date? }`  
**Response 200:** `{ success, message }`

### POST `/cases/:id/notes`

**Body:** `{ content, is_private? }`  
**Response 201:** `{ success, message, noteId }`

---

## Messages (`/api/messages`) — Requires: verifyToken + requireAttorneyScope

| Method | Path | Description |
|--------|------|-------------|
| GET | `/messages` | List conversations |
| GET | `/messages/contacts` | List available contacts |
| GET | `/messages/:partnerId` | Get message thread |
| POST | `/messages` | Send message (multipart) |
| PUT | `/messages/:id` | Edit message |
| DELETE | `/messages/:id` | Delete message |
| DELETE | `/messages/conversation/:partnerId` | Delete conversation |
| GET | `/messages/:id/attachment` | Download attachment (sseVerifyToken) |

### GET `/messages`

**Response 200:** `{ success, data: [{ partner_id, partner_name, partner_username, partner_role, last_message, last_at, unread_count }] }`

### GET `/messages/:partnerId`

**Response 200:** `{ success, data: [{ id, sender_id, receiver_id, content, is_read, created_at, attachment_path, attachment_name, edited_at, sent_on_behalf_of, sender_name, attorney_name }] }`

### POST `/messages`

**Multipart:** fields `receiver_id`, `content?`, `case_id?`; file `attachment?`  
**Response 201:** `{ success, data: { id } }`

### PUT `/messages/:id`

**Body:** `{ content }`  
**Response 200:** `{ success }`

### DELETE `/messages/:id`

**Body:** `{ type: "for_me" | "for_everyone" }`  
**Response 200:** `{ success }`

---

## Hearings (`/api/hearings`) — Requires: verifyToken + requireAttorneyScope

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/hearings` | all | List hearings |
| POST | `/hearings` | attorney, secretary | Create hearing |
| PUT | `/hearings/:id` | attorney, secretary | Update hearing |
| DELETE | `/hearings/:id` | attorney | Delete hearing |

### POST `/hearings`

**Body:** `{ case_id, title, hearing_type?, scheduled_at, location?, notes? }`  
**Response 201:** `{ success, data: { id } }`

### PUT `/hearings/:id`

**Body:** `{ title?, hearing_type?, scheduled_at?, location?, notes?, status? }`  
**Response 200:** `{ success }`

---

## Announcements (`/api/announcements`) — Requires: verifyToken + requireAttorneyScope

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/announcements` | all | List announcements |
| POST | `/announcements` | attorney, admin, secretary | Create announcement |
| DELETE | `/announcements/:id` | attorney, admin | Delete announcement |

### POST `/announcements`

**Body:** `{ title, body, case_id? }`  
**Response 201:** `{ success, data: { id } }`

---

## Documents (`/api`) — Requires: verifyToken + requireAttorneyScope

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/cases/:caseId/documents` | attorney, secretary | Upload document (multipart) |
| GET | `/cases/:caseId/documents` | all | List case documents |
| GET | `/documents/:id/download` | all | Download document |
| DELETE | `/documents/:id` | attorney | Delete document |

### POST `/cases/:caseId/documents`

**Multipart:** file field, body `{ category?, is_client_visible? }`  
**Response 201:** `{ success, message, documentId }`

---

## Notifications (`/api/notifications`) — Requires: verifyToken + requireAttorneyScope

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | List notifications |
| PUT | `/notifications/read-all` | Mark all read |
| PUT | `/notifications/:id/read` | Mark one read |
| GET | `/notifications/stream` | SSE stream (sseVerifyToken) |

### GET `/notifications`

**Response 200:** `{ success, data: [...], unread: number }`

### GET `/notifications/stream`

**Query:** `token` (JWT)  
**Response:** `text/event-stream` — pushes `data: { unread }` every 30 s

---

## Profile (`/api/profile`) — Requires: verifyToken + requireAttorneyScope (unless noted)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/profile/me` | all | Get own profile |
| PUT | `/profile/me` | all | Update own profile |
| PUT | `/profile/password` | all | Change password |
| POST | `/profile/photo` | all | Upload profile photo (multipart, ≤ 5 MB) |
| GET | `/profile/photo/:userId` | **public** | Serve profile photo |
| GET | `/profile/attorneys` | client | Browse attorneys |
| GET | `/profile/attorneys/:id/stats` | client | Attorney public stats |
| GET | `/profile/attorney/stats` | attorney, secretary | Own attorney stats |
| GET | `/profile/attorney/activity` | attorney, secretary | Own attorney activity |
| GET | `/profile/client/stats` | client | Own client stats |
| GET | `/profile/client/activity` | client | Own client activity |
| GET | `/profile/client/documents` | client | Own documents |
| POST | `/profile/client/documents` | client | Upload client document (multipart) |

### PUT `/profile/password`

**Body:** `{ currentPassword, newPassword }`  
**Response 200:** `{ success, message }`

---

## Reviews (`/api/reviews`) — Requires: verifyToken

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/reviews/attorneys/:id` | all | Get attorney reviews |
| GET | `/reviews/attorneys/:id/mine` | client | Get my review |
| POST | `/reviews/attorneys/:id` | client | Submit review |
| DELETE | `/reviews/attorneys/:id` | client | Delete my review |

### POST `/reviews/attorneys/:id`

**Body:** `{ rating: 1-5, comment? }`  
**Response 200:** `{ success, message }`

---

## Secretary Management (`/api/secretaries`)

| Method | Path | Auth | Roles | Description |
|--------|------|------|-------|-------------|
| GET | `/secretaries/invite/validate` | No | — | Validate invitation token |
| POST | `/secretaries/register` | No | — | Register via invitation |
| POST | `/secretaries/invite` | Yes | attorney | Send invitation email |
| GET | `/secretaries` | Yes | attorney | List my secretaries & invitations |
| PUT | `/secretaries/:id/remove` | Yes | attorney | Remove a secretary |
| DELETE | `/secretaries/invite/:id` | Yes | attorney | Revoke a pending invitation |

### GET `/secretaries/invite/validate`

**Query:** `token`  
**Response 200:** `{ success, invitation: { email, attorney_name } }`

### POST `/secretaries/register`

**Body:** `{ token, fullname, username, password, confirmPassword }`  
**Response 201:** `{ success, message, token, user: { id, fullname, username, email, role, status } }`

### POST `/secretaries/invite`

**Body:** `{ email }`  
**Response 201:** `{ success, message, inviteLink }`

### GET `/secretaries`

**Response 200:** `{ success, secretaries: [...], invitations: [...] }`

---

## Admin — Dashboard & Users (`/api/admin`) — Requires: verifyToken + requireRole('admin')

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/dashboard` | Dashboard statistics |
| GET | `/admin/users` | List users (paginated) |
| POST | `/admin/users` | Create user |
| GET | `/admin/users/:id` | User detail + profile + recent audit |
| PUT | `/admin/users/:id` | Update user |
| PUT | `/admin/users/:id/suspend` | Suspend user |
| PUT | `/admin/users/:id/reactivate` | Reactivate user |
| PUT | `/admin/users/:id/reset-password` | Reset user's password |
| DELETE | `/admin/users/:id` | Delete user |
| GET | `/admin/users/:id/suspensions` | Suspension history |
| GET | `/admin/users/:id/login-attempts` | Login attempt history |

### GET `/admin/dashboard`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "users": { "by_role": [...], "by_status": [...], "active_last_7_days": 0, "pending_verifications": 0 },
    "cases": { "by_status": [...], "total": 0 },
    "recent_activity": [...],
    "login_stats_24h": 0
  }
}
```

### GET `/admin/users`

**Query:** `role?, status?, search?, verified?, page, limit`  
**Response 200:** `{ success, data: [...], total, page, limit }`

### POST `/admin/users`

**Body:** `{ fullname, username, email, password, role }`  
**Response 201:** `{ success, data: { id } }`  
**Notes:** Only an admin can create another admin account.

### PUT `/admin/users/:id`

**Body:** `{ fullname?, email?, role?, status? }`  
**Response 200:** `{ success, message }`  
**Notes:** Cannot elevate a non-admin user to admin role.

### PUT `/admin/users/:id/suspend`

**Body:** `{ reason }` (required)  
**Response 200:** `{ success, message }`

### PUT `/admin/users/:id/reset-password`

**Body:** `{ newPassword }`  
**Response 200:** `{ success, message }`

---

## Admin — Verification Queue (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/verifications` | Pending verifications |
| PUT | `/admin/verifications/:id` | Approve or reject |

### GET `/admin/verifications`

**Query:** `type?: "attorney" | "client"`  
**Response 200:** `{ success, data: [{ id, fullname, email, role, created_at, ibp_number?, ibp_card_path?, id_type?, id_number?, id_photo_path? }] }`

### PUT `/admin/verifications/:id`

**Body:** `{ action: "approve" | "reject", reason? }`  
**Response 200:** `{ success, message }`

---

## Admin — Case Management (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/cases` | List all cases (paginated) |
| PUT | `/admin/cases/:id/reassign` | Reassign to another attorney |
| PUT | `/admin/cases/:id/archive` | Force-archive a case |

### GET `/admin/cases`

**Query:** `status?, search?, page, limit`  
**Response 200:** `{ success, data: [...], total, page, limit }`

### PUT `/admin/cases/:id/reassign`

**Body:** `{ attorney_id }`  
**Response 200:** `{ success, message }`

---

## Admin — Reports (`/api/admin`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/reports/users` | User registration & login analytics |
| GET | `/admin/reports/cases` | Case analytics by month, type, attorney |

### GET `/admin/reports/users`

**Response 200:** `{ success, data: { registrations: [], logins: [], top_active_users: [] } }`

### GET `/admin/reports/cases`

**Response 200:** `{ success, data: { cases_by_month: [], cases_by_type: [], attorney_workload: [] } }`

---

## Admin — Settings (`/api/admin/settings`) — Requires: verifyToken + requireRole('admin')

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/settings` | List all settings |
| GET | `/admin/settings/:key` | Get one setting |
| PUT | `/admin/settings/:key` | Update one setting |
| PUT | `/admin/settings` | Bulk update settings |

### PUT `/admin/settings/:key`

**Body:** `{ value }`  
**Response 200:** `{ success, message }`

### PUT `/admin/settings` (bulk)

**Body:** `{ settings: [{ key, value }] }`  
**Response 200:** `{ success, message }`

---

## Admin — Audit Logs (`/api/admin/audit`) — Requires: verifyToken + requireRole('admin')

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/audit` | Query audit logs (paginated) |
| GET | `/admin/audit/export` | Export as CSV |
| GET | `/admin/audit/stats` | Audit statistics |

### GET `/admin/audit`

**Query:** `user_id?, action?, target_type?, search?, from?, to?, page, limit`  
**Response 200:** `{ success, data: [...], total, page, limit }`

### GET `/admin/audit/export`

**Query:** `from?, to?, action?, user_id?`  
**Response 200:** CSV file download

---

## Role & Scope Rules

| Role | Scope |
|------|-------|
| **admin** | Full system access. All users, all cases, settings, audit logs. |
| **attorney** | Own cases, own clients, own secretaries, messaging, hearings, announcements. |
| **secretary** | Same as linked attorney (resolved via `requireAttorneyScope`). Cannot delete cases, cannot mark notes private. Messages show `sent_on_behalf_of`. |
| **client** | Own cases (read-only), own documents, messaging with assigned attorney, reviews. |

## Pagination

All list endpoints accept `page` (1-based, default 1) and `limit` (default varies by endpoint) query parameters. Paginated responses include `total`, `page`, and `limit` fields alongside `data`.

## Rate Limiting

| Endpoint Group | Limit |
|---------------|-------|
| `/api/auth/*` | 20 requests per 15 minutes |
| `/api/password-reset/*` | 5 requests per 1 hour |
