import { getRouterParam } from 'h3'
import { applyDownloadHeaders, prepareDownload } from '../../../services/downloadService'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const prepared = await prepareDownload(id)
  applyDownloadHeaders(event, prepared)
  return ''
})

