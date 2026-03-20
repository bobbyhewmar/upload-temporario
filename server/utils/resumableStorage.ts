import { createReadStream, createWriteStream, promises as fsp } from 'node:fs'
import { resolve, sep } from 'node:path'
import { createError } from 'h3'

export type UploadSession = {
  uploadId: string
  filename: string
  mimeType: string | null
  totalSize: number
  chunkSize: number
  received: number[]
  createdAt: string
  updatedAt: string
  status: 'uploading' | 'completed'
}

const baseDir = resolve(process.cwd(), 'storage', 'uploads')
const sessionsDir = resolve(baseDir, '.sessions')
const chunksDir = resolve(baseDir, '.chunks')

function safeJoin(base: string, leaf: string) {
  const full = resolve(base, leaf)
  const prefix = `${resolve(base)}${sep}`
  if (!full.toLowerCase().startsWith(prefix.toLowerCase())) {
    throw createError({ statusCode: 400, statusMessage: 'Caminho inválido' })
  }
  return full
}

export async function ensureResumableDirs() {
  await Promise.all([
    fsp.mkdir(baseDir, { recursive: true }),
    fsp.mkdir(sessionsDir, { recursive: true }),
    fsp.mkdir(chunksDir, { recursive: true }),
  ])
}

export function sessionPath(uploadId: string) {
  return safeJoin(sessionsDir, `${uploadId}.json`)
}

export function uploadChunksDir(uploadId: string) {
  return safeJoin(chunksDir, uploadId)
}

export function chunkPath(uploadId: string, index: number) {
  return safeJoin(uploadChunksDir(uploadId), `${index}.part`)
}

export async function readSession(uploadId: string): Promise<UploadSession | null> {
  try {
    const raw = await fsp.readFile(sessionPath(uploadId), 'utf8')
    return JSON.parse(raw) as UploadSession
  } catch {
    return null
  }
}

export async function writeSession(session: UploadSession) {
  await ensureResumableDirs()
  const path = sessionPath(session.uploadId)
  const tmp = `${path}.${Date.now()}.tmp`
  await fsp.writeFile(tmp, JSON.stringify(session), 'utf8')
  await fsp.rename(tmp, path)
}

export async function ensureUploadChunksDir(uploadId: string) {
  await ensureResumableDirs()
  await fsp.mkdir(uploadChunksDir(uploadId), { recursive: true })
}

export function createChunkWriteStream(uploadId: string, index: number) {
  return createWriteStream(chunkPath(uploadId, index), { flags: 'w' })
}

export function createChunkReadStream(uploadId: string, index: number) {
  return createReadStream(chunkPath(uploadId, index))
}

export async function statChunk(uploadId: string, index: number) {
  return await fsp.stat(chunkPath(uploadId, index))
}

export async function hasChunk(uploadId: string, index: number) {
  try {
    await statChunk(uploadId, index)
    return true
  } catch {
    return false
  }
}

export async function deleteSessionAndChunks(uploadId: string) {
  await Promise.all([
    fsp.rm(uploadChunksDir(uploadId), { recursive: true, force: true }).catch(() => undefined),
    fsp.unlink(sessionPath(uploadId)).catch(() => undefined),
  ])
}

export async function clearResumableData() {
  await ensureResumableDirs()
  await Promise.all([
    fsp.rm(sessionsDir, { recursive: true, force: true }).catch(() => undefined),
    fsp.rm(chunksDir, { recursive: true, force: true }).catch(() => undefined),
    fsp.mkdir(sessionsDir, { recursive: true }),
    fsp.mkdir(chunksDir, { recursive: true }),
  ])
}

