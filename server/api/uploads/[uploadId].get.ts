import { getRouterParam } from 'h3'
import { getUploadSession } from '../../services/resumableUploadService'

export default defineEventHandler(async (event) => {
  const uploadId = getRouterParam(event, 'uploadId') || ''
  return await getUploadSession(uploadId)
})

