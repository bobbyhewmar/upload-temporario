import { createUploadSession, parseJsonBody } from '../../services/resumableUploadService'

export default defineEventHandler(async (event) => {
  const body = await parseJsonBody(event)
  return await createUploadSession(body)
})

