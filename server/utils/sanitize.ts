export function sanitizeFilename(input: string) {
  const name = (input || '').replaceAll('\\', '/').split('/').pop() || ''

  const cleaned = name
    .normalize('NFKC')
    .replaceAll('\u0000', '')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()

  const limited = cleaned.slice(0, 120)
  return limited.length ? limited : 'file'
}

