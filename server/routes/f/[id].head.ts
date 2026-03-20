import { getRouterParam, sendRedirect } from 'h3'
import { applyDownloadHeaders, prepareDownload } from '../../services/downloadService'
import { readUploadMeta } from '../../utils/uploadStorage'
import { filenameToUrlSegment } from '../../utils/filenameForUrl'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const meta = await readUploadMeta(id)
  if (meta?.filename) {
    const filename = filenameToUrlSegment(meta.filename, id)
    return sendRedirect(event, `/f/${id}/${filename}`, 302)
  }
  const prepared = await prepareDownload(id)
  applyDownloadHeaders(event, prepared)
  return ''
})

