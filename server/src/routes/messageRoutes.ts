import { Router } from 'express'
import {
  getConversations,
  getThread,
  sendMessage,
  editMessage,
  deleteMessage,
  deleteConversation,
  downloadAttachment,
  getContacts,
} from '../controllers/messageController'
import { authMiddleware, sseVerifyToken, requireAttorneyScope } from '../middleware/auth'
import { messageUpload } from '../config/upload'

const router = Router()

// Attachment served via query-param token (browser <a> href can't set headers)
router.get('/:id/attachment', sseVerifyToken, downloadAttachment)

router.use(authMiddleware)
router.use(requireAttorneyScope)

router.get('/contacts',                    getContacts)
router.get('/',                            getConversations)
router.get('/:partnerId',                  getThread)
router.post('/',                           messageUpload.single('attachment'), sendMessage)
router.put('/:id',                         editMessage)
router.delete('/conversation/:partnerId',  deleteConversation)
router.delete('/:id',                      deleteMessage)

export default router
