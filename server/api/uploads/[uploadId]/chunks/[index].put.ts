import { getRouterParam } from 'h3'
import { uploadChunk } from '../../../../services/resumableUploadService'

export default defineEventHandler(async (event) => {
  const uploadId = getRouterParam(event, 'uploadId') || ''
  const index = getRouterParam(event, 'index') || ''
  return await uploadChunk(event, uploadId, index)
})

