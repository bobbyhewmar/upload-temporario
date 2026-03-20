import { createReadStream, createWriteStream, promises as fsp } from 'node:fs'
import { resolve, sep } from 'node:path'
import { createError } from 'h3'

export type UploadMeta = {
  id: string
  filename: string
  mimeType: string | null
  size: number
  uploadedAt: string
}

const uploadsDir = resolve(process.cwd(), 'storage', 'uploads')

export function getUploadsDir() {
  return uploadsDir
}

export async function ensureUploadsDir() {
  await fsp.mkdir(uploadsDir, { recursive: true })
}

export function isValidId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

function safeJoin(baseDir: string, leaf: string) {
  const full = resolve(baseDir, leaf)
  const base = `${resolve(baseDir)}${sep}`
  if (!full.toLowerCase().startsWith(base.toLowerCase())) {
    throw createError({ statusCode: 400, statusMessage: 'Caminho inválido' })
  }
  return full
}

export function dataPath(id: string) {
  return safeJoin(uploadsDir, id)
}

export function metaPath(id: string) {
  return safeJoin(uploadsDir, `${id}.json`)
}

export function createUploadWriteStream(id: string) {
  return createWriteStream(dataPath(id), { flags: 'wx' })
}

export async function writeUploadMeta(meta: UploadMeta) {
  await ensureUploadsDir()
  await fsp.writeFile(metaPath(meta.id), JSON.stringify(meta), 'utf8')
}

export async function readUploadMeta(id: string): Promise<UploadMeta | null> {
  try {
    const raw = await fsp.readFile(metaPath(id), 'utf8')
    return JSON.parse(raw) as UploadMeta
  } catch {
    return null
  }
}

export async function hasUpload(id: string) {
  try {
    await fsp.stat(dataPath(id))
    return true
  } catch {
    return false
  }
}

export async function statUpload(id: string) {
  return await fsp.stat(dataPath(id))
}

export function createUploadStream(id: string) {
  return createReadStream(dataPath(id))
}

export async function deleteUpload(id: string) {
  await Promise.all([
    fsp.unlink(dataPath(id)).catch(() => undefined),
    fsp.unlink(metaPath(id)).catch(() => undefined),
  ])
}

export async function clearUploads() {
  await ensureUploadsDir()
  const entries = await fsp.readdir(uploadsDir, { withFileTypes: true })
  await Promise.all(
    entries
      .filter((e) => e.name !== '.gitkeep')
      .map(async (e) => {
        const full = safeJoin(uploadsDir, e.name)
        if (e.isDirectory()) {
          await fsp.rm(full, { recursive: true, force: true }).catch(() => undefined)
          return
        }
        if (e.isFile()) {
          await fsp.unlink(full).catch(() => undefined)
        }
      }),
  )
}
