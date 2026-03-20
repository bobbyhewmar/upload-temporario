import { sanitizeFilename } from './sanitize'

export function filenameToUrlSegment(filename: string, fallback: string) {
  const sanitized = sanitizeFilename(filename || '')
  const base = sanitized.length ? sanitized : fallback
  const noSpaces = base.replace(/\s+/g, '-')
  return encodeURIComponent(noSpaces)
}

