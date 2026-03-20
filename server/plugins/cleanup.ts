import { clearUploads, ensureUploadsDir } from '../utils/uploadStorage'

function msUntil2359(now = new Date()) {
  const target = new Date(now)
  target.setHours(23, 59, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target.getTime() - now.getTime()
}

export default defineNitroPlugin(async (nitroApp) => {
  await ensureUploadsDir()

  let timer: NodeJS.Timeout | undefined

  const schedule = () => {
    const waitMs = msUntil2359()
    timer = setTimeout(async () => {
      await clearUploads()
      schedule()
    }, waitMs)
  }

  schedule()

  nitroApp.hooks.hook('close', () => {
    if (timer) clearTimeout(timer)
  })
})

