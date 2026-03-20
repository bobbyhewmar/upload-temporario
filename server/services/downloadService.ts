import { createError, sendStream, setHeader } from 'h3'
import { createUploadStream, hasUpload, isValidId, readUploadMeta, statUpload } from '../utils/uploadStorage'

function contentDisposition(filename: string) {
  const fallback = filename.replace(/["\\]/g, '_')
  const encoded = encodeURIComponent(filename)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

export async function prepareDownload(id: string) {
  if (!isValidId(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Arquivo não encontrado' })
  }

  const exists = await hasUpload(id)
  if (!exists) {
    throw createError({ statusCode: 404, statusMessage: 'Arquivo não encontrado' })
  }

  const stat = await statUpload(id)
  const meta = await readUploadMeta(id)
  const filename = meta?.filename || id
  const mimeType = meta?.mimeType || 'application/octet-stream'

  return { stat, filename, mimeType }
}

export function applyDownloadHeaders(event: any, prepared: { stat: { size: number }; filename: string; mimeType: string }) {
  setHeader(event, 'Content-Type', prepared.mimeType)
  setHeader(event, 'Content-Length', prepared.stat.size)
  setHeader(event, 'Content-Disposition', contentDisposition(prepared.filename))
  setHeader(event, 'Cache-Control', 'public, max-age=0')
}

export async function handleDownload(event: any, id: string) {
  const prepared = await prepareDownload(id)
  applyDownloadHeaders(event, prepared)
  return sendStream(event, createUploadStream(id))
}
