<template>
  <main class="container">
    <h1 class="title">Upload</h1>

    <section class="card">
      <label class="label" for="file">Selecione um arquivo</label>
      <input id="file" type="file" class="input" :disabled="uploading" @change="onPick" />

      <div class="row">
        <button class="button" :disabled="!pickedFile || uploading" @click="upload">
          {{ uploading ? 'Enviando…' : 'Upload' }}
        </button>
        <div v-if="pickedFile" class="muted">
          {{ pickedFile.name }} ({{ formatBytes(pickedFile.size) }})
        </div>
      </div>

      <div v-if="uploading" class="progressWrap">
        <progress class="progress" :value="progress" max="100" />
        <div class="muted">{{ progress }}%</div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-if="result" class="card">
      <h2 class="subtitle">Pronto</h2>

      <div class="block">
        <div class="label">Link direto</div>
        <a class="link" :href="result.url" target="_blank" rel="noreferrer">
          {{ result.url }}
        </a>
      </div>

      <div class="block">
        <div class="label">curl</div>
        <pre class="code">{{ curlExample }}</pre>
      </div>

      <div class="block">
        <div class="label">wget</div>
        <pre class="code">{{ wgetExample }}</pre>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
type UploadResponse = {
  url: string
}

const pickedFile = ref<File | null>(null)
const uploading = ref(false)
const progress = ref(0)
const result = ref<UploadResponse | null>(null)
const error = ref<string | null>(null)

const absoluteUrl = computed(() => {
  if (!result.value?.url) return ''
  return new URL(result.value.url, window.location.origin).toString()
})

const curlExample = computed(() => {
  if (!absoluteUrl.value) return ''
  return `curl -L -o "arquivo.bin" "${absoluteUrl.value}"`
})

const wgetExample = computed(() => {
  if (!absoluteUrl.value) return ''
  return `wget -O "arquivo.bin" "${absoluteUrl.value}"`
})

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  pickedFile.value = input.files?.[0] || null
  result.value = null
  error.value = null
  progress.value = 0
}

function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  const digits = i === 0 ? 0 : i === 1 ? 1 : 2
  return `${n.toFixed(digits)} ${units[i]}`
}

async function upload() {
  if (!pickedFile.value || uploading.value) return

  uploading.value = true
  progress.value = 0
  result.value = null
  error.value = null

  try {
    const res = await new Promise<UploadResponse>((resolve, reject) => {
      const form = new FormData()
      form.append('file', pickedFile.value as File)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload')
      xhr.responseType = 'json'

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return
        progress.value = Math.min(100, Math.round((ev.loaded / ev.total) * 100))
      }

      xhr.onload = () => {
        const status = xhr.status
        const body = xhr.response
        if (status >= 200 && status < 300 && body) return resolve(body as UploadResponse)
        const message =
          (body && (body.statusMessage || body.message)) || `Falha no upload (HTTP ${status})`
        reject(new Error(message))
      }

      xhr.onerror = () => reject(new Error('Falha no upload'))
      xhr.send(form)
    })

    result.value = res
  } catch (e: any) {
    error.value = e?.message || 'Falha no upload'
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.container {
  max-width: 720px;
  margin: 40px auto;
  padding: 0 16px;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}
.title {
  font-size: 28px;
  margin: 0 0 16px;
}
.subtitle {
  font-size: 18px;
  margin: 0 0 8px;
}
.card {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px;
  background: #fff;
  margin-bottom: 16px;
}
.label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
}
.input {
  display: block;
  width: 100%;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.button {
  border: 1px solid #111827;
  background: #111827;
  color: #fff;
  padding: 10px 14px;
  border-radius: 8px;
  cursor: pointer;
}
.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.muted {
  color: #6b7280;
  font-size: 14px;
}
.progressWrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.progress {
  width: 100%;
  height: 14px;
}
.error {
  margin-top: 12px;
  color: #b91c1c;
}
.block {
  margin-top: 12px;
}
.link {
  color: #2563eb;
  text-decoration: underline;
  word-break: break-all;
}
.code {
  background: #0b1020;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  font-size: 13px;
}
</style>
