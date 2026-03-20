import { getRouterParam } from 'h3'
import { completeUpload } from '../../../services/resumableUploadService'

export default defineEventHandler(async (event) => {
  const uploadId = getRouterParam(event, 'uploadId') || ''
  return await completeUpload(uploadId)
})

