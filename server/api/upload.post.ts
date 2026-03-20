import { handleUpload } from '../services/uploadService'

export default defineEventHandler(async (event) => {
  return await handleUpload(event)
})

