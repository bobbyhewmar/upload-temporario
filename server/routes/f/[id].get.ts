import { getRouterParam } from 'h3'
import { handleDownload } from '../../services/downloadService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  return await handleDownload(event, id)
})

