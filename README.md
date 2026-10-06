# PDF Summarizer

Small full-stack app: upload one English PDF, extract text on the server, summarize with OpenAI, and show the result in the browser.

## Prerequisites

- Node.js 18 or newer
- npm
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Setup

```bash
cd pdf-summarizer
npm install
npm run install:all
cp .env.example .env
```

Edit `.env` and set `OPENAI_API_KEY`.

## Run (development)

Two processes (API + Vite dev server with proxy):

```bash
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:3001  

## Run (production-style)

Build the client and serve it from Express:

```bash
npm start
```

Open http://localhost:3001

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Server-side OpenAI key |
| `OPENAI_MODEL` | No | Default: `gpt-4o-mini` |
| `PORT` | No | Default: `3001` |

## Limits (enforced on client and server)

- One PDF per request
- Max file size: **5 MB**
- Max pages: **20**
- Max extracted text: **30,000 characters**
- English, selectable text (no OCR)

## API

### `POST /api/summarize`

- **Content-Type:** `multipart/form-data`
- **Field:** `file` (PDF)

**Success (200):**

```json
{ "summary": "The document explains..." }
```

**Error (4xx/5xx):**

```json
{
  "error": {
    "code": "NO_TEXT",
    "message": "No readable text was found in this PDF."
  }
}
```

Stable error codes include: `NO_FILE`, `INVALID_PDF`, `FILE_TOO_LARGE`, `TOO_MANY_PAGES`, `TEXT_TOO_LONG`, `NO_TEXT`, `PASSWORD_PROTECTED`, `CONFIG_ERROR`, `PROVIDER_UNAVAILABLE`, `TIMEOUT`, `SERVER_ERROR`.

### `GET /api/health`

Returns `{ "ok": true }`.

## Sample PDF

Generate a local test file (optional):

```bash
node scripts/create-sample-pdf.mjs
```

Output: `samples/sample-text.pdf`

## Known limitations

- No OCR for scanned PDFs
- No password unlocking
- No upload history or database storage
- Single provider (OpenAI) and model via environment variables

## Deploy on Vercel

1. Push this repository to GitHub (see below).
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Set **Root Directory** to the repo root (default).
4. Add environment variable **`OPENAI_API_KEY`** (and optional `OPENAI_MODEL`).
5. Deploy. The static UI and `/api/summarize` serverless function run on the same domain.

Local dev still uses the Express server on port 3001; production on Vercel uses the `api/` routes.

## Manual verification

See [VERIFICATION.md](./VERIFICATION.md).
