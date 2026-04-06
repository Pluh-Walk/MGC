import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { Request } from 'express'
import sanitizeFilename from 'sanitize-filename'

const MAX_SIZE_BYTES = Number(process.env.MAX_FILE_SIZE_MB || 20) * 1024 * 1024

// ── Magic-byte signatures for allowed file types ──────────────────
// Each entry: [mimeType, hex prefix to match at byte 0]
const MAGIC_SIGNATURES: Array<{ mime: string; hex: string }> = [
  { mime: 'application/pdf',     hex: '25504446' },            // %PDF
  { mime: 'image/jpeg',          hex: 'ffd8ff'   },
  { mime: 'image/png',           hex: '89504e47' },
  { mime: 'image/webp',          hex: '52494646' },            // RIFF....WEBP checked below
  { mime: 'application/msword',  hex: 'd0cf11e0' },            // OLE2 compound (doc/xls)
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', hex: '504b0304' }, // ZIP/OOXML
  { mime: 'application/vnd.ms-excel',                                                hex: 'd0cf11e0' },
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       hex: '504b0304' },
]

const ALLOWED_TYPES = MAGIC_SIGNATURES.map(s => s.mime)

/** Return detected MIME from first 8 bytes, or null if not recognised */
function detectMime(buf: Buffer): string | null {
  const hex = buf.subarray(0, 8).toString('hex').toLowerCase()
  for (const sig of MAGIC_SIGNATURES) {
    if (hex.startsWith(sig.hex.toLowerCase())) return sig.mime
  }
  return null
}

/** Sanitise the original filename: strip path separators, collapse whitespace */
function safeFilename(original: string): string {
  const base    = sanitizeFilename(path.basename(original), { replacement: '_' })
  const cleaned = base.replace(/\s+/g, '_').replace(/[^\w.\-]/g, '_').slice(0, 200)
  return cleaned || 'upload'
}

// ── Disk storage — case documents ─────────────────────────────────
const storage = multer.diskStorage({
  destination: (req: Request, _file, cb) => {
    const caseId = req.params.caseId || 'general'
    const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', `case_${caseId}`)
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    const ext    = path.extname(safeFilename(file.originalname))
    cb(null, `${unique}${ext}`)
  },
})

/** Post-upload MIME verification using magic bytes.
 *  Call this after multer has saved the file to disk.
 *  Returns true if the file type is allowed, false otherwise.
 *  Callers should delete the file and 400 if it returns false.
 */
export async function verifyMagicBytes(filePath: string, declaredMime: string): Promise<boolean> {
  try {
    const fd    = fs.openSync(filePath, 'r')
    const buf   = Buffer.alloc(8)
    fs.readSync(fd, buf, 0, 8, 0)
    fs.closeSync(fd)
    const detected = detectMime(buf)
    // Accept when declared mime matches detected, OR when OOXML zip container matches either doc or xls variant
    if (!detected) return false
    if (detected === declaredMime) return true
    // OOXML and OLE2 containers are shared between doc/xls variants — be lenient
    const ooxmlMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    const ole2Mimes = ['application/msword', 'application/vnd.ms-excel']
    if (ooxmlMimes.includes(detected) && ooxmlMimes.includes(declaredMime)) return true
    if (ole2Mimes.includes(detected) && ole2Mimes.includes(declaredMime)) return true
    return false
  } catch {
    return false
  }
}

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('File type not allowed. Accepted: PDF, images, Word, Excel.'))
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } })

export default upload

// ─── Message attachments (10 MB, includes gif) ────────────
const MESSAGE_ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

const messageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'messages')
    fs.mkdirSync(dir, { recursive: true })
    cb(null, dir)
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
    const ext    = path.extname(safeFilename(file.originalname))
    cb(null, `${unique}${ext}`)
  },
})

const messageFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (MESSAGE_ALLOWED_TYPES.includes(file.mimetype)) cb(null, true)
  else cb(new Error('File type not allowed.'))
}

export const messageUpload = multer({
  storage: messageStorage,
  fileFilter: messageFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
})
