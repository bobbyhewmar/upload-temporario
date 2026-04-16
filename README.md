# Upload + Link Compartilhável (Nuxt 4)

Projeto focado em uma experiência simples e robusta de transferência de arquivos grandes: faz upload, gera um link e permite download imediato em navegador, `curl` ou `wget`.

Em 30 segundos:
- Resolve envio de arquivos pesados com suporte a retomada por chunks.
- Entrega URL compartilhável (`/f/{id}/{filename}`) sem fricção para quem recebe.
- Usa streaming no backend para reduzir uso de memória em arquivos grandes.
- Mantém segurança básica de produção (limite de tamanho, validação de ID, sanitização de nome e proteção contra path traversal).

## Problema e Solução

**Problema**
- Compartilhar arquivos grandes entre times e sistemas ainda costuma exigir ferramentas pesadas, UX ruim ou fluxos frágeis quando a rede cai.

**Solução**
- API de upload simples para casos rápidos (`POST /api/upload`) e fluxo resumable para arquivos grandes/instáveis.
- Download por link direto e estável, com headers corretos para automação e uso humano.
- Armazenamento local com metadados para manter rastreabilidade mínima do arquivo.

## Funcionalidades

- Upload simples via `multipart/form-data`.
- Upload resumable (chunked): inicia sessão, envia partes, consulta progresso e finaliza.
- Link compartilhável para download com fallback de rota.
- Compatível com navegador, `curl` e `wget`.
- Limpeza automática diária de uploads (23:59, horário local do servidor).
- Limite de upload de até 10GB.

## Arquitetura

- `Nuxt 4 + Nitro` como runtime full-stack.
- Endpoints HTTP em `server/api` e `server/routes`.
- Camada de serviço em `server/services` para separar regra de negócio dos handlers.
- Camada utilitária em `server/utils` para IO de arquivos, IDs, sanitização e constantes.
- Armazenamento em disco local:
  - Binário final: `storage/uploads/{id}`
  - Metadados: `storage/uploads/{id}.json`
  - Chunks/sessão temporários durante upload resumable.

### Fluxos principais

**Upload simples**
1. `POST /api/upload` recebe stream multipart.
2. Arquivo é persistido em disco sem carregar inteiro na memória.
3. API retorna `{ "url": "/f/{id}/{filename}" }`.

**Upload resumable**
1. `POST /api/uploads/init` cria sessão.
2. `PUT /api/uploads/{uploadId}/chunks/{index}` envia chunks idempotentes.
3. `GET /api/uploads/{uploadId}` informa progresso (`bytesReceived`, `percent`, `missingChunks`).
4. `POST /api/uploads/{uploadId}/complete` monta o arquivo final e retorna URL.

## Decisões Técnicas

- Streaming com `Busboy` e `pipeline` para escalar melhor em arquivos grandes.
- Upload resumable por chunks para tolerar falhas de rede e permitir retomada.
- UUID validado em rotas de download para reduzir superfície de acesso indevido.
- Sanitização de filename e encoding seguro em `Content-Disposition`.
- Limpeza automática via plugin Nitro com `setTimeout` recorrente.
- Armazenamento em filesystem local para simplicidade operacional neste escopo.

## Rotas da API

- `POST /api/upload`
- `POST /api/uploads/init`
- `PUT /api/uploads/{uploadId}/chunks/{index}`
- `GET /api/uploads/{uploadId}`
- `POST /api/uploads/{uploadId}/complete`
- `GET /f/{id}/{filename}`
- `GET /f/{id}` (fallback para redirecionamento quando possível)

## Como Rodar

Pré-requisitos:
- Node.js 20+
- npm

Instalação:

```bash
npm install
```

Desenvolvimento (porta `5000`):

```bash
npm run dev
```

Build de produção:

```bash
npm run build
```

Preview local da build:

```bash
npm run preview
```

Teste rápido de upload:

```bash
curl -F "file=@meu-arquivo.iso" http://localhost:5000/api/upload
```

## Possíveis Melhorias

- Autenticação/autorização por usuário ou token por arquivo.
- Expiração de links com assinatura temporária.
- Vírus scan e validação de tipo de arquivo mais rigorosa.
- Upload direto para object storage (S3/R2/GCS) com presigned URLs.
- Observabilidade (métricas, tracing, logs estruturados).
- Rate limiting e proteção anti-abuso.

## Observação de Deploy

- O scheduler interno de limpeza funciona bem em Node com processo ativo.
- Em serverless ou escala horizontal, ideal mover limpeza para cron externo/worker dedicado.
