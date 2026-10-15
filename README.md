# Clinical Document RAG (MedKaz-style portal)

Full-stack medical document workspace: upload & index PDFs, configure summarization, review cited summaries, and ask follow-up questions with optional de-identified web enrichment.

Evolved from the prior `pdf-summarizer` client and reuses the **Chroma + embeddings** pattern from `Chat-with-PDF-Chatbot` (Python), now implemented on the Node server.

## Prerequisites

- Node.js 18+
- OpenAI API key (server-side)
- Optional: [Tavily](https://tavily.com/) API key for web enrichment
- Optional: Chroma server (`CHROMA_URL`) — if unavailable, SQLite chunks still power retrieval fallback

## Setup

```bash
cd pdf-summarizer
npm install
npm run install:all
copy .env.example .env   # Windows
# Set OPENAI_API_KEY in .env
```

## Run

```bash
npm run dev
```

- UI: http://localhost:5173  
- API: http://localhost:3001  

Production-style:

```bash
npm start
```

## Environment variables (names only)

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | Summaries, chat, embeddings |
| `OPENAI_MODEL` | Chat model (default `gpt-4o-mini`) |
| `OPENAI_EMBED_MODEL` | Embeddings (default `text-embedding-3-small`) |
| `TAVILY_API_KEY` | Optional web search |
| `CHROMA_URL` | Optional external Chroma |
| `PORT` | API port (default `3001`) |

Do **not** put API keys in the React client.

## API routes

- `POST /api/documents` — upload PDFs (multipart `files`)
- `GET /api/documents`
- `GET /api/documents/:id`
- `GET /api/documents/:id/file` — PDF preview
- `POST /api/documents/:id/retry`
- `POST /api/summaries` — start summary job
- `GET /api/summaries/:id`
- `GET /api/jobs/:id`
- `POST /api/conversations`
- `POST /api/conversations/:id/messages`
- `GET /api/health`, `/api/categories`, `/api/workspace`

## Architecture

- **SQLite** (`data/app.db`) — documents, chunks, jobs, summaries, conversations
- **Chroma** — vector index per patient (when OpenAI + Chroma available)
- **In-process jobs** — ingest & summarize queues
- **React** — sidebar app shell, evidence drawer, MedKaz-inspired styling

## Limitations (honest)

- Demo workspace/patient headers (`X-Workspace-Id`, `X-Patient-Id`) — not full auth/RBAC yet
- OCR for scanned PDFs not implemented (`needs_review` when no text)
- Citation highlight coordinates not extracted (page-level preview only)
- Vercel static deploy **does not** run this API; use `npm start` or a Node host
- Comprehensive summary uses batching/heuristics; always review coverage section

## Verification checklist

- [ ] Upload PDF → statuses progress to `ready` or `needs_review`
- [ ] Summary methods return different structured output
- [ ] Citations open document preview drawer
- [ ] Ask AI returns document-grounded answers
- [ ] Web mode off → no Tavily calls; web mode on without key → clear unavailable section
- [ ] Missing `OPENAI_API_KEY` → 503 with message (no fake AI text)

See `VERIFICATION.md` for the original test brief.
