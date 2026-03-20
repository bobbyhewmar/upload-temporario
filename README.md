# Minimal Upload + Link (Nuxt 4)

- Upload de arquivo via navegador
- Link direto e compartilhável para download: `/f/{id}`
- Download via navegador, `curl` e `wget`
- Limpeza automática diária às 23:59 (horário local do servidor)
- Armazenamento local em `storage/uploads`

## Rotas

- `POST /api/upload` (multipart/form-data, campo `file`)
- `GET /f/{id}/{filename}` (download direto, sem autenticação)
- `GET /f/{id}` (fallback; redireciona para a URL com `{filename}` quando possível)

## Metadados

Após o upload, são salvos:

- Binário: `storage/uploads/{id}`
- Metadados: `storage/uploads/{id}.json` com `filename` e `mimeType` (sanitizados/fallback seguro)

## Limites e segurança

- Tamanho máximo: 10GB
- Sanitização do nome do arquivo (removendo caracteres perigosos)
- ID é UUID (validado) e paths são resolvidos com proteção contra path traversal

## Como rodar

Instale as dependências:

```bash
npm install
```

Dev server (porta definida em `nuxt.config.ts`):

```bash
npm run dev
```

## Upload resumable (chunked)

Fluxo:

1) Criar sessão: `POST /api/uploads/init`
2) Enviar chunks: `PUT /api/uploads/{uploadId}/chunks/{index}` (body binário)
3) Consultar progresso: `GET /api/uploads/{uploadId}`
4) Finalizar: `POST /api/uploads/{uploadId}/complete` → `{ "url": "/f/{id}/{filename}" }`

Exemplo (PowerShell):

```powershell
$file = "meu-arquivo.iso"
$size = (Get-Item $file).Length

curl.exe -H "Content-Type: application/json" `
  --data-binary "{""filename"":""meu-arquivo.iso"",""size"":$size,""chunkSize"":1048576}" `
  http://localhost:3000/api/uploads/init
```

Depois, divida o arquivo em partes e envie:

```bash
curl.exe -X PUT --data-binary "@chunk0.part" http://localhost:3000/api/uploads/<uploadId>/chunks/0
curl.exe -X PUT --data-binary "@chunk1.part" http://localhost:3000/api/uploads/<uploadId>/chunks/1
curl.exe -X PUT --data-binary "@chunk2.part" http://localhost:3000/api/uploads/<uploadId>/chunks/2
curl.exe -X POST http://localhost:3000/api/uploads/<uploadId>/complete
```

## Production

Build:

```bash
npm run build
```

Preview local:

```bash
npm run preview
```

## Exemplo (Proxmox/curl/wget)

O upload retorna `{ "url": "/f/{id}/{filename}" }`, por exemplo:

```bash
curl -F "file=@meu-arquivo.iso" http://localhost:3000/api/upload
```

## Observações

- A limpeza diária roda como scheduler interno do Nitro (bom para runtime Node com processo ativo). Em ambientes serverless/escala horizontal, prefira um cron externo.
