import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import pool from '../config/db'
import { getEffectiveAttorneyId } from '../utils/scope'

// ─── GET /api/cases/export?format=csv  — CSV export ───────────────
export const exportCases = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    if (user.role === 'client') { res.status(403).json({ success: false, message: 'Access denied.' }); return }

    const eid = getEffectiveAttorneyId(user)
    const { format = 'csv', status, case_type } = req.query

    let where = `c.deleted_at IS NULL`
    const params: any[] = []

    if (user.role === 'attorney' || user.role === 'secretary') {
      where += ` AND c.attorney_id = ?`; params.push(eid)
    }
    if (status)    { where += ` AND c.status = ?`;    params.push(status) }
    if (case_type) { where += ` AND c.case_type = ?`; params.push(case_type) }

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT c.case_number, c.title, c.case_type, c.status,
              c.docket_number, c.opposing_party, c.opposing_counsel,
              c.retainer_amount,
              a.fullname AS attorney,
              cl.fullname AS client_name,
              c.created_at, c.closed_at
       FROM cases c
       JOIN users a  ON a.id  = c.attorney_id
       JOIN users cl ON cl.id = c.client_id
       WHERE ${where}
       ORDER BY c.created_at DESC`,
      params
    )

    if (format === 'csv') {
      const cols = [
        'case_number','title','case_type','status','priority',
        'docket_number','opposing_party','opposing_counsel',
        'retainer_amount','attorney','client_name','created_at','closed_at'
      ]
      const escape = (v: any) => {
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return /[,"\n]/.test(s) ? `"${s}"` : s
      }
      const lines = [cols.join(',')]
      for (const row of rows) {
        lines.push(cols.map(c => escape(row[c])).join(','))
      }
      const filename = `cases_export_${new Date().toISOString().slice(0,10)}.csv`
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send('\uFEFF' + lines.join('\r\n'))
      return
    }

    res.status(400).json({ success: false, message: 'Unsupported format. Use format=csv.' })
  } catch (err) {
    console.error('exportCases:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}

// ─── GET /api/cases/:caseId/export  — full case printout (HTML) ────
export const exportCaseDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user
    const { caseId } = req.params

    const [caseRows] = await pool.query<RowDataPacket[]>(
      `SELECT c.*,
              a.fullname AS attorney_name,
              cl.fullname AS client_name
       FROM cases c
       JOIN users a  ON a.id  = c.attorney_id
       JOIN users cl ON cl.id = c.client_id
       WHERE c.id = ? AND c.deleted_at IS NULL`,
      [caseId]
    )
    if (!caseRows.length) { res.status(404).json({ success: false, message: 'Case not found.' }); return }
    const c = caseRows[0]

    const eid = getEffectiveAttorneyId(user)
    if (user.role === 'client' && c.client_id !== user.id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }
    if ((user.role === 'attorney' || user.role === 'secretary') && eid !== c.attorney_id) {
      res.status(403).json({ success: false, message: 'Access denied.' }); return
    }

    const [parties]   = await pool.query<RowDataPacket[]>(`SELECT * FROM case_parties  WHERE case_id = ?`, [caseId])
    const [deadlines] = await pool.query<RowDataPacket[]>(`SELECT * FROM case_deadlines WHERE case_id = ? ORDER BY due_date`, [caseId])
    const [notes]     = await pool.query<RowDataPacket[]>(`SELECT cn.*, u.fullname AS author FROM case_notes cn JOIN users u ON u.id = cn.author_id WHERE cn.case_id = ? ORDER BY cn.created_at`, [caseId])
    const [docs]      = await pool.query<RowDataPacket[]>(`SELECT d.original_name, d.category, d.privilege_type, d.uploaded_at FROM documents d WHERE d.case_id = ? AND d.deleted_at IS NULL ORDER BY d.uploaded_at`, [caseId])

    const f = (dt: any) => dt ? new Date(dt).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'2-digit' }) : '—'

    const deadlineRows = (deadlines as RowDataPacket[]).map(d =>
      `<tr><td>${d.title}</td><td>${d.deadline_type}</td><td>${f(d.due_date)}</td><td>${d.is_completed ? '✔ Done' : new Date(d.due_date) < new Date() ? '⚠ Overdue' : 'Pending'}</td></tr>`
    ).join('')

    const partyRows = (parties as RowDataPacket[]).map(p =>
      `<tr><td>${p.fullname}</td><td>${p.party_type}</td><td>${p.organization ?? ''}</td></tr>`
    ).join('')

    const noteRows = (notes as RowDataPacket[]).map(n =>
      `<li><strong>${n.author}</strong> (${f(n.created_at)}): ${n.content}</li>`
    ).join('')

    const docRows = (docs as RowDataPacket[]).map(d =>
      `<tr><td>${d.original_name}</td><td>${d.category}</td><td>${d.privilege_type}</td><td>${f(d.uploaded_at)}</td></tr>`
    ).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Case Report — ${c.case_number}</title>
  <style>
    body{font-family:Arial,sans-serif;margin:2cm;color:#222;font-size:12pt}
    h1{font-size:18pt;margin-bottom:4px}
    h2{font-size:13pt;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:24px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    th,td{border:1px solid #ccc;padding:5px 8px;text-align:left;font-size:11pt}
    th{background:#f0f0f0}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-top:8px}
    .info-grid dt{font-weight:bold}
    .info-grid dd{margin:0 0 6px}
    ul{padding-left:20px}
    ul li{margin-bottom:6px}
    @media print{button{display:none}}
  </style>
</head>
<body>
<button onclick="window.print()" style="float:right;margin-bottom:16px;padding:6px 16px">Print / Save PDF</button>
<h1>Case Report</h1>
<p style="color:#555;font-size:10pt">Generated: ${new Date().toLocaleString('en-PH')}</p>

<h2>Case Overview</h2>
<dl class="info-grid">
  <dt>Case Number</dt><dd>${c.case_number}</dd>
  <dt>Title</dt><dd>${c.title}</dd>
  <dt>Type</dt><dd>${c.case_type}</dd>
  <dt>Status</dt><dd>${c.status}</dd>
  <dt>Priority</dt><dd>${c.priority ?? '—'}</dd>
  <dt>Docket Number</dt><dd>${c.docket_number ?? '—'}</dd>
  <dt>Attorney</dt><dd>${c.attorney_name}</dd>
  <dt>Client</dt><dd>${c.client_name}</dd>
  <dt>Opposing Party</dt><dd>${c.opposing_party ?? '—'}</dd>
  <dt>Opposing Counsel</dt><dd>${c.opposing_counsel ?? '—'}</dd>
  <dt>Retainer Amount</dt><dd>${c.retainer_amount ? `₱${Number(c.retainer_amount).toLocaleString('en-PH',{minimumFractionDigits:2})}` : '—'}</dd>
  <dt>Filed</dt><dd>${f(c.created_at)}</dd>
  <dt>Closed</dt><dd>${f(c.closed_at)}</dd>
  ${c.outcome ? `<dt>Outcome</dt><dd>${c.outcome}</dd>` : ''}
  ${c.outcome_notes ? `<dt>Outcome Notes</dt><dd>${c.outcome_notes}</dd>` : ''}
</dl>

${c.description ? `<h2>Description</h2><p>${c.description}</p>` : ''}

<h2>Parties (${(parties as RowDataPacket[]).length})</h2>
${partyRows ? `<table><thead><tr><th>Name</th><th>Type</th><th>Representation</th></tr></thead><tbody>${partyRows}</tbody></table>` : '<p>No parties on record.</p>'}

<h2>Deadlines (${(deadlines as RowDataPacket[]).length})</h2>
${deadlineRows ? `<table><thead><tr><th>Title</th><th>Type</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${deadlineRows}</tbody></table>` : '<p>No deadlines on record.</p>'}

<h2>Documents (${(docs as RowDataPacket[]).length})</h2>
${docRows ? `<table><thead><tr><th>File Name</th><th>Category</th><th>Privilege</th><th>Uploaded</th></tr></thead><tbody>${docRows}</tbody></table>` : '<p>No documents on record.</p>'}

<h2>Notes (${(notes as RowDataPacket[]).length})</h2>
${noteRows ? `<ul>${noteRows}</ul>` : '<p>No notes on record.</p>'}
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (err) {
    console.error('exportCaseDetail:', err)
    res.status(500).json({ success: false, message: 'Server error.' })
  }
}
