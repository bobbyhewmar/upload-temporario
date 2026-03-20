import Busboy from 'busboy'
import { createError, getRequestHeader } from 'h3'
import { pipeline } from 'node:stream/promises'
import { MAX_UPLOAD_BYTES } from '../utils/constants'
import { generateId } from '../utils/id'
import { sanitizeFilename } from '../utils/sanitize'
import { filenameToUrlSegment } from '../utils/filenameForUrl'
import { createUploadWriteStream, deleteUpload, ensureUploadsDir, type UploadMeta, writeUploadMeta } from '../utils/uploadStorage'

export async function handleUpload(event: any) {
  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength && contentLength > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Upload muito grande (máx 10GB)' })
  }

  const contentType = getRequestHeader(event, 'content-type') || ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw createError({ statusCode: 400, statusMessage: 'Envie multipart/form-data' })
  }

  const id = generateId()
  await ensureUploadsDir()

  const req = event.node.req

  const bb = Busboy({
    headers: req.headers,
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
    },
  })

  let fileSeen = false
  let size = 0
  let filename: string = id
  let mimeType: string | null = null
  let filePipeline: Promise<void> | null = null
  let tooLarge = false

  await new Promise<void>((resolve, reject) => {
    const fail = async (err: any) => {
      try {
        await deleteUpload(id)
      } finally {
        reject(err)
      }
    }

    bb.on('file', (fieldname, file, info: any, encoding?: any, mimetype?: any) => {
      if (fileSeen) {
        file.resume()
        return
      }
      fileSeen = true

      const rawFilename =
        typeof info === 'string'
          ? info
          : typeof info?.filename === 'string'
            ? info.filename
            : ''

      filename = sanitizeFilename(rawFilename || id)

      const rawMimeType =
        typeof info === 'object' && typeof info?.mimeType === 'string'
          ? info.mimeType
          : typeof mimetype === 'string'
            ? mimetype
            : null

      mimeType = rawMimeType || null

      const out = createUploadWriteStream(id)

      file.on('data', (chunk: Buffer) => {
        size += chunk.length
      })

      file.on('limit', () => {
        tooLarge = true
        file.unpipe(out)
        out.destroy()
        file.resume()
      })

      filePipeline = pipeline(file, out).catch((err) => {
        throw err
      })
    })

    bb.on('error', (err) => {
      void fail(err)
    })

    bb.on('finish', () => {
      if (!fileSeen) {
        void fail(createError({ statusCode: 400, statusMessage: 'Nenhum arquivo enviado' }))
        return
      }

      if (tooLarge) {
        void fail(createError({ statusCode: 413, statusMessage: 'Upload muito grande (máx 10GB)' }))
        return
      }

      Promise.resolve(filePipeline)
        .then(async () => {
          const meta: UploadMeta = { id, filename, mimeType, size, uploadedAt: new Date().toISOString() }
          await writeUploadMeta(meta)
          console.info(`[upload] id=${id} size=${size} filename="${filename}"`)
          resolve()
        })
        .catch((err) => {
          void fail(err)
        })
    })

    req.pipe(bb)
  })

  const filenameSegment = filenameToUrlSegment(filename, id)
  return { url: `/f/${id}/${filenameSegment}` }
}
