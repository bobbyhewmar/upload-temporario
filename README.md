# Minimal Upload + Link (Nuxt 4)

- Upload de arquivo via navegador
- Link direto e compartilhável para download: `/f/{id}`
- Download via navegador, `curl` e `wget`
- Limpeza automática diária às 23:59 (horário local do servidor)
- Armazenamento local em `storage/uploads`

## Rotas

- `POST /api/upload` (multipart/form-data, campo `file`)
- `GET /f/{id}` (download direto, sem autenticação)

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

Dev server em `http://localhost:3000`:

```bash
npm run dev
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

## Observações

- A limpeza diária roda como scheduler interno do Nitro (bom para runtime Node com processo ativo). Em ambientes serverless/escala horizontal, prefira um cron externo.
