import { createError, getRequestHeader, readBody } from 'h3'
import { pipeline } from 'node:stream/promises'
import { createWriteStream, promises as fsp } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_CHUNK_BYTES, MAX_UPLOAD_BYTES } from '../utils/constants'
import { filenameToUrlSegment } from '../utils/filenameForUrl'
import { generateId } from '../utils/id'
import { sanitizeFilename } from '../utils/sanitize'
import { dataPath, ensureUploadsDir, writeUploadMeta, type UploadMeta } from '../utils/uploadStorage'
import {
  type UploadSession,
  createChunkReadStream,
  createChunkWriteStream,
  chunkPath,
  deleteSessionAndChunks,
  ensureUploadChunksDir,
  hasChunk,
  readSession,
  statChunk,
  writeSession,
} from '../utils/resumableStorage'

function clampChunkSize(value: number) {
  const min = 1 * 1024 * 1024
  const max = 64 * 1024 * 1024
  if (!Number.isFinite(value)) return DEFAULT_CHUNK_BYTES
  return Math.max(min, Math.min(max, Math.floor(value)))
}

function expectedChunkSize(session: UploadSession, index: number) {
  const totalChunks = Math.ceil(session.totalSize / session.chunkSize)
  if (index < 0 || index >= totalChunks) {
    throw createError({ statusCode: 400, statusMessage: 'Chunk inválido' })
  }
  const isLast = index === totalChunks - 1
  if (!isLast) return session.chunkSize
  const remainder = session.totalSize % session.chunkSize
  return remainder === 0 ? session.chunkSize : remainder
}

function uniqueSorted(nums: number[]) {
  return Array.from(new Set(nums)).sort((a, b) => a - b)
}

export async function createUploadSession(body: any) {
  const filename = sanitizeFilename(body?.filename || 'file')
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : null
  const totalSize = Number(body?.size || 0)
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Tamanho inválido' })
  }
  if (totalSize > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Arquivo muito grande' })
  }

  const chunkSize = clampChunkSize(Number(body?.chunkSize || DEFAULT_CHUNK_BYTES))
  const uploadId = generateId()
  const now = new Date().toISOString()

  const session: UploadSession = {
    uploadId,
    filename,
    mimeType,
    totalSize,
    chunkSize,
    received: [],
    createdAt: now,
    updatedAt: now,
    status: 'uploading',
  }

  await ensureUploadChunksDir(uploadId)
  await writeSession(session)

  const filenameSegment = filenameToUrlSegment(filename, uploadId)
  const totalChunks = Math.ceil(totalSize / chunkSize)

  return {
    uploadId,
    chunkSize,
    totalSize,
    totalChunks,
    url: `/f/${uploadId}/${filenameSegment}`,
  }
}

export async function getUploadSession(uploadId: string) {
  const session = await readSession(uploadId)
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Sessão não encontrada' })
  }
  const totalChunks = Math.ceil(session.totalSize / session.chunkSize)
  const received = uniqueSorted(session.received)
  const missing: number[] = []
  for (let i = 0; i < totalChunks; i++) {
    if (!received.includes(i)) missing.push(i)
  }
  return {
    uploadId: session.uploadId,
    filename: session.filename,
    mimeType: session.mimeType,
    totalSize: session.totalSize,
    chunkSize: session.chunkSize,
    totalChunks,
    receivedChunks: received,
    missingChunks: missing,
    status: session.status,
    updatedAt: session.updatedAt,
  }
}

export async function uploadChunk(event: any, uploadId: string, indexRaw: string) {
  const index = Number(indexRaw)
  if (!Number.isInteger(index) || index < 0) {
    throw createError({ statusCode: 400, statusMessage: 'Chunk inválido' })
  }

  const session = await readSession(uploadId)
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Sessão não encontrada' })
  }
  if (session.status !== 'uploading') {
    throw createError({ statusCode: 409, statusMessage: 'Sessão não está em upload' })
  }

  const expected = expectedChunkSize(session, index)

  const contentLength = Number(getRequestHeader(event, 'content-length') || 0)
  if (contentLength && contentLength > expected) {
    throw createError({ statusCode: 413, statusMessage: 'Chunk maior que o esperado' })
  }

  await ensureUploadChunksDir(uploadId)

  if (await hasChunk(uploadId, index)) {
    const st = await statChunk(uploadId, index)
    if (st.size === expected) {
      session.received = uniqueSorted([...session.received, index])
      session.updatedAt = new Date().toISOString()
      await writeSession(session)
      return { ok: true, uploadId, index, received: true }
    }
  }

  const req = event.node.req
  const out = createChunkWriteStream(uploadId, index)

  let written = 0
  req.on('data', (chunk: Buffer) => {
    written += chunk.length
    if (written > expected) {
      out.destroy()
      req.destroy()
    }
  })

  try {
    await pipeline(req, out)
  } catch {
    await fsp.unlink(chunkPath(uploadId, index)).catch(() => undefined)
    if (written > expected) {
      throw createError({ statusCode: 413, statusMessage: 'Chunk maior que o esperado' })
    }
    throw createError({ statusCode: 500, statusMessage: 'Falha ao gravar chunk' })
  }

  if (written !== expected) {
    await fsp.unlink(chunkPath(uploadId, index)).catch(() => undefined)
    throw createError({ statusCode: 400, statusMessage: 'Chunk incompleto' })
  }

  session.received = uniqueSorted([...session.received, index])
  session.updatedAt = new Date().toISOString()
  await writeSession(session)

  return { ok: true, uploadId, index, received: true }
}

export async function completeUpload(uploadId: string) {
  const session = await readSession(uploadId)
  if (!session) {
    throw createError({ statusCode: 404, statusMessage: 'Sessão não encontrada' })
  }
  if (session.status !== 'uploading') {
    throw createError({ statusCode: 409, statusMessage: 'Sessão já finalizada' })
  }

  const totalChunks = Math.ceil(session.totalSize / session.chunkSize)
  const received = uniqueSorted(session.received)
  if (received.length !== totalChunks) {
    throw createError({ statusCode: 409, statusMessage: 'Upload incompleto' })
  }

  await ensureUploadsDir()
  const finalPath = dataPath(uploadId)
  const tmpPath = resolve(process.cwd(), 'storage', 'uploads', `${uploadId}.assembling`)

  const out = createWriteStream(tmpPath, { flags: 'w' })
  try {
    const append = async (src: NodeJS.ReadableStream) => {
      await new Promise<void>((resolve, reject) => {
        src.on('error', reject)
        out.on('error', reject)
        src.on('end', () => resolve())
        src.pipe(out, { end: false })
      })
    }

    for (let i = 0; i < totalChunks; i++) {
      const expected = expectedChunkSize(session, i)
      const st = await statChunk(uploadId, i)
      if (st.size !== expected) {
        out.destroy()
        throw createError({ statusCode: 409, statusMessage: 'Chunk inválido' })
      }
      await append(createChunkReadStream(uploadId, i))
    }
    out.end()
    await new Promise<void>((resolve, reject) => {
      out.on('finish', () => resolve())
      out.on('error', reject)
    })
  } catch (err) {
    await fsp.unlink(tmpPath).catch(() => undefined)
    throw err
  }

  await fsp.rename(tmpPath, finalPath)

  const meta: UploadMeta = {
    id: uploadId,
    filename: session.filename,
    mimeType: session.mimeType,
    size: session.totalSize,
    uploadedAt: new Date().toISOString(),
  }
  await writeUploadMeta(meta)

  session.status = 'completed'
  session.updatedAt = new Date().toISOString()
  await writeSession(session)
  await deleteSessionAndChunks(uploadId)

  const filenameSegment = filenameToUrlSegment(session.filename, uploadId)
  return { url: `/f/${uploadId}/${filenameSegment}` }
}

export async function parseJsonBody(event: any) {
  return await readBody(event)
}
